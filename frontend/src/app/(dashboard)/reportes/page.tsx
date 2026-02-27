'use client';

import { useEffect, useState } from 'react';
import { reportsApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import {
  ArrowsRightLeftIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

export default function ReportesPage() {
  const [tab, setTab] = useState<'access' | 'payments' | 'delinquency' | 'guards' | 'usage'>('access');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const p = params.toString();

    const fetchers: Record<string, () => Promise<any>> = {
      access: () => reportsApi.access(p),
      payments: () => reportsApi.payments(p),
      delinquency: () => reportsApi.delinquency(),
      guards: () => reportsApi.guardActivity(p),
      usage: () => reportsApi.unitUsage(p),
    };

    fetchers[tab]()
      .then((res: any) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tab, from, to]);

  const tabs = [
    { key: 'access', label: 'Accesos' },
    { key: 'payments', label: 'Pagos' },
    { key: 'delinquency', label: 'Morosidad' },
    { key: 'guards', label: 'Guardias' },
    { key: 'usage', label: 'Uso por unidad' },
  ];

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Análisis operativo y financiero" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/50 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros de fecha */}
      {tab !== 'delinquency' && (
        <div className="flex gap-4 mb-6">
          <input type="date" className="input-field w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input-field w-44" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="glass-card animate-pulse h-28" />)}
        </div>
      ) : (
        <div>
          {/* Reporte de Accesos */}
          {tab === 'access' && data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Total accesos" value={data.total} icon={ArrowsRightLeftIcon} color="blue" />
              <StatCard title="Concedidos" value={data.granted} icon={ArrowsRightLeftIcon} color="green" />
              <StatCard title="Denegados" value={data.denied} icon={ArrowsRightLeftIcon} color="red" />
            </div>
          )}

          {/* Reporte de Pagos */}
          {tab === 'payments' && data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Total pagos" value={data.totalPayments} icon={CreditCardIcon} color="blue" />
              <StatCard title="Monto total" value={`$${parseFloat(data.totalAmount).toLocaleString()}`} icon={CreditCardIcon} color="green" />
              <div className="glass-card">
                <h3 className="font-semibold text-slate-700 mb-3">Por método</h3>
                {data.byMethod?.map((m: any) => (
                  <div key={m.method} className="flex justify-between text-sm py-1">
                    <span className="text-slate-600">{m.method}</span>
                    <span className="font-medium">{m._count} pagos</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reporte de Morosidad */}
          {tab === 'delinquency' && data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Total unidades" value={data.totalUnits} icon={BuildingOfficeIcon} color="blue" />
              <StatCard title="Morosos" value={data.delinquentUnits} subtitle={`${data.delinquencyRate}% tasa morosidad`} icon={ExclamationTriangleIcon} color="red" />
              <StatCard title="Adeudo total" value={`$${parseFloat(data.totalPendingAmount).toLocaleString()}`} subtitle={`${data.totalPendingCharges} cargos pendientes`} icon={CreditCardIcon} color="amber" />
            </div>
          )}

          {/* Reporte de Guardias */}
          {tab === 'guards' && data && (
            <div className="glass-card">
              <h3 className="font-semibold text-slate-700 mb-4">Actividad de guardias</h3>
              {Array.isArray(data) && data.length > 0 ? (
                <div className="space-y-3">
                  {data.map((g: any) => (
                    <div key={g.userId} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <UserGroupIcon className="w-5 h-5 text-slate-400" />
                        <span className="font-medium text-slate-700">{g.guardName}</span>
                      </div>
                      <span className="badge-info">{g.totalActions} acciones</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">Sin actividad de guardias</p>
              )}
            </div>
          )}

          {/* Reporte de Uso por unidad */}
          {tab === 'usage' && data && (
            <div className="glass-card">
              <h3 className="font-semibold text-slate-700 mb-4">Uso por unidad (Top 50)</h3>
              {Array.isArray(data) && data.length > 0 ? (
                <div className="space-y-2">
                  {data.map((u: any, i: number) => (
                    <div key={u.unitId} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-400 w-6">#{i + 1}</span>
                        <span className="font-medium text-slate-700">Unidad {u.identifier}</span>
                      </div>
                      <span className="badge-info">{u.totalAccesses} accesos</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">Sin datos de uso</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
