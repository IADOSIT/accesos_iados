const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');

async function create(tenantId, data) {
  let user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
    });
  }

  const existing = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId } },
  });
  if (existing) throw { status: 409, message: 'Usuario ya pertenece a este tenant' };

  await prisma.userTenant.create({
    data: { userId: user.id, tenantId, role: data.role, unitId: data.unitId },
  });

  return { ...user, role: data.role, passwordHash: undefined };
}

async function findAll(tenantId, { skip, limit }) {
  const where = { tenantId, isActive: true };
  const [data, total] = await Promise.all([
    prisma.userTenant.findMany({
      where,
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } }, unit: true, tenant: { select: { id: true, name: true } } },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userTenant.count({ where }),
  ]);
  return { data, total };
}

async function findById(tenantId, userId) {
  const ut = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatarUrl: true } }, unit: true },
  });
  if (!ut) throw { status: 404, message: 'Usuario no encontrado en este tenant' };
  return ut;
}

async function update(tenantId, userId, data) {
  const updateUser = {};
  if (data.firstName) updateUser.firstName = data.firstName;
  if (data.lastName) updateUser.lastName = data.lastName;
  if (data.phone !== undefined) updateUser.phone = data.phone;

  if (Object.keys(updateUser).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: updateUser });
  }

  const updateTenant = {};
  if (data.role) updateTenant.role = data.role;
  if (data.unitId !== undefined) updateTenant.unitId = data.unitId;
  if (data.isActive !== undefined) updateTenant.isActive = data.isActive;

  if (Object.keys(updateTenant).length > 0) {
    await prisma.userTenant.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: updateTenant,
    });
  }

  return findById(tenantId, userId);
}

async function deactivate(tenantId, userId) {
  await prisma.userTenant.update({
    where: { userId_tenantId: { userId, tenantId } },
    data: { isActive: false },
  });
}

async function activate(tenantId, userId) {
  await prisma.userTenant.update({
    where: { userId_tenantId: { userId, tenantId } },
    data: { isActive: true },
  });
}

async function hardDelete(tenantId, userId) {
  await prisma.userTenant.delete({ where: { userId_tenantId: { userId, tenantId } } });
  const remaining = await prisma.userTenant.count({ where: { userId } });
  if (remaining === 0) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
}

module.exports = { create, findAll, findById, update, deactivate, activate, hardDelete };
