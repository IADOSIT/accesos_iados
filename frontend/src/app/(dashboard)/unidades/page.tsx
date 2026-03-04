'use client';

import { useEffect, useRef, useState } from 'react';
import { unitsApi } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';

const emptyForm = { identifier: '', block: '', ownerName: '', ownerPhone: '', ownerEmail: '' };

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

const LIMIT = 20;

export default function UnidadesPage() {
  const { user, role, tenantId } = useAuthStore();
  const tenantName = user?.tenants?.find((t: any) => t.tenantId === tenantId)?.tenantName || '-';
  const canImport = role === 'ADMIN' || user?.isSuperAdmin === true;

  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // CSV import
  const fileRef = useRef<HTMLInputElement>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvResult, setCsvResult] = useState<any>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [didImport, setDidImport] = useState(false);

  const load = (p = page, q = search) => {
    setLoading(true);
    const params = [`page=${p}`, `limit=${LIMIT}`, ...(q ? [`search=${encodeURIComponent(q)}`] : [])].join('&');
    unitsApi.list(params)
      .then((res: any) => { setUnits(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const goToPage = (p: number) => { setPage(p); load(p); };

  // Resetear paginación al cambiar búsqueda o tenant
  useEffect(() => { setPage(1); load(1, search); }, [search]);       // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSearch(''); setPage(1); load(1, ''); }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await unitsApi.create(form);
      setShowModal(false);
      setForm({ ...emptyForm });
      load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
  };

  const handleEditOpen = (row: any) => {
    setEditRow(row);
    setEditForm({
      identifier: row.identifier || '',
      block: row.block || '',
      ownerName: row.ownerName || '',
      ownerPhone: row.ownerPhone || '',
      ownerEmail: row.ownerEmail || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await unitsApi.update(editRow.id, editForm);
      setShowEditModal(false);
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

  // ── CSV ──────────────────────────────────────────────────────────────────

  const downloadTemplate = () => {
    const csv = [
      'identifier,block,floor,ownerName,ownerPhone,ownerEmail',
      '101,A,1,Juan Pérez,5551234567,juan@ejemplo.com',
      '102,A,2,María García,5559876543,maria@ejemplo.com',
      '201,B,1,Carlos Ruiz,,',
      '202,B,2,Ana Torres,,ana@ejemplo.com',
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'plantilla_unidades.csv'; a.click();
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
      const iId    = idx(['identifier', 'unidad']);
      const iBlock = idx(['block', 'manzana', 'bloque']);
      const iFloor = idx(['floor', 'piso']);
      const iOwner = idx(['owner', 'propietario', 'nombre']);
      const iPhone = idx(['phone', 'telefono', 'tel']);
      const iEmail = idx(['email', 'correo']);
      const parsed = lines.slice(1).map(line => {
        const c = parseCSVLine(line);
        return {
          identifier: iId    >= 0 ? c[iId]    : '',
          block:      iBlock >= 0 ? c[iBlock]  : '',
          floor:      iFloor >= 0 ? c[iFloor]  : '',
          ownerName:  iOwner >= 0 ? c[iOwner]  : '',
          ownerPhone: iPhone >= 0 ? c[iPhone]  : '',
          ownerEmail: iEmail >= 0 ? c[iEmail]  : '',
        };
      }).filter(r => r.identifier);
      setCsvRows(parsed);
      setCsvResult(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    setCsvLoading(true);
    try {
      const res: any = await unitsApi.bulk({ rows: csvRows });
      setCsvResult(res.data);
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
        <button onClick={() => handleEditOpen(row)} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Editar</button>
        <button onClick={() => handleToggle(row)}
          className={`text-xs px-2 py-1 rounded ${row.isActive !== false ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
          {row.isActive !== false ? 'Desactivar' : 'Activar'}
        </button>
        <button onClick={() => handleDelete(row)} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Eliminar</button>
      </div>
    )},
  ];

  const UnitForm = ({ values, onChange, onSubmit, onClose, submitLabel }: any) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Identificador *</label>
        <input className="input-field" value={values.identifier} onChange={(e) => onChange({ ...values, identifier: e.target.value })} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Bloque / Sección</label>
        <input className="input-field" value={values.block} onChange={(e) => onChange({ ...values, block: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Propietario</label>
        <input className="input-field" value={values.ownerName} onChange={(e) => onChange({ ...values, ownerName: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
          <input className="input-field" value={values.ownerPhone} onChange={(e) => onChange({ ...values, ownerPhone: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input className="input-field" type="email" value={values.ownerEmail} onChange={(e) => onChange({ ...values, ownerEmail: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary">{submitLabel}</button>
      </div>
    </form>
  );

  return (
    <div>
      <PageHeader title="Unidades" subtitle="Gestión de casas y departamentos"
        action={
          <div className="flex gap-2">
            {canImport && (
              <button onClick={() => setShowCsvModal(true)} className="btn-secondary">
                ↑ Importar CSV
              </button>
            )}
            <button onClick={() => setShowModal(true)} className="btn-primary">+ Nueva unidad</button>
          </div>
        }
      />

      <div className="mb-6">
        <input type="text" placeholder="Buscar por identificador o propietario..."
          value={search} onChange={(e) => setSearch(e.target.value)} className="input-field max-w-md" />
      </div>

      <DataTable
        columns={columns}
        data={units}
        loading={loading}
        emptyMessage="No hay unidades registradas"
        pagination={{ total, page, limit: LIMIT, onPage: goToPage }}
      />

      {/* Modal Crear */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Unidad">
        <UnitForm values={form} onChange={setForm} onSubmit={handleCreate} onClose={() => setShowModal(false)} submitLabel="Crear unidad" />
      </Modal>

      {/* Modal Editar */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Unidad">
        <UnitForm values={editForm} onChange={setEditForm} onSubmit={handleEditSubmit} onClose={() => setShowEditModal(false)} submitLabel="Guardar cambios" />
      </Modal>

      {/* Modal Importar CSV */}
      <Modal isOpen={showCsvModal} onClose={closeCsvModal} title="Importar unidades desde CSV" size="lg">
        <div className="space-y-4">

          {/* Instrucciones + plantilla */}
          {!csvResult && (
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-1">
              <p className="font-medium text-slate-700">Instrucciones</p>
              <p>• El campo <code className="bg-slate-200 px-1 rounded">identifier</code> es obligatorio y debe ser único.</p>
              <p>• Si una unidad ya existe (mismo identificador), se omite sin error.</p>
              <p>• Descarga la plantilla para ver el formato correcto.</p>
              <button onClick={downloadTemplate}
                className="mt-2 inline-flex items-center gap-1.5 text-emerald-700 font-medium hover:text-emerald-900">
                ↓ Descargar plantilla .csv
              </button>
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
                Vista previa — <span className="text-emerald-600">{csvRows.length} unidades encontradas</span>
              </p>
              <div className="overflow-auto max-h-52 rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {['Identificador', 'Bloque', 'Piso', 'Propietario', 'Teléfono', 'Email'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-medium text-slate-700">{row.identifier}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.block || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.floor || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.ownerName || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.ownerPhone || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.ownerEmail || '-'}</td>
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
                  {csvLoading ? 'Importando...' : `Importar ${csvRows.length} unidades`}
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
                  <p className="text-xs text-emerald-700 mt-1 font-medium">Creadas</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-slate-500">{csvResult.skipped}</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Omitidas</p>
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
                        <span className="text-slate-500">Fila {e.row} — <strong>{e.identifier}</strong></span>
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
