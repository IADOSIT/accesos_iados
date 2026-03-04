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
        mustChangePassword: data.mustChangePassword ?? false,
      },
    });
  }

  const existing = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId } },
  });

  if (existing) {
    // Si existe pero está inactivo, reactivarlo con el nuevo rol
    if (!existing.isActive) {
      await prisma.userTenant.update({
        where: { userId_tenantId: { userId: user.id, tenantId } },
        data: { isActive: true, role: data.role, unitId: data.unitId ?? existing.unitId },
      });
    } else {
      throw { status: 409, message: 'Usuario ya pertenece a este fraccionamiento' };
    }
  } else {
    await prisma.userTenant.create({
      data: { userId: user.id, tenantId, role: data.role, unitId: data.unitId },
    });
  }

  return { ...user, role: data.role, passwordHash: undefined };
}

async function findAll(tenantId, { skip, limit, search, role }) {
  const where = { tenantId, isActive: true };
  if (role) where.role = role;
  if (search) {
    where.user = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ],
    };
  }
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
  if (data.email) {
    const conflict = await prisma.user.findFirst({ where: { email: data.email, id: { not: userId } } });
    if (conflict) throw { status: 409, message: 'El email ya está en uso por otro usuario' };
    updateUser.email = data.email;
  }
  if (data.password) {
    updateUser.passwordHash = await bcrypt.hash(data.password, 12);
    updateUser.mustChangePassword = false;
  }

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

async function bulkCreate(tenantId, rows) {
  const units = await prisma.unit.findMany({
    where: { tenantId },
    select: { id: true, identifier: true },
  });
  const unitMap = Object.fromEntries(units.map(u => [u.identifier.toLowerCase(), u.id]));

  const results = { created: 0, skipped: 0, errors: [] };
  for (const [i, row] of rows.entries()) {
    try {
      const data = { ...row, mustChangePassword: true };
      if (row.unit) {
        data.unitId = unitMap[row.unit.toLowerCase()] ?? undefined;
        delete data.unit;
      }
      await create(tenantId, data);
      results.created++;
    } catch (err) {
      if (err.status === 409) results.skipped++;
      else results.errors.push({ row: i + 2, email: row.email, reason: err.message });
    }
  }
  return results;
}

module.exports = { create, bulkCreate, findAll, findById, update, deactivate, activate, hardDelete };
