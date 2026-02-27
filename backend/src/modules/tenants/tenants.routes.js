const { Router } = require('express');
const ctrl = require('./tenants.controller');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { createTenantSchema, createTenantWithAdminSchema, updateTenantSchema } = require('./tenants.schema');

const router = Router();

router.use(authenticate);

// Solo superAdmin puede gestionar tenants
function superAdminOnly(req, res, next) {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ ok: false, message: 'Acceso exclusivo para Super Administrador' });
  }
  next();
}

router.get('/stats', superAdminOnly, ctrl.getStats);
router.post('/', superAdminOnly, validate(createTenantSchema), ctrl.create);
router.post('/with-admin', superAdminOnly, validate(createTenantWithAdminSchema), ctrl.createWithAdmin);
router.get('/', superAdminOnly, ctrl.findAll);
router.get('/:id', superAdminOnly, ctrl.findById);
router.put('/:id', superAdminOnly, validate(updateTenantSchema), ctrl.update);
router.post('/:id/activate', superAdminOnly, ctrl.activate);
router.post('/:id/deactivate', superAdminOnly, ctrl.deactivate);
router.delete('/:id', superAdminOnly, ctrl.hardDelete);

module.exports = router;
