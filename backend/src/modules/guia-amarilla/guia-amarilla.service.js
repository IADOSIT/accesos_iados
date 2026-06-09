const prisma = require('../../config/database');

async function list(tenantId, onlyActive = false) {
  return prisma.guiaAmarillaEntry.findMany({
    where: { tenantId, ...(onlyActive && { isActive: true }) },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
}

async function create(tenantId, data) {
  const max = await prisma.guiaAmarillaEntry.aggregate({
    where: { tenantId },
    _max: { order: true },
  });
  return prisma.guiaAmarillaEntry.create({
    data: { tenantId, ...data, order: (max._max.order ?? -1) + 1 },
  });
}

async function update(tenantId, id, data) {
  const entry = await prisma.guiaAmarillaEntry.findFirst({ where: { id, tenantId } });
  if (!entry) throw { status: 404, message: 'Entrada no encontrada' };
  return prisma.guiaAmarillaEntry.update({ where: { id }, data });
}

async function remove(tenantId, id) {
  const entry = await prisma.guiaAmarillaEntry.findFirst({ where: { id, tenantId } });
  if (!entry) throw { status: 404, message: 'Entrada no encontrada' };
  await prisma.guiaAmarillaEntry.delete({ where: { id } });
  return { deleted: true };
}

async function reorder(tenantId, orderedIds) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.guiaAmarillaEntry.updateMany({
        where: { id, tenantId },
        data: { order: index },
      })
    )
  );
  return list(tenantId);
}

module.exports = { list, create, update, remove, reorder };
