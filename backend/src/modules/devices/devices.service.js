const prisma = require('../../config/database');

async function create(tenantId, data) {
  return prisma.device.create({ data: { ...data, tenantId } });
}

async function findAll(tenantId) {
  return prisma.device.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: 'asc' },
  });
}

async function findById(tenantId, id) {
  const device = await prisma.device.findFirst({ where: { id, tenantId } });
  if (!device) throw { status: 404, message: 'Dispositivo no encontrado' };
  return device;
}

async function update(tenantId, id, data) {
  return prisma.device.update({ where: { id }, data });
}

async function updateStatus(id, status) {
  return prisma.device.update({ where: { id }, data: { status, lastPing: new Date() } });
}

module.exports = { create, findAll, findById, update, updateStatus, deactivate, activate, hardDelete };

async function deactivate(tenantId, id) {
  return prisma.device.update({ where: { id }, data: { isActive: false } });
}

async function activate(tenantId, id) {
  return prisma.device.update({ where: { id }, data: { isActive: true } });
}

async function hardDelete(tenantId, id) {
  const device = await prisma.device.findFirst({ where: { id, tenantId } });
  if (!device) throw { status: 404, message: 'Dispositivo no encontrado' };
  try {
    await prisma.device.delete({ where: { id } });
  } catch {
    throw { status: 409, message: 'No se puede eliminar: tiene registros asociados. Desactívalo en su lugar.' };
  }
}
