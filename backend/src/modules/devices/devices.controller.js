const svc = require('./devices.service');
const { success, error } = require('../../utils/apiResponse');

async function create(req, res) {
  try {
    const device = await svc.create(req.tenantId, req.validated);
    return success(res, device, 'Dispositivo creado', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function findAll(req, res) {
  const devices = await svc.findAll(req.tenantId);
  return success(res, devices);
}

async function findById(req, res) {
  try {
    const device = await svc.findById(req.tenantId, req.params.id);
    return success(res, device);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function update(req, res) {
  try {
    const device = await svc.update(req.tenantId, req.params.id, req.validated);
    return success(res, device, 'Dispositivo actualizado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = { create, findAll, findById, update, deactivate, activate, hardDelete };

async function deactivate(req, res) {
  try {
    await svc.deactivate(req.tenantId, req.params.id);
    return success(res, null, 'Dispositivo desactivado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function activate(req, res) {
  try {
    await svc.activate(req.tenantId, req.params.id);
    return success(res, null, 'Dispositivo activado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function hardDelete(req, res) {
  try {
    await svc.hardDelete(req.tenantId, req.params.id);
    return success(res, null, 'Dispositivo eliminado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}
