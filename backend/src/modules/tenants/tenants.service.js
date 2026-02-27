const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');

async function create(data) {
  const exists = await prisma.tenant.findUnique({ where: { slug: data.slug } });
  if (exists) throw { status: 409, message: 'El slug ya existe' };
  return prisma.tenant.create({ data });
}

async function createWithAdmin(data) {
  const exists = await prisma.tenant.findUnique({ where: { slug: data.slug } });
  if (exists) throw { status: 409, message: 'El slug ya existe' };

  // Crear todo en una transacción
  return prisma.$transaction(async (tx) => {
    // 1. Crear tenant
    const tenant = await tx.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        address: data.address,
        phone: data.phone,
        email: data.email,
      },
    });

    // 2. Buscar o crear usuario admin
    let user = await tx.user.findUnique({ where: { email: data.adminEmail } });

    if (!user) {
      const passwordHash = await bcrypt.hash(data.adminPassword, 12);
      user = await tx.user.create({
        data: {
          email: data.adminEmail,
          passwordHash,
          firstName: data.adminFirstName,
          lastName: data.adminLastName,
          phone: data.adminPhone,
        },
      });
    }

    // 3. Asociar como ADMIN del nuevo tenant
    const existingMembership = await tx.userTenant.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    });

    if (!existingMembership) {
      await tx.userTenant.create({
        data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
      });
    }

    return {
      tenant,
      admin: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    };
  });
}

async function findAll() {
  return prisma.tenant.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { users: true, units: true, devices: true } },
    },
  });
}

async function findById(id) {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, units: true, devices: true, accessLogs: true, payments: true } },
    },
  });
  if (!tenant) throw { status: 404, message: 'Tenant no encontrado' };
  return tenant;
}

async function update(id, data) {
  return prisma.tenant.update({ where: { id }, data });
}

async function deactivate(id) {
  return prisma.tenant.update({ where: { id }, data: { isActive: false } });
}

async function activate(id) {
  return prisma.tenant.update({ where: { id }, data: { isActive: true } });
}

async function getStats() {
  const [totalTenants, totalUsers, totalUnits, totalDevices] = await Promise.all([
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.unit.count({ where: { isActive: true } }),
    prisma.device.count({ where: { isActive: true } }),
  ]);
  return { totalTenants, totalUsers, totalUnits, totalDevices };
}

module.exports = { create, createWithAdmin, findAll, findById, update, deactivate, activate, hardDelete, getStats };

async function hardDelete(id) {
  try {
    await prisma.tenant.delete({ where: { id } });
  } catch {
    throw { status: 409, message: 'No se puede eliminar: tiene datos asociados. Desactívalo en su lugar.' };
  }
}
