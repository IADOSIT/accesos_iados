const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const env = require('../../config/env');

async function login(email, password, deviceInfo = {}) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tenants: {
        orderBy: { createdAt: 'asc' },
        include: {
          tenant: true,
          unit: { select: { id: true, maxDevices: true } },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw { status: 401, message: 'Credenciales inválidas' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw { status: 401, message: 'Credenciales inválidas' };
  }

  // Verificar límite de dispositivos si se envía deviceId
  const { deviceId, deviceName, platform, fcmToken } = deviceInfo;
  if (deviceId) {
    const existingSession = await prisma.deviceSession.findUnique({
      where: { userId_deviceId: { userId: user.id, deviceId } },
    });

    if (!existingSession || !existingSession.isActive) {
      // Dispositivo nuevo — verificar límite
      const effectiveLimit = user.maxDevicesOverride ??
        (() => {
          const unitMaxDevices = user.tenants
            .filter(ut => ut.unit)
            .map(ut => ut.unit.maxDevices);
          return unitMaxDevices.length > 0 ? Math.min(...unitMaxDevices) : 1;
        })();

      const activeCount = await prisma.deviceSession.count({
        where: { userId: user.id, isActive: true },
      });

      if (activeCount >= effectiveLimit) {
        throw { status: 423, message: 'Límite de dispositivos alcanzado. Pide al administrador que revoque un dispositivo registrado.' };
      }
    }

    // Upsert sesión de dispositivo
    await prisma.deviceSession.upsert({
      where: { userId_deviceId: { userId: user.id, deviceId } },
      update: {
        deviceName: deviceName || undefined,
        platform: platform || undefined,
        fcmToken: fcmToken || undefined,
        isActive: true,
      },
      create: {
        userId: user.id,
        deviceId,
        deviceName,
        platform,
        fcmToken,
        isActive: true,
      },
    });
  }

  const tenants = user.tenants
    .filter(t => t.isActive && t.tenant.isActive)
    .map(t => ({
      tenantId: t.tenantId,
      tenantName: t.tenant.name,
      role: t.role,
      unitId: t.unitId,
    }));

  const tokenPayload = {
    id: user.id,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
    tenants,
  };

  const accessToken = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });

  return {
    accessToken,
    refreshToken,
    mustChangePassword: user.mustChangePassword,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: user.isSuperAdmin,
      tenants,
    },
  };
}

async function register(data) {
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) {
    throw { status: 409, message: 'El email ya está registrado' };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  return user;
}

async function refreshAccessToken(refreshToken) {
  const payload = jwt.verify(refreshToken, env.JWT_SECRET);
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    include: { tenants: { orderBy: { createdAt: 'asc' }, include: { tenant: true } } },
  });

  if (!user || !user.isActive) {
    throw { status: 401, message: 'Token inválido' };
  }

  const tenants = user.tenants
    .filter(t => t.isActive && t.tenant.isActive)
    .map(t => ({
      tenantId: t.tenantId,
      tenantName: t.tenant.name,
      role: t.role,
      unitId: t.unitId,
    }));

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin, tenants },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  return { accessToken };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw { status: 400, message: 'Contraseña actual incorrecta' };
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
}

async function updateFCMToken(userId, deviceId, token) {
  const value = token && token.trim() !== '' ? token : null;
  if (deviceId) {
    // Actualizar token solo en la sesión del dispositivo que lo solicita
    await prisma.deviceSession.updateMany({
      where: { userId, deviceId },
      data: { fcmToken: value },
    });
  } else {
    // Retrocompatibilidad: actualizar todos los dispositivos activos del usuario
    await prisma.deviceSession.updateMany({
      where: { userId, isActive: true },
      data: { fcmToken: value },
    });
  }
}

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenants: {
        where: { isActive: true },
        include: {
          tenant: { select: { id: true, name: true, isActive: true } },
          unit: { select: { id: true, identifier: true, block: true, floor: true } },
        },
      },
    },
  });
  if (!user || !user.isActive) throw { status: 404, message: 'Usuario no encontrado' };

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isSuperAdmin: user.isSuperAdmin,
    tenants: user.tenants
      .filter(t => t.tenant.isActive)
      .map(t => ({
        tenantId: t.tenantId,
        tenantName: t.tenant.name,
        role: t.role,
        unitId: t.unitId,
        unit: t.unit,
      })),
  };
}

async function getMyDevices(userId) {
  return prisma.deviceSession.findMany({
    where: { userId, isActive: true },
    select: { id: true, deviceId: true, deviceName: true, platform: true, lastSeenAt: true, createdAt: true },
    orderBy: { lastSeenAt: 'desc' },
  });
}

module.exports = { login, register, refreshAccessToken, changePassword, updateFCMToken, getMe, getMyDevices };
