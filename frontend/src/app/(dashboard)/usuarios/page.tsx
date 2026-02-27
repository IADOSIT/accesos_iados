'use client';

import { useEffect, useState } from 'react';
import { usersApi, tenantsApi } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';

export default function UsuariosPage() {
  const { user, tenantId } = useAuthStore();
  const isSuperAdmin = user?.isSuperAdmin ?? false;

  const [users, setUsers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'RESIDENT', tenantId: tenantId || '' });

  const load = () => {
    setLoading(true);
    usersApi.list()
      .then((res: any) => setUsers(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (isSuperAdmin) {
      tenantsApi.list().then((res: any) => setTenants(res.data || [])).catch(console.error);
    }
  }, [isSuperAdmin]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetTenantId = isSuperAdmin ? form.tenantId : tenantId;
      if (!targetTenantId) { alert('Selecciona un fraccionamiento'); return; }
      await api('/users', { method: 'POST', body: form, headers: { 'x-tenant-id': targetTenantId } });
      setShowModal(false);
      setForm({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'RESIDENT', tenantId: tenantId || '' });
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const handleToggle = async (row: any) => {
    try {
      if (row.isActive) await usersApi.deactivate(row.userId || row.user?.id);
      else await usersApi.activate(row.userId || row.user?.id);
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const handleDelete = async (row: any) => {
    if (!confirm(`¿Eliminar permanentemente a ${row.user?.firstName} ${row.user?.lastName}? Esta acción no se puede deshacer.`)) return;
    try {
      await usersApi.remove(row.userId || row.user?.id);
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const roleLabels: Record<string, string> = { ADMIN: 'Administrador', GUARD: 'Guardia', RESIDENT: 'Residente' };

  const columns = [
    { key: 'user', header: 'Nombre', render: (row: any) => `${row.user?.firstName || ''} ${row.user?.lastName || ''}`.trim() },
    { key: 'email', header: 'Email', render: (row: any) => row.user?.email },
    { key: 'phone', header: 'Teléfono', render: (row: any) => row.user?.phone || '-' },
    { key: 'role', header: 'Rol', render: (row: any) => (
      <span className={row.role === 'ADMIN' ? 'badge-info' : row.role === 'GUARD' ? 'badge-warning' : 'badge-success'}>
        {roleLabels[row.role] || row.role}
      </span>
    )},
    { key: 'unit', header: 'Unidad', render: (row: any) => row.unit?.identifier || '-' },
    { key: 'tenant', header: 'Fraccionamiento', render: (row: any) => row.tenant?.name || '-' },
    { key: 'status', header: 'Estado', render: (row: any) => (
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
      <PageHeader title="Usuarios" subtitle="Administradores, guardias y residentes"
        action={<button onClick={() => setShowModal(true)} className="btn-primary">+ Nuevo usuario</button>}
      />
      <DataTable columns={columns} data={users} loading={loading} emptyMessage="No hay usuarios registrados" />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Usuario">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Apellido *</label>
              <input className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña *</label>
            <input className="input-field" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol *</label>
              <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="RESIDENT">Residente</option>
                <option value="GUARD">Guardia</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
          </div>
          {isSuperAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fraccionamiento *</label>
              <select className="input-field" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} required>
                <option value="">— Selecciona fraccionamiento —</option>
                {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Crear usuario</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
