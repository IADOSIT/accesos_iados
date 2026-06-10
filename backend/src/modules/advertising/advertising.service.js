const path = require('path');
const fs   = require('fs');
const prisma = require('../../config/database');

async function list(tenantId, onlyActive = false) {
  const now = new Date();
  return prisma.advertisement.findMany({
    where: {
      tenantId,
      ...(onlyActive && {
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      }),
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
}

async function create(tenantId, data) {
  const max = await prisma.advertisement.aggregate({
    where: { tenantId },
    _max: { order: true },
  });
  return prisma.advertisement.create({
    data: { tenantId, ...data, order: (max._max.order ?? -1) + 1 },
  });
}

async function update(tenantId, id, data) {
  const ad = await prisma.advertisement.findFirst({ where: { id, tenantId } });
  if (!ad) throw { status: 404, message: 'Anuncio no encontrado' };
  return prisma.advertisement.update({ where: { id }, data });
}

async function remove(tenantId, id) {
  const ad = await prisma.advertisement.findFirst({ where: { id, tenantId } });
  if (!ad) throw { status: 404, message: 'Anuncio no encontrado' };
  // Eliminar imagen del filesystem si existe
  if (ad.imageUrl && ad.imageUrl.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, '../../../uploads', ad.imageUrl.replace('/uploads/', ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await prisma.advertisement.delete({ where: { id } });
  return { deleted: true };
}

async function reorder(tenantId, orderedIds) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.advertisement.updateMany({
        where: { id, tenantId },
        data: { order: index },
      })
    )
  );
  return list(tenantId);
}

module.exports = { list, create, update, remove, reorder };
