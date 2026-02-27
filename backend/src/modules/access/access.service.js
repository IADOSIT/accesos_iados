const { v4: uuidv4 } = require('uuid');
const prisma = require('../../config/database');
const env = require('../../config/env');
const mqttService = require('../../services/mqtt');

// Cache en memoria para cooldown anti-spam
const cooldownMap = new Map();

async function openGate(tenantId, userId, data) {
  const { deviceId, method, direction, qrCode, visitorName, visitorPlate, notes, unitId } = data;

  // Obtener dispositivo
  const device = await prisma.device.findFirst({ where: { id: deviceId, tenantId, isActive: true } });
  if (!device) throw { status: 404, message: 'Dispositivo no encontrado' };

  // Determinar unidad del usuario
  let resolvedUnitId = unitId;
  if (!resolvedUnitId && userId) {
    const ut = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    resolvedUnitId = ut?.unitId;
  }

  // SALIDA siempre permitida
  if (direction === 'EXIT') {
    return executeOpen(tenantId, resolvedUnitId, userId, device, method, direction, true, 'Salida permitida', visitorName, visitorPlate, notes);
  }

  // Validar QR si el método es QR
  if (method === 'QR') {
    return handleQRAccess(tenantId, userId, device, qrCode, visitorName, visitorPlate, notes);
  }

  // GUARD_OVERRIDE siempre permitido (con registro)
  if (method === 'GUARD_OVERRIDE') {
    return executeOpen(tenantId, resolvedUnitId, userId, device, method, direction, true, 'Apertura manual por guardia', visitorName, visitorPlate, notes);
  }

  // Para apertura por APP: verificar morosidad
  if (method === 'APP' && resolvedUnitId) {
    const unit = await prisma.unit.findUnique({ where: { id: resolvedUnitId } });
    if (unit?.isDelinquent) {
      // Registrar intento denegado
      await createLog(tenantId, resolvedUnitId, userId, device.id, method, direction, false, 'Acceso denegado por morosidad', visitorName, visitorPlate, notes);
      throw { status: 403, message: 'Acceso denegado: unidad con adeudo pendiente' };
    }
  }

  // Cooldown anti-spam
  const cooldownKey = `${userId}-${deviceId}`;
  const lastAccess = cooldownMap.get(cooldownKey);
  if (lastAccess && (Date.now() - lastAccess) < env.ACCESS_COOLDOWN_SECONDS * 1000) {
    const remaining = Math.ceil((env.ACCESS_COOLDOWN_SECONDS * 1000 - (Date.now() - lastAccess)) / 1000);
    throw { status: 429, message: `Espera ${remaining} segundos antes de intentar de nuevo` };
  }

  return executeOpen(tenantId, resolvedUnitId, userId, device, method, direction, true, 'Acceso concedido', visitorName, visitorPlate, notes);
}

async function handleQRAccess(tenantId, userId, device, code, visitorName, visitorPlate, notes) {
  if (!code) throw { status: 400, message: 'Código QR requerido' };

  const qr = await prisma.qRCode.findUnique({ where: { code } });
  if (!qr || qr.tenantId !== tenantId) {
    await createLog(tenantId, null, userId, device.id, 'QR', 'ENTRY', false, 'QR inválido', visitorName, visitorPlate, notes);
    throw { status: 400, message: 'Código QR inválido' };
  }

  if (!qr.isActive || qr.expiresAt < new Date() || qr.usedCount >= qr.maxUses) {
    await createLog(tenantId, qr.unitId, userId, device.id, 'QR', 'ENTRY', false, 'QR expirado o agotado', visitorName, visitorPlate, notes);
    throw { status: 400, message: 'Código QR expirado o usos agotados' };
  }

  // Verificar morosidad de la unidad del QR
  const unit = await prisma.unit.findUnique({ where: { id: qr.unitId } });
  if (unit?.isDelinquent) {
    await createLog(tenantId, qr.unitId, userId, device.id, 'QR', 'ENTRY', false, 'Acceso denegado por morosidad', visitorName, visitorPlate, notes);
    throw { status: 403, message: 'Acceso denegado: unidad con adeudo pendiente' };
  }

  // Incrementar usos
  await prisma.qRCode.update({ where: { id: qr.id }, data: { usedCount: { increment: 1 } } });

  return executeOpen(tenantId, qr.unitId, userId, device, 'QR', 'ENTRY', true, `Acceso QR: ${qr.visitorName}`, visitorName || qr.visitorName, visitorPlate, notes);
}

async function executeOpen(tenantId, unitId, userId, device, method, direction, granted, reason, visitorName, visitorPlate, notes) {
  // Enviar comando MQTT al dispositivo
  if (device.mqttTopic) {
    mqttService.publish(device.mqttTopic, JSON.stringify({ action: 'OPEN', direction, timestamp: Date.now() }));
  }

  // Registrar cooldown
  if (userId) {
    cooldownMap.set(`${userId}-${device.id}`, Date.now());
  }

  // Crear log
  const log = await createLog(tenantId, unitId, userId, device.id, method, direction, granted, reason, visitorName, visitorPlate, notes);

  return { granted, reason, log };
}

async function createLog(tenantId, unitId, userId, deviceId, method, direction, granted, reason, visitorName, visitorPlate, notes) {
  return prisma.accessLog.create({
    data: { tenantId, unitId, userId, deviceId, method, direction, granted, reason, visitorName, visitorPlate, notes },
  });
}

async function generateQR(tenantId, userId, unitId, data) {
  const code = `IAD-${uuidv4().slice(0, 8).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000);

  const qr = await prisma.qRCode.create({
    data: {
      tenantId,
      unitId,
      userId,
      code,
      visitorName: data.visitorName,
      maxUses: data.maxUses,
      expiresAt,
    },
  });

  return qr;
}

async function getLogs(tenantId, { skip, limit, unitId, method, from, to }) {
  const where = { tenantId };
  if (unitId) where.unitId = unitId;
  if (method) where.method = method;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [data, total] = await Promise.all([
    prisma.accessLog.findMany({
      where,
      include: {
        unit: { select: { identifier: true } },
        user: { select: { firstName: true, lastName: true } },
        device: { select: { name: true } },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.accessLog.count({ where }),
  ]);

  return { data, total };
}

async function getQRCodes(tenantId, userId, { skip, limit }) {
  const where = { tenantId, userId };
  const [data, total] = await Promise.all([
    prisma.qRCode.findMany({
      where,
      include: { unit: { select: { identifier: true } } },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.qRCode.count({ where }),
  ]);
  return { data, total };
}

async function revokeQR(tenantId, userId, userRole, qrId) {
  const qr = await prisma.qRCode.findFirst({ where: { id: qrId, tenantId } });
  if (!qr) throw { status: 404, message: 'Código QR no encontrado' };
  if (userRole === 'RESIDENT' && qr.userId !== userId) {
    throw { status: 403, message: 'Sin permiso para revocar este QR' };
  }
  return prisma.qRCode.update({ where: { id: qrId }, data: { isActive: false } });
}

async function cleanupExpiredQRs() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.qRCode.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    console.log(`[Cleanup] Eliminados ${result.count} QR(s) expirados (>30 días)`);
  }
  return result.count;
}

module.exports = { openGate, generateQR, getQRCodes, getLogs, revokeQR, cleanupExpiredQRs };
