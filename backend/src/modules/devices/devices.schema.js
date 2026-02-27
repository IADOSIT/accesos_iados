const { z } = require('zod');

const createDeviceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['GATE', 'DOOR', 'BARRIER']).default('GATE'),
  mqttTopic: z.string().optional(),
  location: z.string().optional(),
});

const updateDeviceSchema = createDeviceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

module.exports = { createDeviceSchema, updateDeviceSchema };
