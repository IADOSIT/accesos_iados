'use client';

import { useEffect, useState } from 'react';
import { paymentsApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';

export default function PagosPage() {
  const [tab, setTab] = useState<'charges' | 'payments'>('charges');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [chargeForm, setChargeForm] = useState({ unitId: '', type: 'MONTHLY', amount: '', description: '', dueDate: '' });
  const [paymentForm, setPaymentForm] = useState({ unitId: '', chargeId: '', amount: '', method: 'CASH', reference: '', notes: '' });

  const load = () => {
    setLoading(true);
    const fn = tab === 'charges' ? paymentsApi.charges : paymentsApi.payments;
    fn()
      .then((res: any) => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tab]);

  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await paymentsApi.createCharge({ ...chargeForm, amount: parseFloat(chargeForm.amount), dueDate: new Date(chargeForm.dueDate).toISOString() });
      setShowChargeModal(false);
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await paymentsApi.createPayment({ ...paymentForm, amount: parseFloat(paymentForm.amount), chargeId: paymentForm.chargeId || undefined });
      setShowPaymentModal(false);
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const typeLabels: Record<string, string> = { MONTHLY: 'Mensual', EXTRAORDINARY: 'Extraordinaria', PENALTY: 'Recargo', OTHER: 'Otro' };
  const statusLabels: Record<string, string> = { PENDING: 'Pendiente', PAID: 'Pagado', PARTIAL: 'Parcial', CANCELLED: 'Cancelado' };
  const methodLabels: Record<string, string> = { CASH: 'Efectivo', TRANSFER: 'Transferencia', CARD: 'Tarjeta', CHECK: 'Cheque', OTHER: 'Otro' };

  const chargeColumns = [
    { key: 'unit', header: 'Unidad', render: (row: any) => row.unit?.identifier || '-' },
    { key: 'description', header: 'Concepto' },
    { key: 'type', header: 'Tipo', render: (row: any) => typeLabels[row.type] || row.type },
    { key: 'amount', header: 'Monto', render: (row: any) => `$${parseFloat(row.amount).toLocaleString()}` },
    {
      key: 'status',
      header: 'Estado',
      render: (row: any) => (
        <span className={row.status === 'PAID' ? 'badge-success' : row.status === 'PENDING' ? 'badge-danger' : 'badge-warning'}>
          {statusLabels[row.status] || row.status}
        </span>
      ),
    },
    { key: 'dueDate', header: 'Vencimiento', render: (row: any) => new Date(row.dueDate).toLocaleDateString('es-MX') },
  ];

  const paymentColumns = [
    { key: 'createdAt', header: 'Fecha', render: (row: any) => new Date(row.createdAt).toLocaleDateString('es-MX') },
    { key: 'unit', header: 'Unidad', render: (row: any) => row.unit?.identifier || '-' },
    { key: 'amount', header: 'Monto', render: (row: any) => `$${parseFloat(row.amount).toLocaleString()}` },
    { key: 'method', header: 'Método', render: (row: any) => methodLabels[row.method] || row.method },
    { key: 'charge', header: 'Cargo', render: (row: any) => row.charge?.description || 'Sin cargo asociado' },
    { key: 'reference', header: 'Referencia', render: (row: any) => row.reference || '-' },
    {
      key: 'reconciled',
      header: 'Conciliado',
      render: (row: any) => (
        <span className={row.reconciled ? 'badge-success' : 'badge-warning'}>
          {row.reconciled ? 'Sí' : 'No'}
        </span>
      ),
    },
  ];

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
      <div className="flex gap-1 mb-6 bg-white/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('charges')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'charges' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Cargos
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'payments' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Pagos
        </button>
      </div>

      <DataTable
        columns={tab === 'charges' ? chargeColumns : paymentColumns}
        data={data}
        loading={loading}
        emptyMessage={tab === 'charges' ? 'No hay cargos registrados' : 'No hay pagos registrados'}
      />

      {/* Modal Nuevo Cargo */}
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

      {/* Modal Registrar Pago */}
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
            <input className="input-field" value={paymentForm.chargeId} onChange={(e) => setPaymentForm({ ...paymentForm, chargeId: e.target.value })} />
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
