const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  deviceId: z.string().max(128).optional(),
  deviceName: z.string().max(128).optional(),
  platform: z.enum(['android', 'ios', 'web']).optional(),
  fcmToken: z.string().max(512).optional(),
});

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  phone: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'Mínimo 6 caracteres'),
});

module.exports = { loginSchema, registerSchema, changePasswordSchema };
