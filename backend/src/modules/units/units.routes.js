const { Router } = require('express');
const ctrl = require('./units.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');
const { createUnitSchema, updateUnitSchema } = require('./units.schema');

const router = Router();

router.use(authenticate, validateTenant);

router.post('/', authorize('ADMIN'), validate(createUnitSchema), ctrl.create);
router.get('/', authorize('ADMIN', 'GUARD'), ctrl.findAll);
router.get('/:id', ctrl.findById);
router.put('/:id', authorize('ADMIN'), validate(updateUnitSchema), ctrl.update);
router.post('/:id/deactivate', authorize('ADMIN'), ctrl.deactivate);
router.post('/:id/activate', authorize('ADMIN'), ctrl.activate);
router.delete('/:id', authorize('ADMIN'), ctrl.hardDelete);

module.exports = router;
