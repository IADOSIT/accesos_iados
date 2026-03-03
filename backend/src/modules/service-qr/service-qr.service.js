const { v4: uuidv4 } = require('uuid');
const prisma = require('../../config/database');
const mqttService = require('../../services/mqtt');
const notif = require('../../services/notification');

// ── QR rotativo por tenant ──────────────────────────────────────────────────

async function getOrCreateQR(tenantId) {
  let qr = await prisma.serviceQR.findUnique({ where: { tenantId } });
  if (!qr) {
    qr = await prisma.serviceQR.create({ data: { tenantId, code: uuidv4() } });
  }
  return qr;
}

async function rotateQR(tenantId) {
  const code = uuidv4();
  return prisma.serviceQR.upsert({
    where: { tenantId },
    update: { code },
    create: { tenantId, code },
  });
}

// ── Info pública (para la página del visitante) ─────────────────────────────

async function getPublicInfo(code) {
  const qr = await prisma.serviceQR.findUnique({
    where: { code },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          settings: true,
          units: {
            where: { isActive: true },
            select: { id: true, identifier: true, block: true, ownerPhone: true, ownerName: true },
            orderBy: [{ block: 'asc' }, { identifier: 'asc' }],
          },
        },
      },
    },
  });

  if (!qr) throw { status: 404, message: 'Código QR no válido o no encontrado' };

  const settings = (qr.tenant.settings && typeof qr.tenant.settings === 'object') ? qr.tenant.settings : {};
  const cfg = (settings.serviceQrConfig && typeof settings.serviceQrConfig === 'object') ? settings.serviceQrConfig : {};

  return {
    tenantId: qr.tenant.id,
    tenantName: qr.tenant.name,
    qrId: qr.id,
    services: Array.isArray(cfg.services) ? cfg.services : [],
    showResidentPhone: cfg.showResidentPhone === true,
    requireUnit: cfg.requireUnit === true,
    requirePhoto: cfg.requirePhoto === true,
    units: qr.tenant.units.map(u => ({
      id: u.id,
      identifier: u.identifier,
      block: u.block || null,
      phone: cfg.showResidentPhone ? (u.ownerPhone || null) : undefined,
      ownerFirstName: u.ownerName ? u.ownerName.trim().split(/\s+/)[0] : null,
    })),
  };
}

// ── Crear solicitud (visitante) ─────────────────────────────────────────────

async function submitRequest(tenantId, qrId, data) {
  const { unitId, service, photoData, visitorPhone } = data;

  // Validar que el QR pertenece al tenant
  const qr = await prisma.serviceQR.findFirst({ where: { id: qrId, tenantId } });
  if (!qr) throw { status: 400, message: 'QR inválido' };

  // Obtener config
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const settings = (tenant?.settings && typeof tenant.settings === 'object') ? tenant.settings : {};
  const cfg = (settings.serviceQrConfig && typeof settings.serviceQrConfig === 'object') ? settings.serviceQrConfig : {};

  const ttlMinutes = cfg.requestTtlMinutes || 30;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const request = await prisma.serviceRequest.create({
    data: {
      tenantId,
      qrId,
      unitId: unitId || null,
      service,
      photoData: photoData || null,
      visitorPhone: visitorPhone || null,
      expiresAt,
    },
    include: {
      unit: { select: { id: true, identifier: true, block: true } },
    },
  });

  const unitLabel = request.unit
    ? `Unidad ${request.unit.identifier}${request.unit.block ? ` – Manzana ${request.unit.block}` : ''}`
    : 'Sin unidad';

  const title = `🔔 Solicitud: ${service}`;
  const body = unitLabel;
  const fcmData = {
    type: 'SERVICE_REQUEST',
    requestId: request.id,
    service,
    unitLabel,
    unitId: unitId || '',
    unitIdentifier: request.unit?.identifier || '',
    visitorPhone: visitorPhone || '',
    hasPhoto: photoData ? 'true' : 'false',
    expiresAt: expiresAt.toISOString(),
    tenantId,
  };

  // Notificar al residente de la unidad (siempre, urgente)
  if (unitId) {
    notif.sendUrgentToUnit(tenantId, unitId, 'SERVICE_REQUEST', title, body, fcmData);
  }

  // Notificar a GUARD y ADMIN (siempre, urgente)
  notif.sendUrgentToRole(tenantId, 'GUARD', 'SERVICE_REQUEST', title, body, fcmData);
  notif.sendUrgentToRole(tenantId, 'ADMIN', 'SERVICE_REQUEST', title, body, fcmData);

  return { id: request.id, expiresAt, service, unitLabel };
}

// ── Listar solicitudes (autenticado) ────────────────────────────────────────

async function listRequests(tenantId, userId, role, { skip, limit, status }) {
  const where = { tenantId };

  // RESIDENT: solo ve las de su propia unidad
  if (role === 'RESIDENT') {
    const ut = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { unitId: true },
    });
    if (!ut?.unitId) return { data: [], total: 0 };
    where.unitId = ut.unitId;
  }

  if (status) where.status = status;

  const [rows, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      select: {
        id: true, service: true, status: true, visitorPhone: true,
        photoData: true,
        expiresAt: true, approvedAt: true, approvedById: true, notes: true,
        createdAt: true,
        unit: { select: { identifier: true, block: true } },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return {
    data: rows.map(({ photoData, ...r }) => ({ ...r, hasPhoto: !!photoData })),
    total,
  };
}

// ── Obtener solicitud individual (con foto) ──────────────────────────────────

async function getRequest(tenantId, requestId, userId, role) {
  const where = { id: requestId, tenantId };

  const request = await prisma.serviceRequest.findFirst({
    where,
    include: {
      unit: { select: { identifier: true, block: true } },
    },
  });
  if (!request) throw { status: 404, message: 'Solicitud no encontrada' };

  // RESIDENT: solo puede ver la de su unidad
  if (role === 'RESIDENT') {
    const ut = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { unitId: true },
    });
    if (request.unitId !== ut?.unitId) throw { status: 403, message: 'Sin acceso a esta solicitud' };
  }

  return {
    ...request,
    hasPhoto: !!request.photoData,
  };
}

