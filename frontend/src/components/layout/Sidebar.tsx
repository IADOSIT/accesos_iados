'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { tenantsApi } from '@/services/api';
import clsx from 'clsx';
import {
  HomeIcon,
  BuildingOfficeIcon,
  UsersIcon,
  CpuChipIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  BuildingOffice2Icon,
  BellIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const adminNav = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Unidades', href: '/unidades', icon: BuildingOfficeIcon },
  { name: 'Usuarios', href: '/usuarios', icon: UsersIcon },
  { name: 'Dispositivos', href: '/dispositivos', icon: CpuChipIcon },
  { name: 'Bitácora', href: '/bitacora', icon: ClipboardDocumentListIcon },
  { name: 'Pagos', href: '/pagos', icon: CreditCardIcon },
  { name: 'Morosos', href: '/morosos', icon: ExclamationTriangleIcon },
  { name: 'Reportes', href: '/reportes', icon: ChartBarIcon },
  { name: 'Notificaciones', href: '/notificaciones', icon: BellIcon },
  { name: 'Configuración', href: '/configuracion', icon: Cog6ToothIcon },
];

const guardNav = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Bitácora', href: '/bitacora', icon: ClipboardDocumentListIcon },
  { name: 'Morosos', href: '/morosos', icon: ExclamationTriangleIcon },
];

const superAdminNav = [
  { name: 'Fraccionamientos', href: '/admin/fraccionamientos', icon: BuildingOffice2Icon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role, tenantId, setTenant, logout } = useAuthStore();
  const [allTenants, setAllTenants] = useState<{ id: string; name: string }[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = role === 'GUARD' ? guardNav : adminNav;
  const isSuperAdmin = user?.isSuperAdmin;

  // Cargar todos los tenants para SuperAdmin (una sola vez)
  useEffect(() => {
    if (!isSuperAdmin) return;
    tenantsApi.list()
      .then((res: any) => setAllTenants((res.data || []).map((t: any) => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar menú al navegar
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Opciones del switcher: SuperAdmin ve todos; ADMIN ve sus tenants
  const switcherOptions = isSuperAdmin
    ? allTenants
    : (user?.tenants || []).map(t => ({ id: t.tenantId, name: t.tenantName }));

  const activeTenantName = isSuperAdmin
    ? (allTenants.find(t => t.id === tenantId)?.name || user?.tenants?.find(t => t.tenantId === tenantId)?.tenantName || '—')
    : (user?.tenants?.find(t => t.tenantId === tenantId)?.tenantName || '—');

  return (
    <>
      {/* Topbar móvil — solo visible en < md */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-50 glass border-b border-white/20 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg hover:bg-white/40 transition-colors"
          aria-label="Abrir menú"
        >
          <Bars3Icon className="w-6 h-6 text-slate-700" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo3_ia2.png" alt="iaDoS" className="w-8 h-auto" />
        <div>
          <p className="text-sm font-bold text-slate-800 leading-tight">Acceso Digital</p>
          <p className="text-[10px] text-emerald-600 font-medium leading-tight">iaDoS</p>
        </div>
      </div>

      {/* Backdrop — solo en móvil cuando el menú está abierto */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={clsx(
        'fixed inset-y-0 left-0 w-64 glass border-r border-white/20 z-50 flex flex-col transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* Logo — horizontal en desktop, con botón cerrar en móvil */}
        <div className="px-4 pt-4 pb-4 border-b border-white/10 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo3_ia2.png" alt="iaDoS" className="w-10 h-auto shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm text-slate-800 leading-tight">Acceso Digital</h1>
            <p className="text-xs text-emerald-600 font-medium">iaDoS</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 rounded-lg hover:bg-white/40 transition-colors shrink-0"
            aria-label="Cerrar menú"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Super Admin */}
        {isSuperAdmin && (
          <>
            <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-amber-600 uppercase tracking-widest">
              Super Admin
            </p>
            {superAdminNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'text-amber-700 hover:bg-amber-50 hover:text-amber-800'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
            <div className="border-t border-slate-100 my-3" />
            <p className="px-3 pt-1 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Operación
            </p>
          </>
        )}

        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-800'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Tenant switcher */}
      {switcherOptions.length > 1 ? (
        <div className="mx-3 mb-3">
          <p className="px-1 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fraccionamiento</p>
          <select
            value={tenantId || ''}
            onChange={(e) => setTenant(e.target.value)}
            className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            {switcherOptions.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      ) : tenantId ? (
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Fraccionamiento</p>
          <p className="text-sm font-semibold text-emerald-800 truncate">{activeTenantName}</p>
          {!isSuperAdmin && (
            <p className="text-[10px] text-emerald-500 capitalize">
              {user?.tenants.find(t => t.tenantId === tenantId)?.role?.toLowerCase()}
            </p>
          )}
        </div>
      ) : null}

      {/* Usuario */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className={clsx(
            'w-9 h-9 rounded-full flex items-center justify-center',
            isSuperAdmin ? 'bg-amber-100' : 'bg-primary-100'
          )}>
            <span className={clsx('text-sm font-bold', isSuperAdmin ? 'text-amber-700' : 'text-primary-700')}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {isSuperAdmin ? 'Super Admin' : role}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
      </aside>
    </>
  );
}
