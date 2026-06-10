const { Router } = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');
const ctrl = require('./mobile-sessions.controller');

const router = Router();

router.use(authenticate, validateTenant, authorize('ADMIN'));

router.get('/unit/:unitId', ctrl.getByUnit);
router.get('/user/:userId', ctrl.getByUser);
router.delete('/:sessionId', ctrl.revokeSession);
router.delete('/user/:userId/all', ctrl.revokeAllForUser);
router.delete('/unit/:unitId/all', ctrl.revokeAllForUnit);
router.patch('/unit/:unitId/max-devices', ctrl.setUnitMaxDevices);
router.patch('/user/:userId/override', ctrl.setUserMaxDevicesOverride);

module.exports = router;
