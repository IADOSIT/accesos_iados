const prisma = require('../../config/database');
const unitsService = require('../units/units.service');
const notif = require('../../services/notification');

async function createCharge(tenantId, data) {
  const charge = await prisma.charge.create({
    data: { ...data, tenantId, dueDate: new Date(data.dueDate) },
  });
  // Recalcular morosidad
  await unitsService.checkDelinquency(tenantId);
  // Notificar nuevo cargo a la unidad
  if (data.unitId) {
    notif.sendToUnit(tenantId, data.unitId, 'NEW_CHARGE', 'Nuevo cargo registrado', `${data.description || 'Cargo'} — $${data.amount}`, { chargeId: charge.id });
  }
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
  // Notificar pago confirmado a la unidad
  if (data.unitId) {
    notif.sendToUnit(tenantId, data.unitId, 'PAYMENT_CONFIRMED', 'Pago recibido', `Tu pago de $${data.amount} fue registrado`, { paymentId: payment.id });
  }
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

async function bulkPayments(tenantId, { month, year, payments }) {
  const paid = payments.filter(p => p.paid && Number(p.amount) > 0);
  if (paid.length > 0) {
    const ref = `CSV-${year}-${String(month).padStart(2, '0')}`;
    await Promise.all(
      paid.map(p =>
        prisma.payment.create({
          data: {
            tenantId,
            unitId: p.unitId,
            amount: Number(p.amount),
            method: 'TRANSFER',
            reference: ref,
            notes: 'Carga masiva CSV',
            reconciled: false,
          },
        })
      )
    );
    await unitsService.checkDelinquency(tenantId);
  }
  return {
    total: payments.length,
    paid: paid.length,
    pending: payments.length - paid.length,
    amount: paid.reduce((s, p) => s + Number(p.amount), 0),
  };
}

module.exports = { createCharge, createPayment, getCharges, getPayments, reconcile, getDelinquentUnits, bulkPayments };
