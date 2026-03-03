const { Router } = require('express');
const ctrl = require('./config.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');
const { createIntegrationSchema, updateIntegrationSchema, updateTenantSchema } = require('./config.schema');

const router = Router();

router.use(authenticate, validateTenant);

// ── Tenant settings ───────────────────────────────────────────
router.get('/tenant', ctrl.getTenantSettings);                                           // todos los roles — la app lo usa para leer featureFlags y uiTheme
router.put('/tenant', authorize('ADMIN'), validate(updateTenantSchema), ctrl.updateTenantSettings);

// ── Integraciones de hardware (solo ADMIN) ───────────────────
router.get('/integraciones', authorize('ADMIN'), ctrl.listIntegrations);
router.post('/integraciones', authorize('ADMIN'), validate(createIntegrationSchema), ctrl.createIntegration);
router.put('/integraciones/:id', authorize('ADMIN'), validate(updateIntegrationSchema), ctrl.updateIntegration);
router.delete('/integraciones/:id', authorize('ADMIN'), ctrl.deleteIntegration);
router.post('/integraciones/:id/test', authorize('ADMIN'), ctrl.testIntegration);

module.exports = router;
