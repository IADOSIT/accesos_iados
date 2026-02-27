const svc = require('./config.service');
const { success, error } = require('../../utils/apiResponse');

async function listIntegrations(req, res) {
  try {
    const data = await svc.listIntegrations(req.tenantId);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function createIntegration(req, res) {
  try {
    const data = await svc.createIntegration(req.tenantId, req.validated);
    return success(res, data, 'Integración creada', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function updateIntegration(req, res) {
  try {
    const data = await svc.updateIntegration(req.tenantId, req.params.id, req.validated);
    return success(res, data, 'Integración actualizada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function deleteIntegration(req, res) {
  try {
    const data = await svc.deleteIntegration(req.tenantId, req.params.id);
    return success(res, data, 'Integración eliminada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function testIntegration(req, res) {
  try {
    const data = await svc.testIntegration(req.tenantId, req.params.id);
    return success(res, data, 'Prueba completada');
  } catch (err) {
    return error(res, err.message, err.status || 400);
  }
}

async function getTenantSettings(req, res) {
  try {
    const data = await svc.getTenantSettings(req.tenantId);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function updateTenantSettings(req, res) {
  try {
    const data = await svc.updateTenantSettings(req.tenantId, req.validated);
    return success(res, data, 'Configuración actualizada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
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
