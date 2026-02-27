const { Router } = require('express');
const ctrl = require('./devices.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');
const { createDeviceSchema, updateDeviceSchema } = require('./devices.schema');

const router = Router();

router.use(authenticate, validateTenant);

router.post('/', authorize('ADMIN'), validate(createDeviceSchema), ctrl.create);
router.get('/', authorize('ADMIN', 'GUARD'), ctrl.findAll);
router.get('/:id', authorize('ADMIN', 'GUARD'), ctrl.findById);
router.put('/:id', authorize('ADMIN'), validate(updateDeviceSchema), ctrl.update);
router.post('/:id/deactivate', authorize('ADMIN'), ctrl.deactivate);
router.post('/:id/activate', authorize('ADMIN'), ctrl.activate);
router.delete('/:id', authorize('ADMIN'), ctrl.hardDelete);

module.exports = router;
