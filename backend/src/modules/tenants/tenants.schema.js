const { z } = require('zod');

const optionalEmail = z.preprocess(
  v => (typeof v === 'string' ? v.trim() || undefined : undefined),
  z.string().email().optional()
);

const optionalStr = z.preprocess(
  v => (typeof v === 'string' ? v.trim() || undefined : undefined),
  z.string().optional()
);

const createTenantSchema = z.object({
  name: z.string().trim().min(2, 'Nombre mínimo 2 caracteres'),
  slug: z.preprocess(
    v => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().min(2, 'Slug mínimo 2 caracteres').regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones')
  ),
  address: optionalStr,
  phone: optionalStr,
  email: optionalEmail,
});

const createTenantWithAdminSchema = z.object({
  name: z.string().trim().min(2, 'Nombre mínimo 2 caracteres'),
  slug: z.preprocess(
    v => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().min(2, 'Slug mínimo 2 caracteres').regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones')
  ),
  address: optionalStr,
  phone: optionalStr,
  email: optionalEmail,
  adminEmail: z.preprocess(
    v => (typeof v === 'string' ? v.trim() : v),
    z.string().email('Email del admin inválido')
  ),
  adminPassword: z.string().min(6, 'Contraseña mínimo 6 caracteres'),
  adminFirstName: z.string().trim().min(1, 'Nombre del admin requerido'),
  adminLastName: z.string().trim().min(1, 'Apellido del admin requerido'),
  adminPhone: optionalStr,
});

const updateTenantSchema = createTenantSchema.partial();

module.exports = { createTenantSchema, createTenantWithAdminSchema, updateTenantSchema };
