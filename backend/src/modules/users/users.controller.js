const svc = require('./users.service');
const { success, error, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');

async function create(req, res) {
  try {
    const user = await svc.create(req.tenantId, req.validated);
    return success(res, user, 'Usuario creado', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function findAll(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await svc.findAll(req.tenantId, { skip, limit });
  return paginated(res, data, total, page, limit);
}

async function findById(req, res) {
  try {
    const user = await svc.findById(req.tenantId, req.params.id);
    return success(res, user);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function update(req, res) {
  try {
    const user = await svc.update(req.tenantId, req.params.id, req.validated);
    return success(res, user, 'Usuario actualizado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function deactivate(req, res) {
  try {
    await svc.deactivate(req.tenantId, req.params.id);
    return success(res, null, 'Usuario desactivado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function activate(req, res) {
  try {
    await svc.activate(req.tenantId, req.params.id);
    return success(res, null, 'Usuario activado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function hardDelete(req, res) {
  try {
    await svc.hardDelete(req.tenantId, req.params.id);
    return success(res, null, 'Usuario eliminado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = { create, findAll, findById, update, deactivate, activate, hardDelete };
