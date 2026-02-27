const { z } = require('zod');

const createChargeSchema = z.object({
  unitId: z.string().uuid(),
  type: z.enum(['MONTHLY', 'EXTRAORDINARY', 'PENALTY', 'OTHER']).default('MONTHLY'),
  amount: z.number().positive(),
  description: z.string().min(1),
  dueDate: z.string().datetime(),
  isRecurring: z.boolean().default(false),
});

const createPaymentSchema = z.object({
  unitId: z.string().uuid(),
  chargeId: z.string().uuid().optional(),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'TRANSFER', 'CARD', 'CHECK', 'OTHER']).default('CASH'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const reconcileSchema = z.object({
  paymentIds: z.array(z.string().uuid()).min(1),
});

module.exports = { createChargeSchema, createPaymentSchema, reconcileSchema };
