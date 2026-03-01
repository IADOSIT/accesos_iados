const { Router } = require('express');
const ctrl = require('./auth.controller');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { loginSchema, registerSchema, changePasswordSchema } = require('./auth.schema');

const router = Router();

router.post('/login', validate(loginSchema), ctrl.login);
router.post('/register', validate(registerSchema), ctrl.register);
router.post('/refresh', ctrl.refresh);
router.get('/me', authenticate, ctrl.me);
router.put('/change-password', authenticate, validate(changePasswordSchema), ctrl.changePassword);
router.put('/fcm-token', authenticate, ctrl.updateFCMToken);

module.exports = router;
