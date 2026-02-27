'use client';

import { useEffect, useState } from 'react';
import { unitsApi } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';

export default function UnidadesPage() {
  const { user } = useAuthStore();
  const tenantName = user?.tenants?.[0]?.tenantName || '-';

  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ identifier: '', block: '', ownerName: '', ownerPhone: '', ownerEmail: '' });
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    unitsApi.list(search ? `search=${search}` : '')
      .then((res: any) => setUnits(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await unitsApi.create(form);
      setShowModal(false);
      setForm({ identifier: '', block: '', ownerName: '', ownerPhone: '', ownerEmail: '' });
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const handleToggle = async (row: any) => {
    try {
      if (row.isActive !== false) await unitsApi.deactivate(row.id);
      else await unitsApi.activate(row.id);
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const handleDelete = async (row: any) => {
    if (!confirm(`¿Eliminar permanentemente la unidad ${row.identifier}? Esta acción no se puede deshacer.`)) return;
    try {
      await unitsApi.remove(row.id);
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const columns = [
    { key: 'identifier', header: 'Unidad' },
    { key: 'block', header: 'Bloque', render: (row: any) => row.block || '-' },
    { key: 'ownerName', header: 'Propietario', render: (row: any) => row.ownerName || '-' },
    { key: 'ownerPhone', header: 'Teléfono', render: (row: any) => row.ownerPhone || '-' },
    { key: 'fraccionamiento', header: 'Fraccionamiento', render: () => tenantName },
    { key: 'isDelinquent', header: 'Pago', render: (row: any) => (
      <span className={row.isDelinquent ? 'badge-danger' : 'badge-success'}>
        {row.isDelinquent ? 'Moroso' : 'Al corriente'}
      </span>
    )},
    { key: 'status', header: 'Estado', render: (row: any) => (
      <span className={row.isActive !== false ? 'badge-success' : 'badge-danger'}>
        {row.isActive !== false ? 'Activo' : 'Inactivo'}
      </span>
    )},
    { key: 'residents', header: 'Residentes', render: (row: any) => <span className="badge-info">{row.residents?.length || 0}</span> },
    { key: 'actions', header: 'Acciones', render: (row: any) => (
      <div className="flex gap-2">
        <button onClick={() => handleToggle(row)}
          className={`text-xs px-2 py-1 rounded ${row.isActive !== false ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
          {row.isActive !== false ? 'Desactivar' : 'Activar'}
        </button>
        <button onClick={() => handleDelete(row)} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">
          Eliminar
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Unidades" subtitle="Gestión de casas y departamentos"
        action={<button onClick={() => setShowModal(true)} className="btn-primary">+ Nueva unidad</button>}
      />
      <div className="mb-6">
        <input type="text" placeholder="Buscar por identificador o propietario..."
          value={search} onChange={(e) => setSearch(e.target.value)} className="input-field max-w-md" />
      </div>
      <DataTable columns={columns} data={units} loading={loading} emptyMessage="No hay unidades registradas" />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Unidad">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Identificador *</label>
            <input className="input-field" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bloque / Sección</label>
            <input className="input-field" value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Propietario</label>
            <input className="input-field" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input className="input-field" value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input className="input-field" type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Crear unidad</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
