const svc = require('./mobile-sessions.service');
const { success, error } = require('../../utils/apiResponse');

async function getByUnit(req, res) {
  try {
    const data = await svc.getSessionsByUnit(req.tenantId, req.params.unitId);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function getByUser(req, res) {
  try {
    const data = await svc.getSessionsByUser(req.tenantId, req.params.userId);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function revokeSession(req, res) {
  try {
    await svc.revokeSession(req.tenantId, req.params.sessionId);
    return success(res, null, 'Dispositivo revocado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function revokeAllForUser(req, res) {
  try {
    const result = await svc.revokeAllForUser(req.tenantId, req.params.userId);
    return success(res, result, `${result.revoked} sesión(es) revocada(s)`);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function revokeAllForUnit(req, res) {
  try {
    const result = await svc.revokeAllForUnit(req.tenantId, req.params.unitId);
    return success(res, result, `${result.revoked} sesión(es) revocada(s)`);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function setUnitMaxDevices(req, res) {
  try {
    const maxDevices = parseInt(req.body.maxDevices, 10);
    if (isNaN(maxDevices) || maxDevices < 1 || maxDevices > 10) {
      return error(res, 'maxDevices debe ser entre 1 y 10', 400);
    }
    const unit = await svc.setUnitMaxDevices(req.tenantId, req.params.unitId, maxDevices);
    return success(res, unit, 'Límite actualizado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function setUserMaxDevicesOverride(req, res) {
  try {
    const val = req.body.maxDevicesOverride;
    const maxDevicesOverride = val === null || val === '' ? null : parseInt(val, 10);
    if (maxDevicesOverride !== null && (isNaN(maxDevicesOverride) || maxDevicesOverride < 1 || maxDevicesOverride > 10)) {
      return error(res, 'maxDevicesOverride debe ser entre 1 y 10 o null', 400);
    }
    const user = await svc.setUserMaxDevicesOverride(req.tenantId, req.params.userId, maxDevicesOverride);
    return success(res, user, 'Override actualizado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = {
  getByUnit,
  getByUser,
  revokeSession,
  revokeAllForUser,
  revokeAllForUnit,
  setUnitMaxDevices,
  setUserMaxDevicesOverride,
};
