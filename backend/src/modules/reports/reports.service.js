const prisma = require('../../config/database');

async function accessByRange(tenantId, from, to) {
  const where = { tenantId };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [total, granted, denied, byMethod, byDevice] = await Promise.all([
    prisma.accessLog.count({ where }),
    prisma.accessLog.count({ where: { ...where, granted: true } }),
    prisma.accessLog.count({ where: { ...where, granted: false } }),
    prisma.accessLog.groupBy({ by: ['method'], where, _count: true }),
    prisma.accessLog.groupBy({ by: ['deviceId'], where, _count: true }),
  ]);

  return { total, granted, denied, byMethod, byDevice };
}

async function paymentsByPeriod(tenantId, from, to) {
  const where = { tenantId };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [payments, totalAmount, byMethod] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where, _sum: { amount: true } }),
    prisma.payment.groupBy({ by: ['method'], where, _count: true, _sum: { amount: true } }),
  ]);

  return { totalPayments: payments, totalAmount: totalAmount._sum.amount || 0, byMethod };
}

async function delinquencyReport(tenantId) {
  const [totalUnits, delinquentUnits, totalPendingCharges, totalPendingAmount] = await Promise.all([
    prisma.unit.count({ where: { tenantId, isActive: true } }),
    prisma.unit.count({ where: { tenantId, isActive: true, isDelinquent: true } }),
    prisma.charge.count({ where: { tenantId, status: { in: ['PENDING', 'PARTIAL'] } } }),
    prisma.charge.aggregate({
      where: { tenantId, status: { in: ['PENDING', 'PARTIAL'] } },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalUnits,
    delinquentUnits,
    delinquencyRate: totalUnits > 0 ? ((delinquentUnits / totalUnits) * 100).toFixed(1) : 0,
    totalPendingCharges,
    totalPendingAmount: totalPendingAmount._sum.amount || 0,
  };
}

async function guardActivity(tenantId, from, to) {
  const where = { tenantId, method: 'GUARD_OVERRIDE' };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const activity = await prisma.accessLog.groupBy({
    by: ['userId'],
    where,
    _count: true,
  });

  // Obtener nombres de guardias
  const userIds = activity.map(a => a.userId).filter(Boolean);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  const userMap = Object.fromEntries(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

  return activity.map(a => ({
    userId: a.userId,
    guardName: userMap[a.userId] || 'Desconocido',
    totalActions: a._count,
  }));
}

async function unitUsage(tenantId, from, to) {
  const where = { tenantId };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const usage = await prisma.accessLog.groupBy({
    by: ['unitId'],
    where: { ...where, unitId: { not: null } },
    _count: true,
    orderBy: { _count: { unitId: 'desc' } },
    take: 50,
  });

  const unitIds = usage.map(u => u.unitId).filter(Boolean);
  const units = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    select: { id: true, identifier: true },
  });

  const unitMap = Object.fromEntries(units.map(u => [u.id, u.identifier]));

  return usage.map(u => ({
    unitId: u.unitId,
    identifier: unitMap[u.unitId] || 'N/A',
    totalAccesses: u._count,
  }));
}

async function dashboard(tenantId) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUnits,
    activeUsers,
    delinquentUnits,
    todayAccesses,
    monthPayments,
    onlineDevices,
  ] = await Promise.all([
    prisma.unit.count({ where: { tenantId, isActive: true } }),
    prisma.userTenant.count({ where: { tenantId, isActive: true } }),
    prisma.unit.count({ where: { tenantId, isDelinquent: true, isActive: true } }),
    prisma.accessLog.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
    prisma.payment.aggregate({
      where: { tenantId, createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.device.count({ where: { tenantId, status: 'ONLINE', isActive: true } }),
  ]);

  return {
    totalUnits,
    activeUsers,
    delinquentUnits,
    todayAccesses,
    monthPayments: {
      count: monthPayments._count,
      total: monthPayments._sum.amount || 0,
    },
    onlineDevices,
  };
}

module.exports = { accessByRange, paymentsByPeriod, delinquencyReport, guardActivity, unitUsage, dashboard };
