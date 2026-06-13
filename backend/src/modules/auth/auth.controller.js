const authService = require('./auth.service');
const { success, error } = require('../../utils/apiResponse');

async function login(req, res) {
  try {
    const { email, password, deviceId, deviceName, platform, fcmToken } = req.validated;
    const result = await authService.login(email, password, { deviceId, deviceName, platform, fcmToken });
    return success(res, result, 'Inicio de sesión exitoso');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function register(req, res) {
  try {
    const user = await authService.register(req.validated);
    return success(res, user, 'Usuario registrado', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return error(res, 'Refresh token requerido', 400);
    const result = await authService.refreshAccessToken(refreshToken);
    return success(res, result);
  } catch (err) {
    return error(res, 'Token inválido', 401);
  }
}

async function changePassword(req, res) {
  try {
    await authService.changePassword(req.user.id, req.validated.currentPassword, req.validated.newPassword);
    return success(res, null, 'Contraseña actualizada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function me(req, res) {
  try {
    const data = await authService.getMe(req.user.id);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function updateFCMToken(req, res) {
  try {
    const { token, deviceId } = req.body;
    await authService.updateFCMToken(req.user.id, deviceId || null, token || null);
    return success(res, null, 'Token FCM actualizado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function myDevices(req, res) {
  try {
    const devices = await authService.getMyDevices(req.user.id);
    return success(res, devices);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = { login, register, refresh, changePassword, me, updateFCMToken, myDevices };
