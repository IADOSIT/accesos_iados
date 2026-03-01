const authService = require('./auth.service');
const { success, error } = require('../../utils/apiResponse');

async function login(req, res) {
  try {
    const result = await authService.login(req.validated.email, req.validated.password);
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
  return success(res, req.user);
}

async function updateFCMToken(req, res) {
  try {
    const { token } = req.body;
    if (!token) return error(res, 'token requerido', 400);
    await authService.updateFCMToken(req.user.id, token);
    return success(res, null, 'Token FCM actualizado');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = { login, register, refresh, changePassword, me, updateFCMToken };
