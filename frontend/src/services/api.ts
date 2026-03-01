import { GET, POST, PUT, PATCH, DELETE } from '@/lib/api';

// ============ AUTH ============
export const authApi = {
  login: (email: string, password: string) => POST('/auth/login', { email, password }),
  register: (data: unknown) => POST('/auth/register', data),
  me: () => GET('/auth/me'),
  changePassword: (data: unknown) => PUT('/auth/change-password', data),
};

// ============ UNIDADES ============
export const unitsApi = {
  list: (params?: string) => GET(`/units${params ? `?${params}` : ''}`),
  get: (id: string) => GET(`/units/${id}`),
  create: (data: unknown) => POST('/units', data),
  update: (id: string, data: unknown) => PUT(`/units/${id}`, data),
  deactivate: (id: string) => POST(`/units/${id}/deactivate`, {}),
  activate: (id: string) => POST(`/units/${id}/activate`, {}),
  remove: (id: string) => DELETE(`/units/${id}`),
};

// ============ USUARIOS ============
export const usersApi = {
  list: (params?: string) => GET(`/users${params ? `?${params}` : ''}`),
  get: (id: string) => GET(`/users/${id}`),
  create: (data: unknown) => POST('/users', data),
  update: (id: string, data: unknown) => PUT(`/users/${id}`, data),
  deactivate: (id: string) => POST(`/users/${id}/deactivate`, {}),
  activate: (id: string) => POST(`/users/${id}/activate`, {}),
  remove: (id: string) => DELETE(`/users/${id}`),
};

// ============ DISPOSITIVOS ============
export const devicesApi = {
  list: () => GET('/devices'),
  get: (id: string) => GET(`/devices/${id}`),
  create: (data: unknown) => POST('/devices', data),
  update: (id: string, data: unknown) => PUT(`/devices/${id}`, data),
  deactivate: (id: string) => POST(`/devices/${id}/deactivate`, {}),
  activate: (id: string) => POST(`/devices/${id}/activate`, {}),
  remove: (id: string) => DELETE(`/devices/${id}`),
};

// ============ ACCESOS ============
export const accessApi = {
  open: (data: unknown) => POST('/access/open', data),
  generateQR: (data: unknown) => POST('/access/qr', data),
  logs: (params?: string) => GET(`/access/logs${params ? `?${params}` : ''}`),
};

// ============ PAGOS ============
export const paymentsApi = {
  charges: (params?: string) => GET(`/payments/charges${params ? `?${params}` : ''}`),
  createCharge: (data: unknown) => POST('/payments/charges', data),
  payments: (params?: string) => GET(`/payments/payments${params ? `?${params}` : ''}`),
  createPayment: (data: unknown) => POST('/payments/payments', data),
  reconcile: (paymentIds: string[]) => POST('/payments/reconcile', { paymentIds }),
  delinquent: () => GET('/payments/delinquent'),
  bulkPayments: (data: unknown) => POST('/payments/bulk', data),
};

// ============ TENANTS (Super Admin) ============
export const tenantsApi = {
  list: () => GET('/tenants'),
  get: (id: string) => GET(`/tenants/${id}`),
  create: (data: unknown) => POST('/tenants', data),
  createWithAdmin: (data: unknown) => POST('/tenants/with-admin', data),
  update: (id: string, data: unknown) => PUT(`/tenants/${id}`, data),
  deactivate: (id: string) => POST(`/tenants/${id}/deactivate`, {}),
  activate: (id: string) => POST(`/tenants/${id}/activate`, {}),
  remove: (id: string) => DELETE(`/tenants/${id}`),
  stats: () => GET('/tenants/stats'),
};

// ============ CONFIGURACION ============
export const configApi = {
  // Tenant
  getTenant: () => GET('/config/tenant'),
  updateTenant: (data: unknown) => PUT('/config/tenant', data),
  // Integraciones
  listIntegrations: () => GET('/config/integraciones'),
  createIntegration: (data: unknown) => POST('/config/integraciones', data),
  updateIntegration: (id: string, data: unknown) => PUT(`/config/integraciones/${id}`, data),
  deleteIntegration: (id: string) => DELETE(`/config/integraciones/${id}`),
  testIntegration: (id: string) => POST(`/config/integraciones/${id}/test`, {}),
};

// ============ NOTIFICACIONES ============
export const notificationsApi = {
  list: () => GET('/notifications'),
  unreadCount: () => GET('/notifications/unread-count'),
  readAll: () => PATCH('/notifications/read-all', {}),
  getConfig: () => GET('/notifications/config'),
  updateConfig: (data: unknown) => PUT('/notifications/config', data),
  history: (params?: string) => GET(`/notifications/history${params ? `?${params}` : ''}`),
  broadcast: (data: unknown) => POST('/notifications/broadcast', data),
};

// ============ REPORTES ============
export const reportsApi = {
  dashboard: () => GET('/reports/dashboard'),
  access: (params?: string) => GET(`/reports/access${params ? `?${params}` : ''}`),
  payments: (params?: string) => GET(`/reports/payments${params ? `?${params}` : ''}`),
  delinquency: () => GET('/reports/delinquency'),
  guardActivity: (params?: string) => GET(`/reports/guard-activity${params ? `?${params}` : ''}`),
  unitUsage: (params?: string) => GET(`/reports/unit-usage${params ? `?${params}` : ''}`),
};
