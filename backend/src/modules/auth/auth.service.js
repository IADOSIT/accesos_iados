const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const env = require('../../config/env');

async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenants: { include: { tenant: true } } },
  });

  if (!user || !user.isActive) {
    throw { status: 401, message: 'Credenciales inválidas' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw { status: 401, message: 'Credenciales inválidas' };
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
    include: { tenants: { include: { tenant: true } } },
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
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

module.exports = { login, register, refreshAccessToken, changePassword };
