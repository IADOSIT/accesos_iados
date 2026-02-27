const prisma = require('../../config/database');
const unitsService = require('../units/units.service');

async function createCharge(tenantId, data) {
  const charge = await prisma.charge.create({
    data: { ...data, tenantId, dueDate: new Date(data.dueDate) },
  });
  // Recalcular morosidad
  await unitsService.checkDelinquency(tenantId);
  return charge;
}

async function createPayment(tenantId, data) {
  const payment = await prisma.payment.create({
    data: { ...data, tenantId },
  });

  // Si tiene cargo asociado, actualizar monto pagado
  if (data.chargeId) {
    const charge = await prisma.charge.findUnique({ where: { id: data.chargeId } });
    if (charge) {
      const newPaid = parseFloat(charge.paidAmount) + data.amount;
      const status = newPaid >= parseFloat(charge.amount) ? 'PAID' : 'PARTIAL';
      await prisma.charge.update({
        where: { id: data.chargeId },
        data: { paidAmount: newPaid, status },
      });
    }
  }

  // Recalcular morosidad
  await unitsService.checkDelinquency(tenantId);
  return payment;
}

async function getCharges(tenantId, { skip, limit, unitId, status }) {
  const where = { tenantId };
  if (unitId) where.unitId = unitId;
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.charge.findMany({
      where,
      include: { unit: { select: { identifier: true } } },
      skip,
      take: limit,
      orderBy: { dueDate: 'desc' },
    }),
    prisma.charge.count({ where }),
  ]);
  return { data, total };
}

async function getPayments(tenantId, { skip, limit, unitId, from, to }) {
  const where = { tenantId };
  if (unitId) where.unitId = unitId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        unit: { select: { identifier: true } },
        charge: { select: { description: true, type: true } },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.count({ where }),
  ]);
  return { data, total };
}

async function reconcile(tenantId, paymentIds) {
  await prisma.payment.updateMany({
    where: { tenantId, id: { in: paymentIds } },
    data: { reconciled: true },
  });
}

async function getDelinquentUnits(tenantId) {
  return prisma.unit.findMany({
    where: { tenantId, isDelinquent: true, isActive: true },
    include: {
      charges: { where: { status: { in: ['PENDING', 'PARTIAL'] } }, orderBy: { dueDate: 'asc' } },
      residents: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
    },
    orderBy: { identifier: 'asc' },
  });
}

module.exports = { createCharge, createPayment, getCharges, getPayments, reconcile, getDelinquentUnits };
