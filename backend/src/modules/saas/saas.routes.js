const { Router } = require('express');
const ctrl = require('./saas.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');

const router = Router();

// Webhook público (sin auth — MercadoPago lo llama)
router.post('/webhook', ctrl.webhook);

// Rutas protegidas
router.use(authenticate, validateTenant);

// ADMIN y SUPERADMIN pueden ver el estado de facturación
router.get('/status', authorize('ADMIN'), ctrl.getBillingStatus);

// Solo SUPERADMIN puede ver/cambiar la config saas
router.get('/config', authorize('ADMIN'), ctrl.getSaasConfig);
router.put('/config', authorize('ADMIN'), ctrl.updateSaasConfig);

// ADMIN genera preferencia MP para pagar
router.post('/preference', authorize('ADMIN'), ctrl.createPreference);

// ADMIN verifica un pago después del redirect de MP
router.post('/verify', authorize('ADMIN'), ctrl.verifyPayment);

module.exports = router;
