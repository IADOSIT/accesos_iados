const svc = require('./notifications.service');
const { success, error, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');

async function list(req, res) {
  try {
    const data = await svc.getForUser(req.user.id, req.tenantId);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function unreadCount(req, res) {
  try {
    const count = await svc.getUnreadCount(req.user.id, req.tenantId);
    return success(res, { count });
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function readAll(req, res) {
  try {
    await svc.markAllRead(req.user.id, req.tenantId);
    return success(res, null, 'Notificaciones marcadas como leídas');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function getConfig(req, res) {
  try {
    const config = await svc.getConfig(req.tenantId);
    return success(res, config);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function updateConfig(req, res) {
  try {
    const config = await svc.updateConfig(req.tenantId, req.body);
    return success(res, config, 'Configuración actualizada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function history(req, res) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { data, total } = await svc.getHistory(req.tenantId, { skip, limit });
    return paginated(res, data, total, page, limit);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function broadcast(req, res) {
  try {
    const result = await svc.broadcast(req.tenantId, req.body);
    return success(res, result, 'Notificación enviada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = { list, unreadCount, readAll, getConfig, updateConfig, history, broadcast };
