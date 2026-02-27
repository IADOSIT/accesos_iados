const { z } = require('zod');

const openGateSchema = z.object({
  deviceId: z.string().uuid(),
  method: z.enum(['APP', 'QR', 'GUARD_OVERRIDE', 'REMOTE']).default('APP'),
  direction: z.enum(['ENTRY', 'EXIT']).default('ENTRY'),
  qrCode: z.string().optional(),
  visitorName: z.string().optional(),
  visitorPlate: z.string().optional(),
  notes: z.string().optional(),
  unitId: z.string().uuid().optional(),
});

const createQRSchema = z.object({
  visitorName: z.string().min(1, 'Nombre del visitante requerido'),
  maxUses: z.number().int().min(1).max(10).default(1),
  expiresInHours: z.number().min(1).max(72).default(24),
});

module.exports = { openGateSchema, createQRSchema };
