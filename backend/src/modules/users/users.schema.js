const { z } = require('zod');

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'GUARD', 'RESIDENT']),
  unitId: z.string().uuid().optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'GUARD', 'RESIDENT']).optional(),
  unitId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

module.exports = { createUserSchema, updateUserSchema };
