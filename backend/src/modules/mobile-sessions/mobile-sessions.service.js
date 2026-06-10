const prisma = require('../../config/database');

async function getSessionsByUnit(tenantId, unitId) {
  const residents = await prisma.userTenant.findMany({
    where: { tenantId, unitId, isActive: true },
    select: { userId: true, user: { select: { firstName: true, lastName: true, email: true } } },
  });

  const userIds = residents.map(r => r.userId);
  if (!userIds.length) return [];

  const sessions = await prisma.deviceSession.findMany({
    where: { userId: { in: userIds } },
    orderBy: { lastSeenAt: 'desc' },
  });

  const userMap = Object.fromEntries(
    residents.map(r => [r.userId, r.user])
  );

  return sessions.map(s => ({
    ...s,
    user: userMap[s.userId] || null,
  }));
}

async function getSessionsByUser(tenantId, userId) {
  // Verify user belongs to tenant
  const membership = await prisma.userTenant.findFirst({
    where: { tenantId, userId, isActive: true },
  });
  if (!membership) throw { status: 404, message: 'Usuario no encontrado en este fraccionamiento' };

  return prisma.deviceSession.findMany({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
  });
}

async function revokeSession(tenantId, sessionId) {
  const session = await prisma.deviceSession.findUnique({ where: { id: sessionId } });
  if (!session) throw { status: 404, message: 'Sesión no encontrada' };

  // Verify user belongs to tenant
  const membership = await prisma.userTenant.findFirst({
    where: { tenantId, userId: session.userId, isActive: true },
  });
  if (!membership) throw { status: 403, message: 'Sin acceso' };

  return prisma.deviceSession.update({
    where: { id: sessionId },
    data: { isActive: false, fcmToken: null },
  });
}

async function revokeAllForUser(tenantId, userId) {
  const membership = await prisma.userTenant.findFirst({
    where: { tenantId, userId, isActive: true },
  });
  if (!membership) throw { status: 404, message: 'Usuario no encontrado en este fraccionamiento' };

  const { count } = await prisma.deviceSession.updateMany({
    where: { userId },
    data: { isActive: false, fcmToken: null },
  });
  return { revoked: count };
}

async function revokeAllForUnit(tenantId, unitId) {
  const residents = await prisma.userTenant.findMany({
    where: { tenantId, unitId, isActive: true },
    select: { userId: true },
  });
  if (!residents.length) return { revoked: 0 };

  const userIds = residents.map(r => r.userId);
  const { count } = await prisma.deviceSession.updateMany({
    where: { userId: { in: userIds } },
    data: { isActive: false, fcmToken: null },
  });
  return { revoked: count };
}

async function setUnitMaxDevices(tenantId, unitId, maxDevices) {
  const unit = await prisma.unit.findFirst({ where: { id: unitId, tenantId } });
  if (!unit) throw { status: 404, message: 'Unidad no encontrada' };
  return prisma.unit.update({
    where: { id: unitId },
    data: { maxDevices },
  });
}

async function setUserMaxDevicesOverride(tenantId, userId, maxDevicesOverride) {
  const membership = await prisma.userTenant.findFirst({
    where: { tenantId, userId, isActive: true },
  });
  if (!membership) throw { status: 404, message: 'Usuario no encontrado en este fraccionamiento' };
  return prisma.user.update({
    where: { id: userId },
    data: { maxDevicesOverride },
  });
}

module.exports = {
  getSessionsByUnit,
  getSessionsByUser,
  revokeSession,
  revokeAllForUser,
  revokeAllForUnit,
  setUnitMaxDevices,
  setUserMaxDevicesOverride,
};
