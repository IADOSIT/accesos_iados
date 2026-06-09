const { Router } = require('express');
const ctrl = require('./guia-amarilla.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');

const router = Router();
router.use(authenticate, validateTenant);

router.get('/', ctrl.list);
router.post('/', authorize('ADMIN'), ctrl.create);
router.put('/:id', authorize('ADMIN'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), ctrl.remove);
router.patch('/reorder', authorize('ADMIN'), ctrl.reorder);

module.exports = router;
