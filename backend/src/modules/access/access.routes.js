const { Router } = require('express');
const ctrl = require('./access.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');
const { openGateSchema, createQRSchema, quickQRSchema } = require('./access.schema');

const router = Router();

// Ruta pública — sin autenticación ni tenant header
router.get('/qr/public/:code', ctrl.getPublicQR);

router.use(authenticate, validateTenant);

router.post('/open', validate(openGateSchema), ctrl.openGate);
router.post('/panic', ctrl.panic); // todos los roles autenticados
router.post('/qr', authorize('ADMIN', 'RESIDENT'), validate(createQRSchema), ctrl.generateQR);
router.post('/qr/quick', authorize('ADMIN', 'RESIDENT'), validate(quickQRSchema), ctrl.generateQuickQR);
router.get('/qr', authorize('ADMIN', 'RESIDENT'), ctrl.getQRCodes);
router.post('/qr/:id/revoke', authorize('ADMIN', 'RESIDENT'), ctrl.revokeQR);
router.get('/logs', authorize('ADMIN', 'GUARD', 'RESIDENT'), ctrl.getLogs);

module.exports = router;
