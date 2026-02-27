const { z } = require('zod');

const createTenantSchema = z.object({
  name: z.string().min(2, 'Nombre mínimo 2 caracteres'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

const createTenantWithAdminSchema = z.object({
  name: z.string().min(2, 'Nombre mínimo 2 caracteres'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  adminEmail: z.string().email('Email del admin requerido'),
  adminPassword: z.string().min(6, 'Mínimo 6 caracteres'),
  adminFirstName: z.string().min(1, 'Nombre del admin requerido'),
  adminLastName: z.string().min(1, 'Apellido del admin requerido'),
  adminPhone: z.string().optional(),
});

const updateTenantSchema = createTenantSchema.partial();

module.exports = { createTenantSchema, createTenantWithAdminSchema, updateTenantSchema };
