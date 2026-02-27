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
    const defaultTenant = user.tenants[0];
    if (defaultTenant) {
      localStorage.setItem('tenantId', defaultTenant.tenantId);
    }

    set({
      user,
      token: accessToken,
      tenantId: defaultTenant?.tenantId || null,
      role: defaultTenant?.role || null,
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
      const tenantId = localStorage.getItem('tenantId');
      const tenant = res.data.tenants.find(t => t.tenantId === tenantId);
      set({ user: res.data, isLoading: false, role: tenant?.role || null });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
