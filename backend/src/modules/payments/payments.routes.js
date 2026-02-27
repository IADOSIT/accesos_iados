const { Router } = require('express');
const ctrl = require('./payments.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');
const { createChargeSchema, createPaymentSchema, reconcileSchema } = require('./payments.schema');

const router = Router();

router.use(authenticate, validateTenant);

router.post('/charges', authorize('ADMIN'), validate(createChargeSchema), ctrl.createCharge);
router.get('/charges', authorize('ADMIN', 'RESIDENT'), ctrl.getCharges);
router.post('/payments', authorize('ADMIN'), validate(createPaymentSchema), ctrl.createPayment);
router.get('/payments', authorize('ADMIN'), ctrl.getPayments);
router.post('/reconcile', authorize('ADMIN'), validate(reconcileSchema), ctrl.reconcile);
router.get('/delinquent', authorize('ADMIN', 'GUARD'), ctrl.getDelinquent);

module.exports = router;
