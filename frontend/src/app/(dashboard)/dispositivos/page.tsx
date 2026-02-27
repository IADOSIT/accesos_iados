'use client';

import { useEffect, useState } from 'react';
import { devicesApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';

export default function DispositivosPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'GATE', mqttTopic: '', location: '' });

  const load = () => {
    setLoading(true);
    devicesApi.list()
      .then((res: any) => setDevices(Array.isArray(res.data) ? res.data : (res.data || [])))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await devicesApi.create(form);
      setShowModal(false);
      setForm({ name: '', type: 'GATE', mqttTopic: '', location: '' });
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const handleToggle = async (row: any) => {
    try {
      if (row.isActive !== false) await devicesApi.deactivate(row.id);
      else await devicesApi.activate(row.id);
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const handleDelete = async (row: any) => {
    if (!confirm(`¿Eliminar permanentemente el dispositivo "${row.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await devicesApi.remove(row.id);
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const typeLabels: Record<string, string> = { GATE: 'Portón', DOOR: 'Puerta', BARRIER: 'Pluma' };
  const statusLabels: Record<string, string> = { ONLINE: 'En línea', OFFLINE: 'Desconectado', ERROR: 'Error' };

  const columns = [
    { key: 'name', header: 'Nombre' },
    { key: 'type', header: 'Tipo', render: (row: any) => typeLabels[row.type] || row.type },
    { key: 'status', header: 'Conexión', render: (row: any) => (
      <span className={row.status === 'ONLINE' ? 'badge-success' : row.status === 'ERROR' ? 'badge-danger' : 'badge-warning'}>
        {statusLabels[row.status] || row.status}
      </span>
    )},
    { key: 'location', header: 'Ubicación', render: (row: any) => row.location || '-' },
    { key: 'mqttTopic', header: 'MQTT Topic', render: (row: any) => row.mqttTopic || '-' },
    { key: 'active', header: 'Estado', render: (row: any) => (
      <span className={row.isActive !== false ? 'badge-success' : 'badge-danger'}>
        {row.isActive !== false ? 'Activo' : 'Inactivo'}
      </span>
    )},
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
      <PageHeader title="Dispositivos" subtitle="Portones, puertas y plumas conectadas"
        action={<button onClick={() => setShowModal(true)} className="btn-primary">+ Nuevo dispositivo</button>}
      />
      <DataTable columns={columns} data={devices} loading={loading} emptyMessage="No hay dispositivos registrados" />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Dispositivo">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="GATE">Portón</option>
                <option value="DOOR">Puerta</option>
                <option value="BARRIER">Pluma</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación</label>
              <input className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">MQTT Topic</label>
            <input className="input-field" value={form.mqttTopic} onChange={(e) => setForm({ ...form, mqttTopic: e.target.value })} placeholder="devices/porton-principal/cmd" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Crear dispositivo</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