// ── Aprobar solicitud ────────────────────────────────────────────────────────

async function approveRequest(tenantId, requestId, userId, role) {
  const request = await prisma.serviceRequest.findFirst({
    where: { id: requestId, tenantId },
    include: { unit: { select: { identifier: true } } },
  });
  if (!request) throw { status: 404, message: 'Solicitud no encontrada' };
  if (request.status !== 'PENDING') throw { status: 400, message: 'La solicitud ya fue procesada' };
  if (new Date() > request.expiresAt) throw { status: 400, message: 'La solicitud ha expirado' };

  // Verificar permisos según config
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const settings = (tenant?.settings && typeof tenant.settings === 'object') ? tenant.settings : {};
  const cfg = (settings.serviceQrConfig && typeof settings.serviceQrConfig === 'object') ? settings.serviceQrConfig : {};

  if (role === 'RESIDENT') {
    // Solo puede aprobar si es residente de esa unidad
    const ut = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { unitId: true },
    });
    if (request.unitId && ut?.unitId !== request.unitId) throw { status: 403, message: 'Sin permiso para aprobar esta solicitud' };
  } else if (role === 'GUARD' && !cfg.guardCanApprove) {
    throw { status: 403, message: 'Guardia solo puede visualizar — no tiene permiso de aprobación' };
  } else if (role === 'ADMIN' && cfg.adminCanApprove === false) {
    throw { status: 403, message: 'Admin solo puede visualizar — no tiene permiso de aprobación' };
  }

  // Activar dispositivo (si está configurado)
  const deviceId = cfg.deviceId || null;
  if (deviceId) {
    const device = await prisma.device.findFirst({ where: { id: deviceId, tenantId, isActive: true } });
    if (device?.mqttTopic) {
      const prefix = device.mqttTopic.split('/')[0];
      mqttService.publish(`${prefix}/rpc`, JSON.stringify({
        id: Date.now(),
        src: 'iados',
        method: 'Switch.Set',
        params: { id: 0, on: true, toggle_after: 2 },
      }));
    }
  }

  const updated = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      status: 'APPROVED',
      approvedById: userId,
      approvedAt: new Date(),
      deviceId: deviceId || null,
    },
    include: { unit: { select: { identifier: true } } },
  });

  return updated;
}

// ── Rechazar solicitud ───────────────────────────────────────────────────────

async function rejectRequest(tenantId, requestId, userId, role, notes) {
  const request = await prisma.serviceRequest.findFirst({ where: { id: requestId, tenantId } });
  if (!request) throw { status: 404, message: 'Solicitud no encontrada' };
  if (request.status !== 'PENDING') throw { status: 400, message: 'La solicitud ya fue procesada' };

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const settings = (tenant?.settings && typeof tenant.settings === 'object') ? tenant.settings : {};
  const cfg = (settings.serviceQrConfig && typeof settings.serviceQrConfig === 'object') ? settings.serviceQrConfig : {};

  if (role === 'RESIDENT') {
    const ut = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { unitId: true },
    });
    if (request.unitId && ut?.unitId !== request.unitId) throw { status: 403, message: 'Sin permiso' };
  } else if (role === 'GUARD' && !cfg.guardCanApprove) {
    throw { status: 403, message: 'Sin permiso de aprobación/rechazo' };
  }

  return prisma.serviceRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', approvedById: userId, approvedAt: new Date(), notes: notes || null },
  });
}

// ── Cron: expirar solicitudes vencidas ───────────────────────────────────────

async function expireStaleRequests() {
  const result = await prisma.serviceRequest.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  if (result.count > 0) {
    console.log(`[ServiceQR] ${result.count} solicitud(es) expirada(s)`);
  }
  return result.count;
}

// ── Cron: rotar QRs según configuración ─────────────────────────────────────

async function rotateExpiredQRs() {
  const tenants = await prisma.serviceQR.findMany({
    include: {
      tenant: { select: { settings: true } },
    },
  });

  let rotated = 0;
  for (const qr of tenants) {
    const settings = (qr.tenant.settings && typeof qr.tenant.settings === 'object') ? qr.tenant.settings : {};
    const cfg = (settings.serviceQrConfig && typeof settings.serviceQrConfig === 'object') ? settings.serviceQrConfig : {};
    const rotateDays = cfg.rotateDays || 7;

    const ageMs = Date.now() - new Date(qr.updatedAt).getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);

    if (ageDays >= rotateDays) {
      await prisma.serviceQR.update({ where: { id: qr.id }, data: { code: uuidv4() } });
      rotated++;
    }
  }

  if (rotated > 0) console.log(`[ServiceQR] ${rotated} QR(s) rotado(s)`);
  return rotated;
}

module.exports = {
  getOrCreateQR,
  rotateQR,
  getPublicInfo,
  submitRequest,
  listRequests,
  getRequest,
  approveRequest,
  rejectRequest,
  expireStaleRequests,
  rotateExpiredQRs,
};
