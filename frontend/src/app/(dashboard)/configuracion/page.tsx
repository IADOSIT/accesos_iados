'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { authApi, configApi, tenantsApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';

// ── Tipos feature flags ────────────────────────────────────────
interface FeatureFlags {
  showResidentAccessButton: boolean;
  showVisitorAccessButton: boolean;
  showExitButton: boolean;
  quickQrEnabled: boolean;
  quickQrDurationHours: number;
  quickQrMaxUses: number;
}

const DEFAULT_FLAGS: FeatureFlags = {
  showResidentAccessButton: false,
  showVisitorAccessButton: false,
  showExitButton: false,
  quickQrEnabled: false,
  quickQrDurationHours: 2,
  quickQrMaxUses: 3,
};

// ── Tipos ──────────────────────────────────────────────────────
type IntegrationType =
  | 'ERREKA_MQTT' | 'ERREKA_IP'
  | 'HIKVISION_ISAPI' | 'AXIS_VAPIX'
  | 'ONVIF' | 'GENERIC_MQTT';

type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'CONNECTING';

interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  brand?: string;
  model?: string;
  host?: string;
  port?: number;
  username?: string;
  mqttTopic?: string;
  isActive: boolean;
  status: IntegrationStatus;
  lastCheck?: string;
  errorMessage?: string;
}

const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  ERREKA_MQTT: 'ERREKA VIVO (MQTT/Relé)',
  ERREKA_IP: 'ERREKA VIVO (Módulo IP)',
  HIKVISION_ISAPI: 'Hikvision (ISAPI)',
  AXIS_VAPIX: 'Axis (VAPIX)',
  ONVIF: 'Cámara ONVIF Genérica',
  GENERIC_MQTT: 'Dispositivo MQTT Genérico',
};

const STATUS_BADGE: Record<IntegrationStatus, { label: string; cls: string }> = {
  ACTIVE:     { label: 'Activo',      cls: 'bg-green-100 text-green-700' },
  INACTIVE:   { label: 'Inactivo',    cls: 'bg-slate-100 text-slate-600' },
  ERROR:      { label: 'Error',       cls: 'bg-red-100 text-red-700' },
  CONNECTING: { label: 'Conectando',  cls: 'bg-yellow-100 text-yellow-700' },
};

// ── IntegrationModal — componente separado para evitar pérdida de foco ─────
// Al estar fuera de ConfiguracionPage, los re-renders del padre no
// desmontan ni vuelven a montar este componente, preservando el foco.
interface IntegrationModalProps {
  isOpen: boolean;
  editingInt: Integration | null;
  onClose: () => void;
  onSaved: () => void;
}

