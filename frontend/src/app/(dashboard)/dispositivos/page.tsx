'use client';

import { useEffect, useState } from 'react';
import { devicesApi } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';

const emptyForm = { name: '', type: 'GATE', accessType: 'GENERAL', mqttTopic: '', location: '' };

function DeviceForm({ values, onChange, onSubmit, onClose, submitLabel }: any) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
        <input className="input-field" value={values.name} onChange={(e) => onChange({ ...values, name: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
          <select className="input-field" value={values.type} onChange={(e) => onChange({ ...values, type: e.target.value })}>
            <option value="GATE">Portón</option>
            <option value="DOOR">Puerta</option>
            <option value="BARRIER">Pluma</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Acceso para</label>
          <select className="input-field" value={values.accessType} onChange={(e) => onChange({ ...values, accessType: e.target.value })}>
            <option value="GENERAL">General</option>
            <option value="RESIDENT">Residentes</option>
            <option value="VISITOR">Visitas</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación</label>
        <input className="input-field" value={values.location} onChange={(e) => onChange({ ...values, location: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">MQTT Topic</label>
        <input className="input-field" value={values.mqttTopic} onChange={(e) => onChange({ ...values, mqttTopic: e.target.value })} placeholder="devices/porton-principal/cmd" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}

export default function DispositivosPage() {
  const { tenantId } = useAuthStore();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });

  const load = () => {
    setLoading(true);
    devicesApi.list()
      .then((res: any) => setDevices(Array.isArray(res.data) ? res.data : (res.data || [])))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling de estado cada 10s (ONLINE/OFFLINE en tiempo real)
  useEffect(() => {
    const id = setInterval(() => {
      devicesApi.list()
        .then((res: any) => setDevices(Array.isArray(res.data) ? res.data : (res.data || [])))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await devicesApi.create(form);
      setShowModal(false);
      setForm({ ...emptyForm });
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const handleEditOpen = (row: any) => {
    setEditRow(row);
    setEditForm({
      name: row.name || '',
      type: row.type || 'GATE',
      accessType: row.accessType || 'GENERAL',
      mqttTopic: row.mqttTopic || '',
      location: row.location || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await devicesApi.update(editRow.id, editForm);
      setShowEditModal(false);
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
  const accessTypeLabels: Record<string, string> = { RESIDENT: 'Residentes', VISITOR: 'Visitas', GENERAL: 'General' };

  const columns = [
    { key: 'name', header: 'Nombre' },
    { key: 'type', header: 'Tipo', render: (row: any) => typeLabels[row.type] || row.type },
    { key: 'accessType', header: 'Uso', render: (row: any) => accessTypeLabels[row.accessType] || row.accessType || 'General' },
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
        <button onClick={() => handleEditOpen(row)} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">
          Editar
        </button>
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
        <DeviceForm values={form} onChange={setForm} onSubmit={handleCreate} onClose={() => setShowModal(false)} submitLabel="Crear dispositivo" />
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Dispositivo">
        <DeviceForm values={editForm} onChange={setEditForm} onSubmit={handleEditSubmit} onClose={() => setShowEditModal(false)} submitLabel="Guardar cambios" />
      </Modal>
    </div>
  );
}
