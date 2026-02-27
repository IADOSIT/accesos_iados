const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');

// ── Integraciones ──────────────────────────────────────────────

async function listIntegrations(tenantId) {
  return prisma.integrationConfig.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      brand: true,
      model: true,
      host: true,
      port: true,
      username: true,
      mqttTopic: true,
      config: true,
      isActive: true,
      status: true,
      lastCheck: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      // passwordHash excluido intencionalmente
    },
  });
}

async function createIntegration(tenantId, data) {
  const { password, config, ...rest } = data;

  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

  return prisma.integrationConfig.create({
    data: {
      tenantId,
      ...rest,
      ...(passwordHash && { passwordHash }),
      config: config ?? {},
    },
    select: {
      id: true, name: true, type: true, brand: true, model: true,
      host: true, port: true, username: true, mqttTopic: true,
      config: true, isActive: true, status: true, createdAt: true,
    },
  });
}

async function updateIntegration(tenantId, id, data) {
  const existing = await prisma.integrationConfig.findFirst({ where: { id, tenantId } });
  if (!existing) throw { status: 404, message: 'Integración no encontrada' };

  const { password, config, ...rest } = data;
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

  return prisma.integrationConfig.update({
    where: { id },
    data: {
      ...rest,
      ...(passwordHash && { passwordHash }),
      ...(config !== undefined && { config }),
    },
    select: {
      id: true, name: true, type: true, brand: true, model: true,
      host: true, port: true, username: true, mqttTopic: true,
      config: true, isActive: true, status: true, updatedAt: true,
    },
  });
}

async function deleteIntegration(tenantId, id) {
  const existing = await prisma.integrationConfig.findFirst({ where: { id, tenantId } });
  if (!existing) throw { status: 404, message: 'Integración no encontrada' };

  await prisma.integrationConfig.delete({ where: { id } });
  return { deleted: true };
}

async function testIntegration(tenantId, id) {
  const integration = await prisma.integrationConfig.findFirst({ where: { id, tenantId } });
  if (!integration) throw { status: 404, message: 'Integración no encontrada' };

  // Resultado de prueba según tipo
  let result = { reachable: false, message: '' };

  try {
    if (integration.type === 'ERREKA_MQTT' || integration.type === 'GENERIC_MQTT') {
      // Para MQTT: verificar que el topic esté configurado
      if (!integration.mqttTopic) throw new Error('MQTT topic no configurado');
      result = { reachable: true, message: 'Configuración MQTT válida. Verificar conexión al broker.' };
    } else if (['ERREKA_IP', 'HIKVISION_ISAPI', 'AXIS_VAPIX', 'ONVIF'].includes(integration.type)) {
      // Para integraciones IP: verificar que host esté configurado
      if (!integration.host) throw new Error('Host/IP no configurado');
      result = { reachable: true, message: `Configuración IP válida. Host: ${integration.host}:${integration.port || 80}` };
    }

    // Actualizar estado
    await prisma.integrationConfig.update({
      where: { id },
      data: { status: 'ACTIVE', lastCheck: new Date(), errorMessage: null },
    });

    return { ...result, status: 'ACTIVE' };
  } catch (err) {
    await prisma.integrationConfig.update({
      where: { id },
      data: { status: 'ERROR', lastCheck: new Date(), errorMessage: err.message },
    });
    throw { status: 400, message: `Error de conexión: ${err.message}` };
  }
}

// ── Tenant settings ────────────────────────────────────────────

async function getTenantSettings(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, address: true, phone: true, email: true, logo: true, settings: true },
  });
  if (!tenant) throw { status: 404, message: 'Fraccionamiento no encontrado' };
  return tenant;
}

async function updateTenantSettings(tenantId, data) {
  return prisma.tenant.update({
    where: { id: tenantId },
    data,
    select: { id: true, name: true, slug: true, address: true, phone: true, email: true, logo: true, settings: true },
  });
}

module.exports = {
  listIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration,
  getTenantSettings,
  updateTenantSettings,
};
