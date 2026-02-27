const svc = require('./units.service');
const { success, error, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');

async function create(req, res) {
  try {
    const unit = await svc.create(req.tenantId, req.validated);
    return success(res, unit, 'Unidad creada', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function findAll(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await svc.findAll(req.tenantId, { skip, limit, search: req.query.search });
  return paginated(res, data, total, page, limit);
}

async function findById(req, res) {
  try {
    const unit = await svc.findById(req.tenantId, req.params.id);
    return success(res, unit);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function update(req, res) {
  try {
    const unit = await svc.update(req.tenantId, req.params.id, req.validated);
    return success(res, unit, 'Unidad actualizada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = { create, findAll, findById, update, deactivate, activate, hardDelete };

async function deactivate(req, res) {
  try {
    await svc.deactivate(req.tenantId, req.params.id);
    return success(res, null, 'Unidad desactivada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function activate(req, res) {
  try {
    await svc.activate(req.tenantId, req.params.id);
    return success(res, null, 'Unidad activada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function hardDelete(req, res) {
  try {
    await svc.hardDelete(req.tenantId, req.params.id);
    return success(res, null, 'Unidad eliminada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}
