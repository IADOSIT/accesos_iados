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

async function getCharges(tenantId, { skip, limit, unitId, status, from, to }) {
  const where = { tenantId };
  if (unitId) where.unitId = unitId;
  if (status) where.status = status;
  if (from || to) {
    where.dueDate = {};
    if (from) where.dueDate.gte = new Date(from);
    if (to) where.dueDate.lte = new Date(to);
  }

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

async function getDelinquentUnits(tenantId, { skip = 0, limit = 20, search } = {}) {
  const where = { tenantId, isDelinquent: true, isActive: true };
  if (search) {
    where.OR = [
      { identifier: { contains: search, mode: 'insensitive' } },
      { ownerName: { contains: search, mode: 'insensitive' } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      include: {
        charges: { where: { status: { in: ['PENDING', 'PARTIAL'] } }, orderBy: { dueDate: 'asc' } },
        residents: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
      },
      skip,
      take: limit,
      orderBy: { identifier: 'asc' },
    }),
    prisma.unit.count({ where }),
  ]);
  return { data, total };
}

async function bulkPayments(tenantId, { month, year, payments }) {
  // Leer configuración del tenant para obtener día de cobro y concepto
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const settings = (tenant?.settings && typeof tenant.settings === 'object') ? tenant.settings : {};
  const pc = (settings.paymentConfig && typeof settings.paymentConfig === 'object') ? settings.paymentConfig : {};
  const dueDayOfMonth = Number(pc.dueDayOfMonth) || 5;
  const paymentConcept = pc.paymentConcept || 'Cuota de mantenimiento';

  const monthName = new Date(year, month - 1, 1)
    .toLocaleDateString('es-MX', { month: 'long' });
  const description = `${paymentConcept} — ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  const dueDate = new Date(year, month - 1, dueDayOfMonth);
  const ref = `CSV-${year}-${String(month).padStart(2, '0')}`;

  // Rango del mes para detectar cargo duplicado
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);

  let charged = 0, paid = 0, pending = 0, skipped = 0, totalAmount = 0;

  for (const p of payments) {
    const amount = Number(p.amount);
    if (!p.unitId || amount <= 0) { skipped++; continue; }

    // Verificar si ya existe un cargo mensual para este período
    const existing = await prisma.charge.findFirst({
      where: { tenantId, unitId: p.unitId, type: 'MONTHLY', dueDate: { gte: monthStart, lte: monthEnd } },
    });

    // Si ya está pagado, no duplicar
    if (existing?.status === 'PAID') { skipped++; continue; }

    let chargeId = existing?.id;

    if (!existing) {
      const charge = await prisma.charge.create({
        data: { tenantId, unitId: p.unitId, type: 'MONTHLY', amount, description, dueDate, isRecurring: false, status: 'PENDING' },
      });
      chargeId = charge.id;
      charged++;
    }

    if (p.paid) {
      // Registrar pago y cerrar cargo
      await prisma.payment.create({
        data: { tenantId, unitId: p.unitId, chargeId, amount, method: 'TRANSFER', reference: ref, notes: 'Carga masiva CSV', reconciled: false },
      });
      await prisma.charge.update({
        where: { id: chargeId },
        data: { status: 'PAID', paidAmount: amount },
      });
      paid++;
      totalAmount += amount;
    } else {
      pending++;
    }
  }

  // Recalcular morosidad una sola vez al final
  await unitsService.checkDelinquency(tenantId);

  return { total: payments.length, charged, paid, pending, skipped, amount: totalAmount };
}

module.exports = { createCharge, createPayment, getCharges, getPayments, reconcile, getDelinquentUnits, bulkPayments };
