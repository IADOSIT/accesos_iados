const { v4: uuidv4 } = require('uuid');
const prisma = require('../../config/database');
const env = require('../../config/env');
const mqttService = require('../../services/mqtt');
const notif = require('../../services/notification');

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
      notif.sendToUnit(tenantId, resolvedUnitId, 'ACCESS_DENIED', 'Acceso denegado', 'Tu unidad tiene un adeudo pendiente', { deviceId: device.id });
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
    notif.sendToUnit(tenantId, qr.unitId, 'ACCESS_DENIED', 'Acceso denegado', 'Tu unidad tiene un adeudo pendiente', { deviceId: device.id });
    throw { status: 403, message: 'Acceso denegado: unidad con adeudo pendiente' };
  }

  // Incrementar usos
  await prisma.qRCode.update({ where: { id: qr.id }, data: { usedCount: { increment: 1 } } });

  return executeOpen(tenantId, qr.unitId, userId, device, 'QR', 'ENTRY', true, `Acceso QR: ${qr.visitorName}`, visitorName || qr.visitorName, visitorPlate, notes);
}

async function executeOpen(tenantId, unitId, userId, device, method, direction, granted, reason, visitorName, visitorPlate, notes) {
  // Enviar comando MQTT al dispositivo
  if (device.mqttTopic) {
    // Shelly Plus 1 (Gen 2) usa RPC sobre MQTT
    // Topic: shellyplus1-{id}/rpc
    // toggle_after: apaga el relay automáticamente después de 2 segundos (pulso para portón)
    const prefix = device.mqttTopic.split('/')[0]; // shellyplus1-fcb46728f5c4
    const rpcTopic = `${prefix}/rpc`;
    mqttService.publish(rpcTopic, JSON.stringify({
      id: Date.now(),
      src: 'iados',
      method: 'Switch.Set',
      params: { id: 0, on: true, toggle_after: 2 },
    }));
  }

  // Registrar cooldown
  if (userId) {
    cooldownMap.set(`${userId}-${device.id}`, Date.now());
  }

  // Crear log
  const log = await createLog(tenantId, unitId, userId, device.id, method, direction, granted, reason, visitorName, visitorPlate, notes);

  // Notificar QR usado exitosamente
  if (granted && method === 'QR' && unitId) {
    notif.sendToUnit(tenantId, unitId, 'QR_USED', 'Visita en puerta', `QR utilizado — ${log.visitorName || 'visitante'}`, { deviceId: device.id });
  }

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

async function createQuickQr(tenantId, userId, data) {
  // Obtener settings del tenant
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const settings = (tenant?.settings && typeof tenant.settings === 'object') ? tenant.settings : {};
  const flags = (settings.featureFlags && typeof settings.featureFlags === 'object') ? settings.featureFlags : {};

  if (!flags.quickQrEnabled) {
    throw { status: 403, message: 'QR rápido no habilitado para este fraccionamiento' };
  }

  // Obtener unidad del usuario
  const ut = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  if (!ut?.unitId) throw { status: 400, message: 'Usuario sin unidad asignada' };

  const durationHours = flags.quickQrDurationHours ?? 2;
  const maxUses = flags.quickQrMaxUses ?? 3;

  const code = `IAD-${uuidv4().slice(0, 8).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  const qr = await prisma.qRCode.create({
    data: {
      tenantId,
      unitId: ut.unitId,
      userId,
      code,
      visitorName: data.category || 'Visita rápida',
      maxUses,
      expiresAt,
      category: data.category,
      isQuick: true,
    },
  });

  const portalUrl = process.env.PORTAL_URL || 'http://34.71.132.26:3002';

  return { ...qr, externalUrl: `${portalUrl}/qr/${qr.code}` };
}

async function getPublicQR(code) {
  const qr = await prisma.qRCode.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      visitorName: true,
      category: true,
      isQuick: true,
      maxUses: true,
      usedCount: true,
      expiresAt: true,
      isActive: true,
      unit: { select: { identifier: true } },
    },
  });
  if (!qr) throw { status: 404, message: 'Código QR no encontrado' };
  return qr;
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

// ── Botón de pánico ────────────────────────────────────────────
const PANIC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

async function triggerPanic(userId, tenantId) {
  // Cooldown: verificar si ya activó pánico en los últimos 5 minutos
  const since = new Date(Date.now() - PANIC_COOLDOWN_MS);
  const recent = await prisma.panicAlert.findFirst({
    where: { userId, tenantId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const elapsed = Date.now() - new Date(recent.createdAt).getTime();
    const remainingSeconds = Math.ceil((PANIC_COOLDOWN_MS - elapsed) / 1000);
    throw { status: 429, message: `Alerta reciente. Espera ${remainingSeconds} segundos.`, remainingSeconds };
  }

  // Obtener info del usuario y su unidad
  const membership = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: {
      user:   { select: { firstName: true, lastName: true, phone: true } },
      unit:   { select: { id: true, identifier: true, block: true, floor: true, ownerPhone: true } },
      tenant: { select: { name: true } },
    },
  });

  const firstName  = membership?.user?.firstName || '';
  const lastName   = membership?.user?.lastName  || '';
  const userName   = `${firstName} ${lastName}`.trim() || 'Un usuario';
  const phone      = membership?.user?.phone || membership?.unit?.ownerPhone || '';
  const unitId_val = membership?.unit?.identifier || '';
  const block_val  = membership?.unit?.block || '';
  const floor_val  = membership?.unit?.floor || '';
  const unitLabel  = unitId_val ? `Unidad ${unitId_val}${block_val ? ` – Manzana ${block_val}` : ''}${floor_val ? ` Piso ${floor_val}` : ''}` : null;
  const tenantName = membership?.tenant?.name || 'Fraccionamiento';

  // Guardar en BD
  await prisma.panicAlert.create({
    data: {
      tenantId,
      userId,
      unitId:    membership?.unit?.id ?? null,
      userName,
      unitLabel: unitLabel ?? null,
    },
  });

  // Enviar notificación urgente a ADMIN y GUARD
  const title = `🚨 EMERGENCIA — ${tenantName}`;
  const body  = unitLabel
    ? `${userName} (${unitLabel}) activó el botón de pánico`
    : `${userName} activó el botón de pánico`;
  const data  = {
    type: 'PANIC',
    userId,
    userName,
    unitLabel: unitLabel || '',
    phone,
    unitIdentifier: unitId_val,
    block: block_val,
  };

  notif.sendUrgentToRole(tenantId, 'ADMIN',    'PANIC', title, body, data);
  notif.sendUrgentToRole(tenantId, 'GUARD',    'PANIC', title, body, data);
  notif.sendUrgentToRole(tenantId, 'RESIDENT', 'PANIC', title, body, data);

  return { cooldownSeconds: PANIC_COOLDOWN_MS / 1000 };
}

module.exports = { openGate, generateQR, getQRCodes, getLogs, revokeQR, cleanupExpiredQRs, createQuickQr, getPublicQR, triggerPanic };
