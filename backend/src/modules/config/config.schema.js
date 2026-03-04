const { z } = require('zod');

// ── Payment config ──────────────────────────────────────────────

const bankAccountSchema = z.object({
  bankName: z.string().min(1, 'Nombre de banco requerido'),
  accountHolder: z.string().min(1, 'Titular requerido'),
  clabe: z.string().optional(),
  accountNumber: z.string().optional(),
  referenceTemplate: z.string().optional(),
});

const additionalChargeSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  amount: z.number().min(0),
  dueDate: z.string().optional(),
  description: z.string().optional(),
});

const paymentConfigSchema = z.object({
  monthlyAmount: z.number().min(0).optional(),
  currency: z.string().optional(),
  paymentConcept: z.string().optional(),
  dueDayOfMonth: z.number().int().min(1).max(31).optional(),
  gracePeriodDays: z.number().int().min(0).max(30).optional(),
  bankAccounts: z.array(bankAccountSchema).optional(),
  additionalCharges: z.array(additionalChargeSchema).optional(),
}).optional();

// ── Emergency numbers ───────────────────────────────────────────

const emergencyNumberSchema = z.object({
  instance: z.string().min(1, 'Instancia requerida'),
  number:   z.string().min(1, 'Número requerido'),
});

const emergencyNumbersSchema = z.array(emergencyNumberSchema).optional();

// ── Integraciones ───────────────────────────────────────────────

const integrationTypes = [
  'ERREKA_MQTT',
  'ERREKA_IP',
  'HIKVISION_ISAPI',
  'AXIS_VAPIX',
  'ONVIF',
  'GENERIC_MQTT',
];

const createIntegrationSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  type: z.enum(integrationTypes),
  brand: z.string().optional(),
  model: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  mqttTopic: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

const updateIntegrationSchema = createIntegrationSchema.partial();

// ── ServiceQR config ─────────────────────────────────────────────

const serviceQrConfigSchema = z.object({
  enabled:            z.boolean().optional(),
  deviceId:           z.string().optional(),
  exitDeviceId:       z.string().optional(),
  exitQrValidHours:   z.number().int().min(1).max(24).optional(),
  services:           z.array(z.string()).optional(),
  guardCanApprove:    z.boolean().optional(),
  adminCanApprove:    z.boolean().optional(),
  showResidentPhone:  z.boolean().optional(),
  requireUnit:        z.boolean().optional(),
  requirePhoto:       z.boolean().optional(),
  requestTtlMinutes:  z.number().int().min(5).max(120).optional(),
  rotateDays:         z.number().int().min(0).max(30).optional(),
}).optional();

// ── Feature flags ─────────────────────────────────────────────────

const featureFlagsSchema = z.object({
  showResidentAccessButton: z.boolean().optional(),
  showVisitorAccessButton: z.boolean().optional(),
  showExitButton: z.boolean().optional(),
  quickQrEnabled: z.boolean().optional(),
  quickQrDurationHours: z.number().int().min(1).max(24).optional(),
  quickQrMaxUses: z.number().int().min(1).max(10).optional(),
  residentEntryDeviceId: z.string().optional(),
  residentExitDeviceId: z.string().optional(),
  visitorEntryDeviceId: z.string().optional(),
  visitorExitDeviceId: z.string().optional(),
}).optional();

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  logo: z.string().optional(),
  featureFlags: featureFlagsSchema,
  uiTheme: z.enum(['DARK', 'LIGHT']).optional(),
  paymentConfig: paymentConfigSchema,
  emergencyNumbers: emergencyNumbersSchema,
  serviceQrConfig: serviceQrConfigSchema,
});

module.exports = { createIntegrationSchema, updateIntegrationSchema, updateTenantSchema };
