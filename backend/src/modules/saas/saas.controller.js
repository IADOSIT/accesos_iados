const svc = require('./saas.service');
const { success, error } = require('../../utils/apiResponse');

async function getBillingStatus(req, res) {
  try {
    const data = await svc.getBillingStatus(req.tenantId);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function getSaasConfig(req, res) {
  try {
    const data = await svc.getTenantSaasConfig(req.tenantId);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function updateSaasConfig(req, res) {
  try {
    if (!req.user.isSuperAdmin) {
      return error(res, 'Solo SuperAdmin puede modificar la configuración SaaS', 403);
    }
    const data = await svc.updateSaasConfig(req.tenantId, req.body);
    return success(res, data, 'Configuración SaaS actualizada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function createPreference(req, res) {
  try {
    const data = await svc.createMPPreference(req.tenantId);
    return success(res, data, 'Preferencia creada');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function verifyPayment(req, res) {
  try {
    const { saasPaymentId } = req.body;
    if (!saasPaymentId) return error(res, 'saasPaymentId requerido', 400);
    const data = await svc.verifyAndMarkPaid(req.tenantId, saasPaymentId);
    return success(res, data, data.verified ? 'Pago verificado y confirmado' : 'Pago pendiente de confirmación');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function webhook(req, res) {
  try {
    const data = await svc.handleWebhook(req.body);
    return res.json(data);
  } catch (err) {
    // Always respond 200 to MP to avoid retries
    return res.json({ ok: true });
  }
}

module.exports = {
  getBillingStatus,
  getSaasConfig,
  updateSaasConfig,
  createPreference,
  verifyPayment,
  webhook,
};
