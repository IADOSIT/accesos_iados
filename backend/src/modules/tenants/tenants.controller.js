const svc = require('./tenants.service');
const { success, error } = require('../../utils/apiResponse');

async function create(req, res) {
  try {
    const tenant = await svc.create(req.validated);
    return success(res, tenant, 'Tenant creado', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function createWithAdmin(req, res) {
  try {
    const result = await svc.createWithAdmin(req.validated);
    return success(res, result, 'Fraccionamiento creado con administrador', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function findAll(req, res) {
  const tenants = await svc.findAll();
  return success(res, tenants);
}

async function findById(req, res) {
  try {
    const tenant = await svc.findById(req.params.id);
    return success(res, tenant);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function update(req, res) {
  try {
    const tenant = await svc.update(req.params.id, req.validated);
    return success(res, tenant, 'Tenant actualizado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function deactivate(req, res) {
  try {
    await svc.deactivate(req.params.id);
    return success(res, null, 'Tenant desactivado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function activate(req, res) {
  try {
    await svc.activate(req.params.id);
    return success(res, null, 'Tenant activado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function getStats(req, res) {
  const stats = await svc.getStats();
  return success(res, stats);
}

async function purgePreview(req, res) {
  try {
    const preview = await svc.getPurgePreview(req.params.id);
    return success(res, preview);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function purge(req, res) {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations) || operations.length === 0) {
      return error(res, 'Selecciona al menos una operación', 400);
    }
    const VALID_OPS = ['access_logs', 'qr_codes', 'notifications', 'service_requests', 'panic_alerts', 'audit_logs', 'payments', 'charges', 'residents', 'units'];
    const invalid = operations.filter(op => !VALID_OPS.includes(op));
    if (invalid.length > 0) {
      return error(res, `Operaciones inválidas: ${invalid.join(', ')}`, 400);
    }
    const result = await svc.purgeData(req.params.id, operations);
    return success(res, result, 'Datos purgados correctamente');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = { create, createWithAdmin, findAll, findById, update, deactivate, activate, hardDelete, getStats, purgePreview, purge };

async function hardDelete(req, res) {
  try {
    await svc.hardDelete(req.params.id);
    return success(res, null, 'Fraccionamiento eliminado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}
