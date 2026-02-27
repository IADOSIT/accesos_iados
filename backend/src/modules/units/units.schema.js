const { z } = require('zod');

const createUnitSchema = z.object({
  identifier: z.string().min(1, 'Identificador requerido'),
  block: z.string().optional(),
  floor: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerEmail: z.string().email().optional(),
});

const updateUnitSchema = createUnitSchema.partial().extend({
  isActive: z.boolean().optional(),
});

module.exports = { createUnitSchema, updateUnitSchema };
