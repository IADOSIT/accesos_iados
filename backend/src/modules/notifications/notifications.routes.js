const { Router } = require('express');
const ctrl = require('./notifications.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateTenant } = require('../../middleware/tenant');

const router = Router();

router.use(authenticate, validateTenant);

// Todos los roles autenticados
router.get('/', ctrl.list);
router.get('/unread-count', ctrl.unreadCount);
router.patch('/read-all', ctrl.readAll);

// Solo ADMIN
router.get('/config', authorize('ADMIN'), ctrl.getConfig);
router.put('/config', authorize('ADMIN'), ctrl.updateConfig);
router.get('/history', authorize('ADMIN'), ctrl.history);
router.post('/broadcast', authorize('ADMIN'), ctrl.broadcast);

module.exports = router;
