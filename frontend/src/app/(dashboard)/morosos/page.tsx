'use client';

import { useEffect, useState } from 'react';
import { paymentsApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';
import { ExclamationTriangleIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const LIMIT = 20;

export default function MorososPage() {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const load = (p = page, q = search) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (q) params.set('search', q);
    paymentsApi.delinquent(params.toString())
      .then((res: any) => {
        setUnits(res.data || []);
        setTotal(res.pagination?.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { setPage(1); load(1, search); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(page, search); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <PageHeader title="Morosos" subtitle={`${total} unidades con adeudo pendiente`} />

      {/* Búsqueda */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Buscar por unidad o propietario..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field max-w-sm"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card animate-pulse h-32" />
          ))}
        </div>
      ) : units.length === 0 ? (
        <div className="glass-card text-center py-12">
          <p className="text-slate-400 text-lg">
            {search ? 'Sin resultados para la búsqueda' : 'Todas las unidades están al corriente'}
          </p>
        </div>
      ) : (
        <>
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
                      <span className="badge-danger mt-1">Adeudo pendiente</span>
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

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-slate-500">
                Página {page} de {totalPages} · {total} unidades
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeftIcon className="w-4 h-4" /> Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
