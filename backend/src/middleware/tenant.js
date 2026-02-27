const prisma = require('../config/database');
const { error } = require('../utils/apiResponse');

async function validateTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || req.params.tenantId;

  if (!tenantId) {
    return error(res, 'Tenant ID requerido (header x-tenant-id)', 400);
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || !tenant.isActive) {
    return error(res, 'Tenant no encontrado o inactivo', 404);
  }

  // Validar que el usuario pertenezca a este tenant
  if (req.user && !req.user.isSuperAdmin) {
    const membership = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId: req.user.id, tenantId } },
    });
    if (!membership || !membership.isActive) {
      return error(res, 'Sin acceso a este tenant', 403);
    }
    req.user.role = membership.role;
    req.user.unitId = membership.unitId;
    req.userTenant = membership;
  }

  req.tenantId = tenantId;
  req.tenant = tenant;
  next();
}

module.exports = { validateTenant };
