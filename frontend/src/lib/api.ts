const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function api<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) headers['x-tenant-id'] = tenantId;
  // options.headers override defaults (permite superAdmin seleccionar tenant)
  if (options.headers) Object.assign(headers, options.headers);

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('tenantId');
        window.location.href = '/login';
      }
    }
    throw new Error(data.message || 'Error en la solicitud');
  }

  return data as T;
}

export const GET = <T = unknown>(url: string) => api<T>(url);
export const POST = <T = unknown>(url: string, body: unknown) => api<T>(url, { method: 'POST', body });
export const PUT = <T = unknown>(url: string, body: unknown) => api<T>(url, { method: 'PUT', body });
export const DELETE = <T = unknown>(url: string) => api<T>(url, { method: 'DELETE' });

export default api;
