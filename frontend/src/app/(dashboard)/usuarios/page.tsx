'use client';

import { useEffect, useRef, useState } from 'react';
import { usersApi, tenantsApi, unitsApi } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

const VALID_ROLES = ['ADMIN', 'GUARD', 'RESIDENT'];

export default function UsuariosPage() {
  const { user, tenantId, role } = useAuthStore();
  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const canImport = role === 'ADMIN' || isSuperAdmin;

  const [users, setUsers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'RESIDENT', tenantId: tenantId || '' });
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', role: 'RESIDENT', unitId: '' });

  // CSV import
  const fileRef = useRef<HTMLInputElement>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvResult, setCsvResult] = useState<any>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [didImport, setDidImport] = useState(false);
  const [csvTenantId, setCsvTenantId] = useState(tenantId || '');

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
    unitsApi.list('').then((res: any) => setUnits(res.data || [])).catch(console.error);
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

  const handleEditOpen = (row: any) => {
    setEditRow(row);
    setEditForm({
      firstName: row.user?.firstName || '',
      lastName: row.user?.lastName || '',
      phone: row.user?.phone || '',
      role: row.role || 'RESIDENT',
      unitId: row.unit?.id || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...editForm };
      if (!payload.unitId) payload.unitId = null;
      await usersApi.update(editRow.userId || editRow.user?.id, payload);
      setShowEditModal(false);
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

  // ── CSV ──────────────────────────────────────────────────────────────────

  const downloadTemplate = () => {
    const csv = [
      'email,password,firstName,lastName,phone,role,unit',
      'juan@ejemplo.com,MiClave123,Juan,Pérez,5551234567,RESIDENT,101',
      'guardia@ejemplo.com,Guard456,Pedro,López,5552222222,GUARD,',
      'admin@ejemplo.com,Admin789,Ana,Torres,5553333333,ADMIN,',
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'plantilla_usuarios.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string).replace(/^\ufeff/, '');
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
      const idx = (kws: string[]) => headers.findIndex(h => kws.some(k => h.includes(k)));
      const iEmail  = idx(['email', 'correo']);
      const iPass   = idx(['password', 'contrase', 'clave']);
      const iFirst  = idx(['first', 'nombre']);
      const iLast   = idx(['last', 'apellido']);
      const iPhone  = idx(['phone', 'telefono', 'tel']);
      const iRole   = idx(['role', 'rol']);
      const iUnit   = idx(['unit', 'unidad']);
      const parsed = lines.slice(1).map(line => {
        const c = parseCSVLine(line);
        const rawRole = iRole >= 0 ? c[iRole].toUpperCase() : 'RESIDENT';
        return {
          email:     iEmail >= 0 ? c[iEmail] : '',
          password:  iPass  >= 0 ? c[iPass]  : '',
          firstName: iFirst >= 0 ? c[iFirst] : '',
          lastName:  iLast  >= 0 ? c[iLast]  : '',
          phone:     iPhone >= 0 ? c[iPhone] : '',
          role:      VALID_ROLES.includes(rawRole) ? rawRole : 'RESIDENT',
          unit:      iUnit  >= 0 ? c[iUnit]  : '',
        };
      }).filter(r => r.email && r.firstName);
      setCsvRows(parsed);
      setCsvResult(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    const targetTenantId = isSuperAdmin ? csvTenantId : tenantId;
    if (!targetTenantId) { alert('Selecciona un fraccionamiento'); return; }
    setCsvLoading(true);
    try {
      const res: any = await api('/users/bulk', {
        method: 'POST',
        body: { rows: csvRows },
        headers: { 'x-tenant-id': targetTenantId },
      });
      setCsvResult((res as any).data);
      setDidImport(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setCsvLoading(false);
    }
  };

  const closeCsvModal = () => {
    setShowCsvModal(false);
    setCsvRows([]);
    setCsvResult(null);
    if (fileRef.current) fileRef.current.value = '';
    if (didImport) { load(); setDidImport(false); }
  };

  // ── Columns ──────────────────────────────────────────────────────────────

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
        <button onClick={() => handleEditOpen(row)} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Editar</button>
        <button onClick={() => handleToggle(row)}
          className={`text-xs px-2 py-1 rounded ${row.isActive !== false ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
          {row.isActive !== false ? 'Desactivar' : 'Activar'}
        </button>
        <button onClick={() => handleDelete(row)} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Eliminar</button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Usuarios" subtitle="Administradores, guardias y residentes"
        action={
          <div className="flex gap-2">
            {canImport && (
              <button onClick={() => setShowCsvModal(true)} className="btn-secondary">
                ↑ Importar CSV
              </button>
            )}
            <button onClick={() => setShowModal(true)} className="btn-primary">+ Nuevo usuario</button>
          </div>
        }
      />

      <DataTable columns={columns} data={users} loading={loading} emptyMessage="No hay usuarios registrados" />

      {/* Modal Crear */}
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

      {/* Modal Editar */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Usuario">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input className="input-field" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Apellido *</label>
              <input className="input-field" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input className="input-field" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol *</label>
              <select className="input-field" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="RESIDENT">Residente</option>
                <option value="GUARD">Guardia</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unidad asignada</label>
            <select className="input-field" value={editForm.unitId} onChange={(e) => setEditForm({ ...editForm, unitId: e.target.value })}>
              <option value="">— Sin unidad —</option>
              {units.map((u: any) => <option key={u.id} value={u.id}>{u.identifier}{u.block ? ` — ${u.block}` : ''}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Guardar cambios</button>
          </div>
        </form>
      </Modal>

      {/* Modal Importar CSV */}
      <Modal isOpen={showCsvModal} onClose={closeCsvModal} title="Importar usuarios desde CSV" size="lg">
        <div className="space-y-4">

          {/* Instrucciones + plantilla */}
          {!csvResult && (
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-1">
              <p className="font-medium text-slate-700">Instrucciones</p>
              <p>• Campos obligatorios: <code className="bg-slate-200 px-1 rounded">email</code>, <code className="bg-slate-200 px-1 rounded">password</code> (mín. 6 caracteres), <code className="bg-slate-200 px-1 rounded">firstName</code>, <code className="bg-slate-200 px-1 rounded">lastName</code>, <code className="bg-slate-200 px-1 rounded">role</code>.</p>
              <p>• Roles válidos: <code className="bg-slate-200 px-1 rounded">ADMIN</code>, <code className="bg-slate-200 px-1 rounded">GUARD</code>, <code className="bg-slate-200 px-1 rounded">RESIDENT</code>.</p>
              <p>• El campo <code className="bg-slate-200 px-1 rounded">unit</code> es el identificador de la unidad (ej: "101"), solo para residentes.</p>
              <p>• Si un usuario ya pertenece a este fraccionamiento, se omite sin error.</p>
              <button onClick={downloadTemplate}
                className="mt-2 inline-flex items-center gap-1.5 text-emerald-700 font-medium hover:text-emerald-900">
                ↓ Descargar plantilla .csv
              </button>
            </div>
          )}

          {/* Selector de tenant para SuperAdmin */}
          {isSuperAdmin && !csvResult && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fraccionamiento destino *</label>
              <select className="input-field" value={csvTenantId} onChange={(e) => setCsvTenantId(e.target.value)}>
                <option value="">— Selecciona fraccionamiento —</option>
                {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Upload zone */}
          {!csvRows.length && !csvResult && (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
              <p className="text-3xl mb-2">📂</p>
              <p className="text-slate-600 font-medium">Haz clic para seleccionar el archivo</p>
              <p className="text-slate-400 text-xs mt-1">o arrastra y suelta aquí</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {/* Preview */}
          {csvRows.length > 0 && !csvResult && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Vista previa — <span className="text-emerald-600">{csvRows.length} usuarios encontrados</span>
              </p>
              <div className="overflow-auto max-h-52 rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {['Email', 'Nombre', 'Apellido', 'Rol', 'Unidad', 'Teléfono'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-600">{row.email}</td>
                        <td className="px-3 py-1.5 font-medium text-slate-700">{row.firstName}</td>
                        <td className="px-3 py-1.5 text-slate-600">{row.lastName}</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            row.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' :
                            row.role === 'GUARD' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'}`}>
                            {row.role}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-500">{row.unit || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.phone || '-'}</td>
                      </tr>
                    ))}
                    {csvRows.length > 10 && (
                      <tr><td colSpan={6} className="px-3 py-2 text-center text-slate-400 text-xs">... y {csvRows.length - 10} más</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4">
                <button onClick={() => { setCsvRows([]); if (fileRef.current) fileRef.current.value = ''; }}
                  className="btn-secondary text-sm">Cambiar archivo</button>
                <button onClick={handleImport} disabled={csvLoading} className="btn-primary text-sm">
                  {csvLoading ? 'Importando...' : `Importar ${csvRows.length} usuarios`}
                </button>
              </div>
            </div>
          )}

          {/* Resultado */}
          {csvResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{csvResult.created}</p>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">Creados</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-slate-500">{csvResult.skipped}</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Omitidos</p>
                  <p className="text-xs text-slate-400">(ya existían)</p>
                </div>
                <div className={`rounded-xl p-4 text-center ${csvResult.errors?.length ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <p className={`text-2xl font-bold ${csvResult.errors?.length ? 'text-red-600' : 'text-slate-400'}`}>
                    {csvResult.errors?.length || 0}
                  </p>
                  <p className={`text-xs mt-1 font-medium ${csvResult.errors?.length ? 'text-red-700' : 'text-slate-400'}`}>Errores</p>
                </div>
              </div>

              {csvResult.errors?.length > 0 && (
                <div className="rounded-lg border border-red-200 overflow-hidden">
                  <div className="bg-red-50 px-3 py-2 text-xs font-medium text-red-700">Detalle de errores</div>
                  <div className="max-h-36 overflow-auto">
                    {csvResult.errors.map((e: any, i: number) => (
                      <div key={i} className="px-3 py-2 border-t border-red-100 text-xs flex justify-between">
                        <span className="text-slate-500">Fila {e.row} — <strong>{e.email}</strong></span>
                        <span className="text-red-600">{e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={closeCsvModal} className="btn-primary w-full">Cerrar</button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
