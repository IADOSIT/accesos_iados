const { z } = require('zod');

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

const featureFlagsSchema = z.object({
  showResidentAccessButton: z.boolean().optional(),
  showVisitorAccessButton: z.boolean().optional(),
  showExitButton: z.boolean().optional(),
  quickQrEnabled: z.boolean().optional(),
  quickQrDurationHours: z.number().int().min(1).max(24).optional(),
  quickQrMaxUses: z.number().int().min(1).max(10).optional(),
}).optional();

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  logo: z.string().optional(),
  featureFlags: featureFlagsSchema,
  uiTheme: z.enum(['DARK', 'LIGHT']).optional(),
});

module.exports = { createIntegrationSchema, updateIntegrationSchema, updateTenantSchema };
