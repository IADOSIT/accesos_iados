const prisma = require('../config/database');

async function log(tenantId, userId, action, entity, entityId, details, ip) {
  return prisma.auditLog.create({
    data: { tenantId, userId, action, entity, entityId, details, ip },
  });
}

module.exports = { log };
