const svc = require('./access.service');
const { success, error, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');

async function openGate(req, res) {
  try {
    const result = await svc.openGate(req.tenantId, req.user.id, req.validated);
    return success(res, result, result.granted ? 'Acceso concedido' : 'Acceso denegado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function generateQR(req, res) {
  try {
    const unitId = req.user.unitId || req.body.unitId;
    if (!unitId) return error(res, 'Unidad requerida', 400);
    const qr = await svc.generateQR(req.tenantId, req.user.id, unitId, req.validated);
    return success(res, qr, 'Código QR generado', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function getLogs(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await svc.getLogs(req.tenantId, {
    skip,
    limit,
    unitId: req.query.unitId,
    method: req.query.method,
    from: req.query.from,
    to: req.query.to,
  });
  return paginated(res, data, total, page, limit);
}

async function getQRCodes(req, res) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { data, total } = await svc.getQRCodes(req.tenantId, req.user.id, { skip, limit });
    return paginated(res, data, total, page, limit);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function revokeQR(req, res) {
  try {
    const qr = await svc.revokeQR(req.tenantId, req.user.id, req.user.role, req.params.id);
    return success(res, qr, 'Código QR revocado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = { openGate, generateQR, getQRCodes, getLogs, revokeQR };
