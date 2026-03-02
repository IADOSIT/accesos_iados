const { z } = require('zod');

const optionalEmail = z.preprocess(
  v => (v === '' ? undefined : v),
  z.string().email().optional()
);

const createUnitSchema = z.object({
  identifier: z.string().min(1, 'Identificador requerido'),
  block: z.string().optional(),
  floor: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerEmail: optionalEmail,
});

const updateUnitSchema = createUnitSchema.partial().extend({
  isActive: z.boolean().optional(),
});

module.exports = { createUnitSchema, updateUnitSchema };
