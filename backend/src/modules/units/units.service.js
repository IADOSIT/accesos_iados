const prisma = require('../../config/database');

async function create(tenantId, data) {
  const exists = await prisma.unit.findUnique({
    where: { tenantId_identifier: { tenantId, identifier: data.identifier } },
  });
  if (exists) throw { status: 409, message: 'Unidad ya existe con ese identificador' };

  return prisma.unit.create({ data: { ...data, tenantId } });
}

async function findAll(tenantId, { skip, limit, search }) {
  const where = { tenantId };
  if (search) {
    where.OR = [
      { identifier: { contains: search, mode: 'insensitive' } },
      { ownerName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      include: { residents: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
      skip,
      take: limit,
      orderBy: { identifier: 'asc' },
    }),
    prisma.unit.count({ where }),
  ]);
  return { data, total };
}

async function findById(tenantId, id) {
  const unit = await prisma.unit.findFirst({
    where: { id, tenantId },
    include: {
      residents: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } },
      charges: { orderBy: { dueDate: 'desc' }, take: 12 },
      payments: { orderBy: { createdAt: 'desc' }, take: 12 },
    },
  });
  if (!unit) throw { status: 404, message: 'Unidad no encontrada' };
  return unit;
}

async function update(tenantId, id, data) {
  return prisma.unit.update({ where: { id }, data });
}

async function checkDelinquency(tenantId) {
  const now = new Date();
  const units = await prisma.unit.findMany({ where: { tenantId, isActive: true } });

  for (const unit of units) {
    const pendingCharges = await prisma.charge.count({
      where: { tenantId, unitId: unit.id, status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now } },
    });
    const isDelinquent = pendingCharges > 0;
    if (unit.isDelinquent !== isDelinquent) {
      await prisma.unit.update({ where: { id: unit.id }, data: { isDelinquent } });
    }
  }
}

async function deactivate(tenantId, id) {
  return prisma.unit.update({ where: { id }, data: { isActive: false } });
}

async function activate(tenantId, id) {
  return prisma.unit.update({ where: { id }, data: { isActive: true } });
}

async function hardDelete(tenantId, id) {
  const unit = await prisma.unit.findFirst({ where: { id, tenantId } });
  if (!unit) throw { status: 404, message: 'Unidad no encontrada' };
  try {
    await prisma.unit.delete({ where: { id } });
  } catch {
    throw { status: 409, message: 'No se puede eliminar: tiene registros asociados. Desactívala en su lugar.' };
  }
}

async function bulkCreate(tenantId, rows) {
  const results = { created: 0, skipped: 0, errors: [] };
  for (const [i, row] of rows.entries()) {
    try {
      await create(tenantId, row);
      results.created++;
    } catch (err) {
      if (err.status === 409) results.skipped++;
      else results.errors.push({ row: i + 2, identifier: row.identifier, reason: err.message });
    }
  }
  return results;
}

module.exports = { create, bulkCreate, findAll, findById, update, deactivate, activate, hardDelete, checkDelinquency };
