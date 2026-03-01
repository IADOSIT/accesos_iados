const prisma = require('../../config/database');
const notifService = require('../../services/notification');

async function getForUser(userId, tenantId) {
  return prisma.notification.findMany({
    where: { userId, tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

async function getUnreadCount(userId, tenantId) {
  return prisma.notification.count({
    where: { userId, tenantId, readAt: null },
  });
}

async function markAllRead(userId, tenantId) {
  return prisma.notification.updateMany({
    where: { userId, tenantId, readAt: null },
    data: { readAt: new Date() },
  });
}

async function getConfig(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const defaults = {
    accessDenied: true,
    qrUsed: true,
    newCharge: true,
    paymentConfirmed: true,
    deviceOffline: true,
  };
  const saved = tenant?.settings?.notifications;
  return saved ? { ...defaults, ...saved } : defaults;
}

async function updateConfig(tenantId, config) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const current = tenant?.settings || {};
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { ...current, notifications: config } },
  });
  return config;
}

async function getHistory(tenantId, { skip, limit }) {
  const [raw, total] = await Promise.all([
    prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { tenantId } }),
  ]);

  // Enriquecer con nombre de usuario
  const userIds = [...new Set(raw.map(n => n.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const data = raw.map(n => ({ ...n, user: userMap[n.userId] }));

  return { data, total };
}

async function broadcast(tenantId, { target, userId, unitId, role, title, body }) {
  if (!title || !body) throw { status: 400, message: 'Título y mensaje son requeridos' };

  switch (target) {
    case 'USER':
      if (!userId) throw { status: 400, message: 'userId requerido' };
      await notifService.sendToUser(userId, tenantId, 'MANUAL', title, body, {});
      break;
    case 'UNIT':
      if (!unitId) throw { status: 400, message: 'unitId requerido' };
      notifService.sendToUnit(tenantId, unitId, 'MANUAL', title, body, {});
      break;
    case 'ROLE':
      if (!role) throw { status: 400, message: 'role requerido' };
      notifService.sendToRole(tenantId, role, 'MANUAL', title, body, {});
      break;
    case 'ALL':
      notifService.sendToAll(tenantId, 'MANUAL', title, body, {});
      break;
    default:
      throw { status: 400, message: 'target inválido. Usa: USER, UNIT, ROLE, ALL' };
  }

  return { queued: true };
}

module.exports = { getForUser, getUnreadCount, markAllRead, getConfig, updateConfig, getHistory, broadcast };
