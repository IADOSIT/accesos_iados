const svc = require('./guia-amarilla.service');
const { success, error } = require('../../utils/apiResponse');

async function list(req, res) {
  try {
    const onlyActive = req.query.active === 'true';
    return success(res, await svc.list(req.tenantId, onlyActive));
  } catch (err) { return error(res, err.message, err.status || 500); }
}

async function create(req, res) {
  try {
    return success(res, await svc.create(req.tenantId, req.body), 'Entrada creada', 201);
  } catch (err) { return error(res, err.message, err.status || 500); }
}

async function update(req, res) {
  try {
    return success(res, await svc.update(req.tenantId, req.params.id, req.body), 'Entrada actualizada');
  } catch (err) { return error(res, err.message, err.status || 500); }
}

async function remove(req, res) {
  try {
    return success(res, await svc.remove(req.tenantId, req.params.id), 'Entrada eliminada');
  } catch (err) { return error(res, err.message, err.status || 500); }
}

async function reorder(req, res) {
  try {
    return success(res, await svc.reorder(req.tenantId, req.body.orderedIds), 'Orden actualizado');
  } catch (err) { return error(res, err.message, err.status || 500); }
}

module.exports = { list, create, update, remove, reorder };
