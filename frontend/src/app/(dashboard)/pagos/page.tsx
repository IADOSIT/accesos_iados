'use client';

import { useEffect, useState } from 'react';
import { paymentsApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';

interface QuickPaymentForm {
  amount: string;
  method: string;
  reference: string;
  notes: string;
}

function monthToRange(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const from = new Date(y, m - 1, 1).toISOString();
  const to = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
  return { from, to };
}

export default function PagosPage() {
  const [tab, setTab] = useState<'charges' | 'payments'>('charges');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  // Filtros cargos
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Filtros pagos
  const [filterPayMonth, setFilterPayMonth] = useState('');

  // Modal nuevo cargo
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeForm, setChargeForm] = useState({ unitId: '', type: 'MONTHLY', amount: '', description: '', dueDate: '' });

  // Modal registrar pago (standalone)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ unitId: '', chargeId: '', amount: '', method: 'CASH', reference: '', notes: '' });

  // Modal "Pago recibido" desde fila de cargo
  const [showQuickPayModal, setShowQuickPayModal] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<any | null>(null);
  const [quickForm, setQuickForm] = useState<QuickPaymentForm>({ amount: '', method: 'CASH', reference: '', notes: '' });
  const [quickLoading, setQuickLoading] = useState(false);

  const buildParams = (t: string, p: number) => {
    const q = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (t === 'charges') {
      if (filterStatus) q.set('status', filterStatus);
      if (filterMonth) {
        const { from, to } = monthToRange(filterMonth);
        q.set('from', from);
        q.set('to', to);
      }
    } else {
      if (filterPayMonth) {
        const { from, to } = monthToRange(filterPayMonth);
        q.set('from', from);
        q.set('to', to);
      }
    }
    return q.toString();
  };

  const load = (t = tab, p = page) => {
    setLoading(true);
    const fn = t === 'charges' ? paymentsApi.charges : paymentsApi.payments;
    fn(buildParams(t, p))
      .then((res: any) => {
        setData(res.data || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotal(res.pagination?.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Al cambiar tab: reset filtros y página
  useEffect(() => {
    setPage(1);
    setFilterStatus('');
    setFilterMonth('');
    setFilterPayMonth('');
    load(tab, 1);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar filtros: reset a página 1
  useEffect(() => { setPage(1); load(tab, 1); }, [filterStatus, filterMonth, filterPayMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar página
  useEffect(() => { load(tab, page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Abrir modal "Pago recibido" desde fila
  const openQuickPay = (charge: any) => {
    const remaining = parseFloat(charge.amount) - parseFloat(charge.paidAmount || 0);
    setSelectedCharge(charge);
    setQuickForm({ amount: remaining.toFixed(2), method: 'CASH', reference: '', notes: '' });
    setShowQuickPayModal(true);
  };

  const handleQuickPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharge) return;
    setQuickLoading(true);
    try {
      await paymentsApi.createPayment({
        unitId: selectedCharge.unitId,
        chargeId: selectedCharge.id,
        amount: parseFloat(quickForm.amount),
        method: quickForm.method,
        reference: quickForm.reference || undefined,
        notes: quickForm.notes || undefined,
      });
      setShowQuickPayModal(false);
      setSelectedCharge(null);
      load(tab, page);
    } catch (err) { alert(err instanceof Error ? err.message : 'Error al registrar pago'); }
    finally { setQuickLoading(false); }
  };

  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await paymentsApi.createCharge({ ...chargeForm, amount: parseFloat(chargeForm.amount), dueDate: new Date(chargeForm.dueDate).toISOString() });
      setShowChargeModal(false);
      load(tab, page);
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await paymentsApi.createPayment({ ...paymentForm, amount: parseFloat(paymentForm.amount), chargeId: paymentForm.chargeId || undefined });
      setShowPaymentModal(false);
      load(tab, page);
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const typeLabels: Record<string, string> = { MONTHLY: 'Mensual', EXTRAORDINARY: 'Extraordinaria', PENALTY: 'Recargo', OTHER: 'Otro' };
  const statusLabels: Record<string, string> = { PENDING: 'Pendiente', PAID: 'Pagado', PARTIAL: 'Parcial', CANCELLED: 'Cancelado' };
  const methodLabels: Record<string, string> = { CASH: 'Efectivo', TRANSFER: 'Transferencia', CARD: 'Tarjeta', CHECK: 'Cheque', OTHER: 'Otro' };

  const chargeColumns = [
    { key: 'unit', header: 'Unidad', render: (row: any) => row.unit?.identifier || '-' },
    { key: 'description', header: 'Concepto' },
    { key: 'type', header: 'Tipo', render: (row: any) => typeLabels[row.type] || row.type },
    {
      key: 'amount', header: 'Monto',
      render: (row: any) => {
        const remaining = parseFloat(row.amount) - parseFloat(row.paidAmount || 0);
        return (
          <span>
            ${parseFloat(row.amount).toLocaleString()}
            {row.status === 'PARTIAL' && (
              <span className="text-xs text-amber-600 ml-1">(rest. ${remaining.toLocaleString()})</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'status', header: 'Estado',
      render: (row: any) => (
        <span className={row.status === 'PAID' ? 'badge-success' : row.status === 'PENDING' ? 'badge-danger' : 'badge-warning'}>
          {statusLabels[row.status] || row.status}
        </span>
      ),
    },
    { key: 'dueDate', header: 'Vencimiento', render: (row: any) => new Date(row.dueDate).toLocaleDateString('es-MX') },
    {
      key: 'actions', header: '',
      render: (row: any) => {
        if (row.status === 'PAID' || row.status === 'CANCELLED') return null;
        return (
          <button
            onClick={() => openQuickPay(row)}
            className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
          >
            ✓ Pago recibido
          </button>
        );
      },
    },
  ];

  const paymentColumns = [
    { key: 'createdAt', header: 'Fecha', render: (row: any) => new Date(row.createdAt).toLocaleDateString('es-MX') },
    { key: 'unit', header: 'Unidad', render: (row: any) => row.unit?.identifier || '-' },
    { key: 'amount', header: 'Monto', render: (row: any) => `$${parseFloat(row.amount).toLocaleString()}` },
    { key: 'method', header: 'Método', render: (row: any) => methodLabels[row.method] || row.method },
    { key: 'charge', header: 'Cargo', render: (row: any) => row.charge?.description || 'Sin cargo asociado' },
    { key: 'reference', header: 'Referencia', render: (row: any) => row.reference || '-' },
    {
      key: 'reconciled', header: 'Conciliado',
      render: (row: any) => (
        <span className={row.reconciled ? 'badge-success' : 'badge-warning'}>
          {row.reconciled ? 'Sí' : 'No'}
        </span>
      ),
    },
  ];

  const hasActiveFilters = filterStatus || filterMonth || filterPayMonth;

  return (
    <div>
      <PageHeader
        title="Pagos y Cargos"
        subtitle="Administración financiera del fraccionamiento"
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowChargeModal(true)} className="btn-secondary">+ Nuevo cargo</button>
            <button onClick={() => setShowPaymentModal(true)} className="btn-primary">+ Registrar pago</button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white/50 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('charges')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'charges' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>
          Cargos
        </button>
        <button onClick={() => setTab('payments')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'payments' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>
          Pagos
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-5 p-4 bg-white/60 border border-slate-100 rounded-xl">
        {tab === 'charges' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="input-field py-2 text-sm min-w-[140px]"
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendiente</option>
                <option value="PARTIAL">Parcial</option>
                <option value="PAID">Pagado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Mes de vencimiento</label>
              <input
                type="month"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="input-field py-2 text-sm"
              />
            </div>
          </>
        )}

        {tab === 'payments' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Mes</label>
            <input
              type="month"
              value={filterPayMonth}
              onChange={e => setFilterPayMonth(e.target.value)}
              className="input-field py-2 text-sm"
            />
          </div>
        )}

        {hasActiveFilters && (
          <button
            onClick={() => { setFilterStatus(''); setFilterMonth(''); setFilterPayMonth(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline self-end pb-2"
          >
            Limpiar filtros
          </button>
        )}

        <span className="ml-auto self-end pb-2 text-sm text-slate-400">
          {total} registro{total !== 1 ? 's' : ''}
        </span>
      </div>

      <DataTable
        columns={tab === 'charges' ? chargeColumns : paymentColumns}
        data={data}
        loading={loading}
        emptyMessage={tab === 'charges' ? 'No hay cargos registrados' : 'No hay pagos registrados'}
      />

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-sm text-slate-500">
            {total} registros · Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn-secondary text-sm disabled:opacity-40">
              ← Anterior
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="btn-secondary text-sm disabled:opacity-40">
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Pago recibido (desde fila de cargo) ── */}
      <Modal
        isOpen={showQuickPayModal}
        onClose={() => { setShowQuickPayModal(false); setSelectedCharge(null); }}
        title="Registrar pago"
      >
        {selectedCharge && (
          <form onSubmit={handleQuickPay} className="space-y-4">
            {/* Info del cargo */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Unidad</span>
                <span className="font-semibold text-slate-700">{selectedCharge.unit?.identifier || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Cargo</span>
                <span className="font-medium text-slate-700">{selectedCharge.description}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Vencimiento</span>
                <span className="text-slate-600">{new Date(selectedCharge.dueDate).toLocaleDateString('es-MX')}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-200 pt-1 mt-1">
                <span className="text-slate-500">Total del cargo</span>
                <span className="font-bold text-slate-800">${parseFloat(selectedCharge.amount).toLocaleString()}</span>
              </div>
              {parseFloat(selectedCharge.paidAmount || 0) > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Ya abonado</span>
                  <span>${parseFloat(selectedCharge.paidAmount).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto a pagar *</label>
                <input className="input-field" type="number" step="0.01" min="0.01"
                  value={quickForm.amount}
                  onChange={e => setQuickForm({ ...quickForm, amount: e.target.value })}
                  required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Método de pago</label>
                <select className="input-field" value={quickForm.method}
                  onChange={e => setQuickForm({ ...quickForm, method: e.target.value })}>
                  <option value="CASH">Efectivo</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="CHECK">Cheque</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Referencia / Folio</label>
              <input className="input-field" placeholder="ej. TRF-12345 (opcional)"
                value={quickForm.reference}
                onChange={e => setQuickForm({ ...quickForm, reference: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
              <input className="input-field" placeholder="Observaciones (opcional)"
                value={quickForm.notes}
                onChange={e => setQuickForm({ ...quickForm, notes: e.target.value })} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowQuickPayModal(false); setSelectedCharge(null); }}
                className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={quickLoading}
                className="btn-primary disabled:opacity-60">
                {quickLoading ? 'Registrando...' : '✓ Confirmar pago'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Modal: Nuevo Cargo ── */}
      <Modal isOpen={showChargeModal} onClose={() => setShowChargeModal(false)} title="Nuevo Cargo">
        <form onSubmit={handleCreateCharge} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ID Unidad *</label>
            <input className="input-field" value={chargeForm.unitId} onChange={(e) => setChargeForm({ ...chargeForm, unitId: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select className="input-field" value={chargeForm.type} onChange={(e) => setChargeForm({ ...chargeForm, type: e.target.value })}>
                <option value="MONTHLY">Mensual</option>
                <option value="EXTRAORDINARY">Extraordinaria</option>
                <option value="PENALTY">Recargo</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monto *</label>
              <input className="input-field" type="number" step="0.01" value={chargeForm.amount} onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción *</label>
            <input className="input-field" value={chargeForm.description} onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vencimiento *</label>
            <input className="input-field" type="date" value={chargeForm.dueDate} onChange={(e) => setChargeForm({ ...chargeForm, dueDate: e.target.value })} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowChargeModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Crear cargo</button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Registrar Pago (standalone) ── */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Registrar Pago">
        <form onSubmit={handleCreatePayment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ID Unidad *</label>
            <input className="input-field" value={paymentForm.unitId} onChange={(e) => setPaymentForm({ ...paymentForm, unitId: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monto *</label>
              <input className="input-field" type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Método</label>
              <select className="input-field" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CARD">Tarjeta</option>
                <option value="CHECK">Cheque</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ID Cargo (opcional)</label>
            <input className="input-field" placeholder="Dejar vacío si no aplica" value={paymentForm.chargeId} onChange={(e) => setPaymentForm({ ...paymentForm, chargeId: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Referencia</label>
            <input className="input-field" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <input className="input-field" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Registrar pago</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
