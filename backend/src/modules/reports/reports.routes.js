const { Router } = require('express');
const ctrl = require('./reports.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');

const router = Router();

router.use(authenticate, validateTenant);

router.get('/dashboard', ctrl.dashboard);
router.get('/access', authorize('ADMIN'), ctrl.accessByRange);
router.get('/payments', authorize('ADMIN'), ctrl.paymentsByPeriod);
router.get('/delinquency', authorize('ADMIN'), ctrl.delinquency);
router.get('/guard-activity', authorize('ADMIN'), ctrl.guardActivity);
router.get('/unit-usage', authorize('ADMIN'), ctrl.unitUsage);

module.exports = router;