function IntegrationModal({ isOpen, editingInt, onClose, onSaved }: IntegrationModalProps) {
  const [form, setForm] = useState({
    name: '', type: 'ERREKA_MQTT' as IntegrationType,
    brand: '', model: '', host: '', port: '', username: '', password: '', mqttTopic: '',
  });
  const [msg,  setMsg]  = useState('');
  const [warn, setWarn] = useState('');
  const [err,  setErr]  = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setMsg(''); setWarn(''); setErr('');
    if (editingInt) {
      setForm({
        name: editingInt.name, type: editingInt.type,
        brand: editingInt.brand || '', model: editingInt.model || '',
        host: editingInt.host || '', port: editingInt.port?.toString() || '',
        username: editingInt.username || '', password: '',
        mqttTopic: editingInt.mqttTopic || '',
      });
    } else {
      setForm({ name: '', type: 'ERREKA_MQTT', brand: '', model: '', host: '', port: '', username: '', password: '', mqttTopic: '' });
    }
  }, [isOpen, editingInt]);

  const isMqttType = (t: IntegrationType) => t === 'ERREKA_MQTT' || t === 'GENERIC_MQTT';
  const isIpType   = (t: IntegrationType) => !isMqttType(t);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(''); setWarn(''); setErr('');
    const payload: Record<string, unknown> = {
      name: form.name, type: form.type,
      ...(form.brand    && { brand: form.brand }),
      ...(form.model    && { model: form.model }),
      ...(form.host     && { host: form.host }),
      ...(form.port     && { port: parseInt(form.port) }),
      ...(form.username && { username: form.username }),
      ...(form.password && { password: form.password }),
      ...(form.mqttTopic && { mqttTopic: form.mqttTopic }),
    };
    try {
      let res: any;
      if (editingInt) {
        res = await configApi.updateIntegration(editingInt.id, payload);
        setMsg('Integración actualizada');
      } else {
        res = await configApi.createIntegration(payload);
        setMsg('Integración creada');
      }
      onSaved();
      const warning = res?.data?.warning;
      if (warning) {
        setWarn(warning);
      } else {
        setTimeout(onClose, 1200);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">
            {editingInt ? 'Editar integración' : 'Nueva integración'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {msg  && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl">{msg}</div>}
          {warn && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl space-y-2">
              <p>⚠ {warn}</p>
              <button type="button" onClick={onClose} className="text-xs underline text-amber-700">
                Entendido, cerrar
              </button>
            </div>
          )}
          {err  && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl">{err}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input type="text" className="input-field" placeholder="ej. Portón principal"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de integración *</label>
            <select className="input-field" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as IntegrationType })}>
              {(Object.entries(INTEGRATION_LABELS) as [IntegrationType, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
              <input type="text" className="input-field" placeholder="ej. ERREKA"
                value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
              <input type="text" className="input-field" placeholder="ej. VIVO-M203M"
                value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
          </div>

          {isMqttType(form.type) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MQTT Topic</label>
              <input type="text" className="input-field" placeholder="ej. fraccionamiento/porton/1"
                value={form.mqttTopic} onChange={(e) => setForm({ ...form, mqttTopic: e.target.value })} />
              <p className="text-xs text-slate-400 mt-1">Topic al que se publicarán los comandos de apertura</p>
            </div>
          )}

          {isIpType(form.type) && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Host / IP</label>
                  <input type="text" className="input-field" placeholder="192.168.1.100"
                    value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Puerto</label>
                  <input type="number" className="input-field" placeholder="80"
                    value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
                  <input type="text" className="input-field" placeholder="admin"
                    value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {editingInt ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                  </label>
                  <input type="password" className="input-field"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm">
              Cancelar
            </button>
            <button type="submit" className="flex-1 btn-primary text-sm">
              {editingInt ? 'Guardar cambios' : 'Crear integración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────
export default function ConfiguracionPage() {
  const { user, tenantId, setTenant } = useAuthStore();
  const isAdmin    = user?.tenants?.find((t) => t.tenantId === tenantId)?.role === 'ADMIN';
  const isSuperAdmin = user?.isSuperAdmin === true;

  // Lista de todos los tenants (solo SuperAdmin)
  const [allTenants, setAllTenants] = useState<{ id: string; name: string }[]>([]);

  // Cambiar contraseña
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  // Datos del fraccionamiento
  const [tenantForm, setTenantForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [tenantMsg, setTenantMsg] = useState('');
  const [tenantErr, setTenantErr] = useState('');

  // Feature flags
  const [flags, setFlags] = useState<FeatureFlags>({ ...DEFAULT_FLAGS });
  const [uiTheme, setUiTheme] = useState<'DARK' | 'LIGHT'>('DARK');
  const [flagsMsg, setFlagsMsg] = useState('');
  const [flagsErr, setFlagsErr] = useState('');
  const [savingFlags, setSavingFlags] = useState(false);

  // Integraciones
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showIntModal, setShowIntModal] = useState(false);
  const [editingInt, setEditingInt] = useState<Integration | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // ── Cargar lista de tenants para SuperAdmin — UNA SOLA VEZ al montar ──
  // Dependencia vacía [] es intencional: isSuperAdmin no cambia en la sesión
  useEffect(() => {
    if (!isSuperAdmin) return;
    tenantsApi.list().then((res: any) => {
      setAllTenants((res.data || []).map((t: any) => ({ id: t.id, name: t.name })));
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cargar datos del tenant cuando cambia tenantId ──
  // SOLO [tenantId] como dep — canManage NO va en deps para evitar cascades
  // cuando Zustand hidrata user y tenantId al mismo tiempo.
  useEffect(() => {
    if (!tenantId || (!isAdmin && !isSuperAdmin)) return;
    configApi.getTenant().then((res: any) => {
      const t = res.data;
      setTenantForm({ name: t.name || '', address: t.address || '', phone: t.phone || '', email: t.email || '' });
      const s = t.settings || {};
      setFlags({ ...DEFAULT_FLAGS, ...(s.featureFlags || {}) });
      if (s.uiTheme) setUiTheme(s.uiTheme);
    }).catch(() => {});
    loadIntegrations();
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadIntegrations() {
    configApi.listIntegrations().then((res: any) => {
      setIntegrations(res.data || []);
    }).catch(() => {});
  }

  // ── Contraseña ──
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(''); setPwErr('');
    if (pwForm.newPassword !== pwForm.confirm) { setPwErr('Las contraseñas no coinciden'); return; }
    try {
      await authApi.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg('Contraseña actualizada correctamente');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : 'Error al actualizar contraseña');
    }
  };

  // ── Tenant ──
  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setTenantMsg(''); setTenantErr('');
    try {
      await configApi.updateTenant(tenantForm);
      setTenantMsg('Datos del fraccionamiento actualizados');
    } catch (err) {
      setTenantErr(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  // ── Feature flags ──
  const handleSaveFlags = async () => {
    setSavingFlags(true); setFlagsMsg(''); setFlagsErr('');
    try {
      await configApi.updateTenant({ featureFlags: flags, ...(isSuperAdmin ? { uiTheme } : {}) });
      setFlagsMsg('Configuración guardada');
      setTimeout(() => setFlagsMsg(''), 3000);
    } catch (err) {
      setFlagsErr(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingFlags(false);
    }
  };

  // ── Integraciones ──
  function openCreateModal() {
    setEditingInt(null);
    setShowIntModal(true);
  }
  function openEditModal(int: Integration) {
    setEditingInt(int);
    setShowIntModal(true);
  }

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm('¿Eliminar esta integración?')) return;
    await configApi.deleteIntegration(id).catch(() => {});
    loadIntegrations();
  };

  const handleTestIntegration = async (id: string) => {
    setTestingId(id);
    try { await configApi.testIntegration(id); }
    catch { /* ignored */ }
    finally {
      setTestingId(null);
      loadIntegrations();
    }
  };

  const canManage = isAdmin || isSuperAdmin;

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Preferencias de cuenta y sistema" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Info de cuenta ── */}
        <div className="glass-card">
          <h3 className="font-semibold text-slate-700 mb-4">Información de cuenta</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500">Nombre</label>
              <p className="font-medium text-slate-800">{user?.firstName} {user?.lastName}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500">Email</label>
              <p className="font-medium text-slate-800">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* ── Selector de tenant — SuperAdmin: todos los fraccionamientos ── */}
        {isSuperAdmin && allTenants.length > 0 && (
          <div className="glass-card">
            <h3 className="font-semibold text-slate-700 mb-4">Fraccionamiento activo</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {allTenants.map((t) => (
                <button key={t.id} onClick={() => setTenant(t.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    tenantId === t.id
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-slate-500">SuperAdmin</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Selector de tenant — Admin multi-tenant ── */}
        {!isSuperAdmin && user && user.tenants.length > 1 && (
          <div className="glass-card">
            <h3 className="font-semibold text-slate-700 mb-4">Fraccionamiento activo</h3>
            <div className="space-y-2">
              {user.tenants.map((t) => (
                <button key={t.tenantId} onClick={() => setTenant(t.tenantId)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    tenantId === t.tenantId
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <p className="font-medium">{t.tenantName}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Cambiar contraseña ── */}
        <div className="glass-card">
          <h3 className="font-semibold text-slate-700 mb-4">Cambiar contraseña</h3>
          {pwMsg && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl mb-4">{pwMsg}</div>}
          {pwErr && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-4">{pwErr}</div>}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña actual</label>
              <input type="password" className="input-field" value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
              <input type="password" className="input-field" value={pwForm.newPassword} minLength={6}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
              <input type="password" className="input-field" value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary">Actualizar contraseña</button>
          </form>
        </div>

        {/* ── Datos del fraccionamiento ── */}
        {canManage && (
          <div className="glass-card">
            <h3 className="font-semibold text-slate-700 mb-4">Datos del fraccionamiento</h3>
            {tenantMsg && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl mb-4">{tenantMsg}</div>}
            {tenantErr && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-4">{tenantErr}</div>}
            <form onSubmit={handleUpdateTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input type="text" className="input-field" value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                <input type="text" className="input-field" value={tenantForm.address}
                  onChange={(e) => setTenantForm({ ...tenantForm, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <input type="text" className="input-field" value={tenantForm.phone}
                    onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" className="input-field" value={tenantForm.email}
                    onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn-primary">Guardar cambios</button>
            </form>
          </div>
        )}
      </div>

      {/* ── Feature flags ── */}
      {canManage && (
        <div className="glass-card mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-slate-700">Funciones de acceso</h3>
              <p className="text-sm text-slate-500 mt-0.5">Configura qué botones aparecen en la app móvil</p>
            </div>
            <button onClick={handleSaveFlags} disabled={savingFlags} className="btn-primary text-sm disabled:opacity-60">
              {savingFlags ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {flagsMsg && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl mb-4">{flagsMsg}</div>}
          {flagsErr && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-4">{flagsErr}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Botones de acceso</h4>
              {[
                { key: 'showResidentAccessButton', label: 'Botón entrada/salida residentes' },
                { key: 'showVisitorAccessButton',  label: 'Botón entrada/salida visitas' },
                { key: 'showExitButton',           label: 'Mostrar botón de salida' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                  <span className="text-sm text-slate-700">{label}</span>
                  <div
                    className={`relative w-11 h-6 rounded-full transition-colors ${flags[key as keyof FeatureFlags] ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    onClick={() => setFlags({ ...flags, [key]: !flags[key as keyof FeatureFlags] })}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${flags[key as keyof FeatureFlags] ? 'translate-x-5' : ''}`} />
                  </div>
                </label>
              ))}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">QR Rápido</h4>
              <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <span className="text-sm text-slate-700">Habilitar QR rápido (Uber, Delivery…)</span>
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors ${flags.quickQrEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  onClick={() => setFlags({ ...flags, quickQrEnabled: !flags.quickQrEnabled })}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${flags.quickQrEnabled ? 'translate-x-5' : ''}`} />
                </div>
              </label>
              {flags.quickQrEnabled && (
                <>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Duración del QR: <span className="font-semibold text-slate-800">{flags.quickQrDurationHours}h</span>
                    </label>
                    <input type="range" min={1} max={24} value={flags.quickQrDurationHours}
                      onChange={(e) => setFlags({ ...flags, quickQrDurationHours: Number(e.target.value) })}
                      className="w-full accent-emerald-500" />
                    <div className="flex justify-between text-xs text-slate-400 mt-0.5"><span>1h</span><span>24h</span></div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Usos máximos: <span className="font-semibold text-slate-800">{flags.quickQrMaxUses}</span>
                    </label>
                    <input type="range" min={1} max={10} value={flags.quickQrMaxUses}
                      onChange={(e) => setFlags({ ...flags, quickQrMaxUses: Number(e.target.value) })}
                      className="w-full accent-emerald-500" />
                    <div className="flex justify-between text-xs text-slate-400 mt-0.5"><span>1</span><span>10</span></div>
                  </div>
                </>
              )}

              {isSuperAdmin && (
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Tema de la app</h4>
                  <div className="flex gap-3">
                    {(['DARK', 'LIGHT'] as const).map((t) => (
                      <button key={t} onClick={() => setUiTheme(t)}
                        className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${uiTheme === t ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        {t === 'DARK' ? '🌙 Oscuro' : '☀️ Claro'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Integraciones de hardware ── */}
      {canManage && (
        <div className="glass-card mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-slate-700">Integraciones de hardware</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Equipos compatibles: ERREKA VIVO-M203M, Hikvision, Axis, ONVIF, MQTT
              </p>
            </div>
            <button onClick={openCreateModal} className="btn-primary text-sm">+ Nueva integración</button>
          </div>

          {integrations.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-4xl mb-3">🔌</p>
              <p>No hay integraciones configuradas</p>
              <p className="text-xs mt-1">Agrega tu primer equipo con el botón de arriba</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {integrations.map((int) => {
                const badge = STATUS_BADGE[int.status];
                return (
                  <div key={int.id} className="border border-slate-200 rounded-xl p-4 bg-white/60 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{int.name}</p>
                        <p className="text-xs text-slate-500">{INTEGRATION_LABELS[int.type]}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 space-y-1">
                      {int.host      && <p>🌐 {int.host}{int.port ? `:${int.port}` : ''}</p>}
                      {int.mqttTopic && <p>📡 Topic: {int.mqttTopic}</p>}
                      {int.brand     && <p>🏷 {int.brand}{int.model ? ` – ${int.model}` : ''}</p>}
                      {int.lastCheck && <p>⏱ Última verificación: {new Date(int.lastCheck).toLocaleString('es-MX')}</p>}
                      {int.errorMessage && <p className="text-red-500">⚠ {int.errorMessage}</p>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleTestIntegration(int.id)} disabled={testingId === int.id}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50">
                        {testingId === int.id ? 'Probando...' : 'Probar'}
                      </button>
                      <button onClick={() => openEditModal(int)}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                        Editar
                      </button>
                      <button onClick={() => handleDeleteIntegration(int.id)}
                        className="text-xs py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal de integración (componente independiente) ── */}
      <IntegrationModal
        isOpen={showIntModal}
        editingInt={editingInt}
        onClose={() => setShowIntModal(false)}
        onSaved={loadIntegrations}
      />
    </div>
  );
}
