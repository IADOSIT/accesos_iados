'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
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
  const { user, role, tenantId, logout } = useAuthStore();

  const navigation = role === 'GUARD' ? guardNav : adminNav;
  const isSuperAdmin = user?.isSuperAdmin;

  return (
    <aside className="fixed inset-y-0 left-0 w-64 glass border-r border-white/20 z-40 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Hexágono iaDoS */}
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
              <polygon
                points="24,2 44,13 44,35 24,46 4,35 4,13"
                fill="#10B981"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <text
                x="24"
                y="28"
                textAnchor="middle"
                fill="white"
                fontSize="11"
                fontWeight="bold"
                fontFamily="system-ui, sans-serif"
                letterSpacing="0.5"
              >
                iaDoS
              </text>
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-800 leading-tight">Acceso Digital</h1>
            <p className="text-xs text-emerald-600 font-medium">iaDoS</p>
          </div>
        </div>
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

      {/* Tenant activo */}
      {!isSuperAdmin && tenantId && (
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Fraccionamiento</p>
          <p className="text-sm font-semibold text-emerald-800 truncate">
            {user?.tenants.find(t => t.tenantId === tenantId)?.tenantName || '—'}
          </p>
          <p className="text-[10px] text-emerald-500 capitalize">
            {user?.tenants.find(t => t.tenantId === tenantId)?.role?.toLowerCase()}
          </p>
        </div>
      )}

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
  );
}
