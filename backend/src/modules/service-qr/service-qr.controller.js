const svc = require('./service-qr.service');
const { success, error, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');

// ── Públicos ─────────────────────────────────────────────────────────────────

async function getPublicInfo(req, res) {
  try {
    const info = await svc.getPublicInfo(req.params.code);
    return success(res, info);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function getRequestStatus(req, res) {
  try {
    const result = await svc.getRequestStatus(req.params.requestId);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function submitRequest(req, res) {
  try {
    const { tenantId, qrId, service, unitId, photoData, visitorPhone } = req.body;
    if (!tenantId || !qrId || !service) return error(res, 'tenantId, qrId y service son requeridos', 400);
    const result = await svc.submitRequest(tenantId, qrId, { service, unitId, photoData, visitorPhone });
    return success(res, result, 'Solicitud enviada — el residente será notificado', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

// ── Autenticados ──────────────────────────────────────────────────────────────

async function getCurrentQR(req, res) {
  try {
    const qr = await svc.getOrCreateQR(req.tenantId);
    const portalUrl = process.env.PORTAL_URL || 'http://34.71.132.26:3002';
    return success(res, { ...qr, url: `${portalUrl}/sv/${qr.code}` });
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function regenerateQR(req, res) {
  try {
    const qr = await svc.rotateQR(req.tenantId);
    const portalUrl = process.env.PORTAL_URL || 'http://34.71.132.26:3002';
    return success(res, { ...qr, url: `${portalUrl}/sv/${qr.code}` }, 'QR regenerado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function listRequests(req, res) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { data, total } = await svc.listRequests(req.tenantId, req.user.id, req.user.role, {
      skip,
      limit,
      status: req.query.status,
    });
    return paginated(res, data, total, page, limit);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function getRequestDetail(req, res) {
  try {
    const request = await svc.getRequest(req.tenantId, req.params.id, req.user.id, req.user.role);
    return success(res, request);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function approveRequest(req, res) {
  try {
    const result = await svc.approveRequest(req.tenantId, req.params.id, req.user.id, req.user.role);
    return success(res, result, 'Acceso aprobado — dispositivo activado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function rejectRequest(req, res) {
  try {
    const result = await svc.rejectRequest(req.tenantId, req.params.id, req.user.id, req.user.role, req.body.notes);
    return success(res, result, 'Solicitud rechazada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = {
  getPublicInfo,
  getRequestStatus,
  submitRequest,
  getCurrentQR,
  regenerateQR,
  listRequests,
  getRequestDetail,
  approveRequest,
  rejectRequest,
};
