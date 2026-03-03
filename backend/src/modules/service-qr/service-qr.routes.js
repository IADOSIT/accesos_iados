const { Router } = require('express');
const ctrl = require('./service-qr.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');
const rateLimit = require('express-rate-limit');

const router = Router();

// Límite estricto para rutas públicas (anti-spam de formulario)
const publicLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 30,
  message: { ok: false, message: 'Demasiadas solicitudes, intenta más tarde' },
});

// ── Rutas públicas (sin auth ni tenant header) ────────────────────────────────
router.get('/public/:code',    publicLimiter, ctrl.getPublicInfo);
router.post('/public/request', publicLimiter, ctrl.submitRequest);

// ── Rutas autenticadas ────────────────────────────────────────────────────────
router.use(authenticate, validateTenant);

router.get('/current',                authorize('ADMIN'), ctrl.getCurrentQR);
router.post('/regenerate',            authorize('ADMIN'), ctrl.regenerateQR);
router.get('/requests',               ctrl.listRequests);           // todos los roles
router.get('/requests/:id',           ctrl.getRequestDetail);       // todos los roles
router.patch('/requests/:id/approve', ctrl.approveRequest);         // backend valida rol
router.patch('/requests/:id/reject',  ctrl.rejectRequest);          // backend valida rol

module.exports = router;
