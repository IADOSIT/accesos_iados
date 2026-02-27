const { Router } = require('express');
const ctrl = require('./access.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');
const { openGateSchema, createQRSchema } = require('./access.schema');

const router = Router();

router.use(authenticate, validateTenant);

router.post('/open', validate(openGateSchema), ctrl.openGate);
router.post('/qr', authorize('ADMIN', 'RESIDENT'), validate(createQRSchema), ctrl.generateQR);
router.get('/qr', authorize('ADMIN', 'RESIDENT'), ctrl.getQRCodes);
router.post('/qr/:id/revoke', authorize('ADMIN', 'RESIDENT'), ctrl.revokeQR);
router.get('/logs', authorize('ADMIN', 'GUARD'), ctrl.getLogs);

module.exports = router;
