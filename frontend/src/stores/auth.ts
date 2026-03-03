import { create } from 'zustand';
import { POST, GET } from '@/lib/api';

interface TenantInfo {
  tenantId: string;
  tenantName: string;
  role: string;
  unitId: string | null;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  tenants: TenantInfo[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  tenantId: string | null;
  role: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setTenant: (tenantId: string) => void;
  checkAuth: () => Promise<void>;
}

/** Elige el tenant activo: respeta el guardado si sigue siendo válido para este usuario */
function resolveTenant(tenants: TenantInfo[]): TenantInfo | null {
  if (!tenants.length) return null;
  const saved = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
  return (saved ? tenants.find(t => t.tenantId === saved) : null) ?? tenants[0];
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  tenantId: typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null,
  role: null,
  isLoading: true,

  login: async (email, password) => {
    const res = await POST<{ data: { accessToken: string; user: User } }>('/auth/login', { email, password });
    const { accessToken, user } = res.data;

    localStorage.setItem('token', accessToken);

    // Usar el tenant guardado si aún pertenece al usuario; si no, el primero disponible
    const active = resolveTenant(user.tenants);
    if (active) localStorage.setItem('tenantId', active.tenantId);

    set({
      user,
      token: accessToken,
      tenantId: active?.tenantId || null,
      role: active?.role || null,
      isLoading: false,
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
    set({ user: null, token: null, tenantId: null, role: null });
    window.location.href = '/login';
  },

  setTenant: (tenantId) => {
    localStorage.setItem('tenantId', tenantId);
    const user = get().user;
    const tenant = user?.tenants.find(t => t.tenantId === tenantId);
    set({ tenantId, role: tenant?.role || null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const res = await GET<{ data: User }>('/auth/me');
      const user = res.data;

      // Validar y resolver tenant guardado
      const active = resolveTenant(user.tenants);
      if (active) localStorage.setItem('tenantId', active.tenantId);
      else { localStorage.removeItem('tenantId'); }

      set({
        user,
        tenantId: active?.tenantId || null,
        role: active?.role || null,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('tenantId');
      set({ user: null, token: null, tenantId: null, role: null, isLoading: false });
    }
  },
}));
