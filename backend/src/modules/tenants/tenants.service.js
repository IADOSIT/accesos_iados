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
        data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN', isActive: true },
      });
    } else if (!existingMembership.isActive) {
      // Reactivar membresía inactiva y asegurarse de que sea ADMIN
      await tx.userTenant.update({
        where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
        data: { isActive: true, role: 'ADMIN' },
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

async function getPurgePreview(tenantId) {
  const [accessLogs, payments, charges, qrCodes, notifications, serviceRequests, auditLogs, panicAlerts, units, residents] = await Promise.all([
    prisma.accessLog.count({ where: { tenantId } }),
    prisma.payment.count({ where: { tenantId } }),
    prisma.charge.count({ where: { tenantId } }),
    prisma.qRCode.count({ where: { tenantId } }),
    prisma.notification.count({ where: { tenantId } }),
    prisma.serviceRequest.count({ where: { tenantId } }),
    prisma.auditLog.count({ where: { tenantId } }),
    prisma.panicAlert.count({ where: { tenantId } }),
    prisma.unit.count({ where: { tenantId } }),
    prisma.userTenant.count({ where: { tenantId, role: 'RESIDENT' } }),
  ]);
  return { accessLogs, payments, charges, qrCodes, notifications, serviceRequests, auditLogs, panicAlerts, units, residents };
}

async function purgeData(tenantId, operations) {
  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw { status: 404, message: 'Fraccionamiento no encontrado' };

  return prisma.$transaction(async (tx) => {
    const deleted = {};

    // Independent tables (no hard FK to Unit)
    if (operations.includes('service_requests')) {
      const r = await tx.serviceRequest.deleteMany({ where: { tenantId } });
      deleted.serviceRequests = r.count;
    }
    if (operations.includes('notifications')) {
      const r = await tx.notification.deleteMany({ where: { tenantId } });
      deleted.notifications = r.count;
    }
    if (operations.includes('audit_logs')) {
      const r = await tx.auditLog.deleteMany({ where: { tenantId } });
      deleted.auditLogs = r.count;
    }
    if (operations.includes('panic_alerts')) {
      const r = await tx.panicAlert.deleteMany({ where: { tenantId } });
      deleted.panicAlerts = r.count;
    }
    if (operations.includes('access_logs')) {
      const r = await tx.accessLog.deleteMany({ where: { tenantId } });
      deleted.accessLogs = r.count;
    }

    // Payments → Charges → QR → Residents must come before Units (hard FK)
    const needPayments  = operations.includes('payments')  || operations.includes('units');
    const needCharges   = operations.includes('charges')   || operations.includes('units');
    const needQr        = operations.includes('qr_codes')  || operations.includes('units');
    const needResidents = operations.includes('residents') || operations.includes('units');

    if (needPayments) {
      const r = await tx.payment.deleteMany({ where: { tenantId } });
      deleted.payments = r.count;
    }
    if (needCharges) {
      const r = await tx.charge.deleteMany({ where: { tenantId } });
      deleted.charges = r.count;
    }
    if (needQr) {
      const r = await tx.qRCode.deleteMany({ where: { tenantId } });
      deleted.qrCodes = r.count;
    }
    if (needResidents) {
      const r = await tx.userTenant.deleteMany({ where: { tenantId, role: 'RESIDENT' } });
      deleted.residents = r.count;
    }
    if (operations.includes('units')) {
      const r = await tx.unit.deleteMany({ where: { tenantId } });
      deleted.units = r.count;
    }

    return deleted;
  }, { timeout: 30000 });
}

module.exports = { create, createWithAdmin, findAll, findById, update, deactivate, activate, hardDelete, getStats, getPurgePreview, purgeData };

async function hardDelete(id) {
  try {
    await prisma.tenant.delete({ where: { id } });
  } catch {
    throw { status: 409, message: 'No se puede eliminar: tiene datos asociados. Desactívalo en su lugar.' };
  }
}
