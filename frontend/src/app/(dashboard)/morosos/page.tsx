'use client';

import { useEffect, useState } from 'react';
import { paymentsApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function MorososPage() {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paymentsApi.delinquent()
      .then((res: any) => setUnits(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Morosos" subtitle="Unidades con adeudo pendiente" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card animate-pulse h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Morosos" subtitle={`${units.length} unidades con adeudo pendiente`} />

      {units.length === 0 ? (
        <div className="glass-card text-center py-12">
          <p className="text-slate-400 text-lg">Todas las unidades están al corriente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {units.map((unit: any) => {
            const totalDebt = unit.charges?.reduce(
              (sum: number, c: any) => sum + (parseFloat(c.amount) - parseFloat(c.paidAmount || 0)),
              0
            ) || 0;

            return (
              <div key={unit.id} className="glass-card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                      <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">Unidad {unit.identifier}</h3>
                      <p className="text-sm text-slate-500">{unit.ownerName || 'Sin propietario'}</p>
                      {unit.residents?.map((r: any) => (
                        <p key={r.id} className="text-xs text-slate-400">
                          {r.user.firstName} {r.user.lastName} - {r.user.email}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-600">${totalDebt.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{unit.charges?.length || 0} cargos pendientes</p>
                    <span className="badge-danger mt-1">Acceso bloqueado por app</span>
                  </div>
                </div>

                {unit.charges && unit.charges.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Cargos pendientes</p>
                    <div className="space-y-1">
                      {unit.charges.map((charge: any) => (
                        <div key={charge.id} className="flex justify-between text-sm">
                          <span className="text-slate-600">{charge.description}</span>
                          <span className="text-slate-800 font-medium">${parseFloat(charge.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
