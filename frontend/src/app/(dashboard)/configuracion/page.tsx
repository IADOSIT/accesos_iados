'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { authApi, configApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';

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

// ── Componente principal ───────────────────────────────────────
export default function ConfiguracionPage() {
  const { user, tenantId, setTenant } = useAuthStore();
  const isAdmin = user?.tenants?.find((t) => t.tenantId === tenantId)?.role === 'ADMIN';

  // Cambiar contraseña
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  // Datos del fraccionamiento
  const [tenantForm, setTenantForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [tenantMsg, setTenantMsg] = useState('');
  const [tenantErr, setTenantErr] = useState('');

  // Integraciones
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showIntModal, setShowIntModal] = useState(false);
  const [editingInt, setEditingInt] = useState<Integration | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [intForm, setIntForm] = useState({
    name: '', type: 'ERREKA_MQTT' as IntegrationType,
    brand: '', model: '', host: '', port: '', username: '', password: '', mqttTopic: '',
  });
  const [intMsg, setIntMsg] = useState('');
  const [intErr, setIntErr] = useState('');

  // Cargar datos iniciales (solo ADMIN)
  useEffect(() => {
    if (!isAdmin || !tenantId) return;
    configApi.getTenant().then((res: any) => {
      const t = res.data;
      setTenantForm({ name: t.name || '', address: t.address || '', phone: t.phone || '', email: t.email || '' });
    }).catch(() => {});
    loadIntegrations();
  }, [tenantId, isAdmin]);

  function loadIntegrations() {
    configApi.listIntegrations().then((res: any) => setIntegrations(res.data || [])).catch(() => {});
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

  // ── Integraciones ──
  function openCreateModal() {
    setEditingInt(null);
    setIntForm({ name: '', type: 'ERREKA_MQTT', brand: '', model: '', host: '', port: '', username: '', password: '', mqttTopic: '' });
    setIntMsg(''); setIntErr('');
    setShowIntModal(true);
  }

  function openEditModal(int: Integration) {
    setEditingInt(int);
    setIntForm({
      name: int.name, type: int.type, brand: int.brand || '', model: int.model || '',
      host: int.host || '', port: int.port?.toString() || '', username: int.username || '',
      password: '', mqttTopic: int.mqttTopic || '',
    });
    setIntMsg(''); setIntErr('');
    setShowIntModal(true);
  }

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntMsg(''); setIntErr('');
    const payload: Record<string, unknown> = {
      name: intForm.name, type: intForm.type,
      ...(intForm.brand && { brand: intForm.brand }),
      ...(intForm.model && { model: intForm.model }),
      ...(intForm.host && { host: intForm.host }),
      ...(intForm.port && { port: parseInt(intForm.port) }),
      ...(intForm.username && { username: intForm.username }),
      ...(intForm.password && { password: intForm.password }),
      ...(intForm.mqttTopic && { mqttTopic: intForm.mqttTopic }),
    };
    try {
      if (editingInt) {
        await configApi.updateIntegration(editingInt.id, payload);
        setIntMsg('Integración actualizada');
      } else {
        await configApi.createIntegration(payload);
        setIntMsg('Integración creada');
      }
      loadIntegrations();
      setTimeout(() => setShowIntModal(false), 1000);
    } catch (err) {
      setIntErr(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm('¿Eliminar esta integración?')) return;
    await configApi.deleteIntegration(id).catch(() => {});
    loadIntegrations();
  };

  const handleTestIntegration = async (id: string) => {
    setTestingId(id);
    try {
      await configApi.testIntegration(id);
      loadIntegrations();
    } catch {
      loadIntegrations();
    } finally {
      setTestingId(null);
    }
  };

  const isMqttType = (t: IntegrationType) => t === 'ERREKA_MQTT' || t === 'GENERIC_MQTT';
  const isIpType   = (t: IntegrationType) => !isMqttType(t);

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

        {/* ── Selector de tenant ── */}
        {user && user.tenants.length > 1 && (
          <div className="glass-card">
            <h3 className="font-semibold text-slate-700 mb-4">Fraccionamiento activo</h3>
            <div className="space-y-2">
              {user.tenants.map((t) => (
                <button
                  key={t.tenantId}
                  onClick={() => setTenant(t.tenantId)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    tenantId === t.tenantId
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
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

        {/* ── Datos del fraccionamiento (ADMIN) ── */}
        {isAdmin && (
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

      {/* ── Integraciones de hardware (ADMIN, ancho completo) ── */}
      {isAdmin && (
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

                    {/* Detalles de conexión */}
                    <div className="text-xs text-slate-500 space-y-1">
                      {int.host && <p>🌐 {int.host}{int.port ? `:${int.port}` : ''}</p>}
                      {int.mqttTopic && <p>📡 Topic: {int.mqttTopic}</p>}
                      {int.brand && <p>🏷 {int.brand}{int.model ? ` – ${int.model}` : ''}</p>}
                      {int.lastCheck && (
                        <p>⏱ Última verificación: {new Date(int.lastCheck).toLocaleString('es-MX')}</p>
                      )}
                      {int.errorMessage && (
                        <p className="text-red-500">⚠ {int.errorMessage}</p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleTestIntegration(int.id)}
                        disabled={testingId === int.id}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        {testingId === int.id ? 'Probando...' : 'Probar'}
                      </button>
                      <button
                        onClick={() => openEditModal(int)}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteIntegration(int.id)}
                        className="text-xs py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
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

      {/* ── Modal de integración ── */}
      {showIntModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {editingInt ? 'Editar integración' : 'Nueva integración'}
              </h3>
              <button onClick={() => setShowIntModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleSaveIntegration} className="p-6 space-y-4">
              {intMsg && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl">{intMsg}</div>}
              {intErr && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl">{intErr}</div>}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input type="text" className="input-field" placeholder="ej. Portón principal"
                  value={intForm.name} onChange={(e) => setIntForm({ ...intForm, name: e.target.value })} required />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de integración *</label>
                <select className="input-field" value={intForm.type}
                  onChange={(e) => setIntForm({ ...intForm, type: e.target.value as IntegrationType })}>
                  {(Object.entries(INTEGRATION_LABELS) as [IntegrationType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                  <input type="text" className="input-field" placeholder="ej. ERREKA"
                    value={intForm.brand} onChange={(e) => setIntForm({ ...intForm, brand: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                  <input type="text" className="input-field" placeholder="ej. VIVO-M203M"
                    value={intForm.model} onChange={(e) => setIntForm({ ...intForm, model: e.target.value })} />
                </div>
              </div>

              {/* Campos MQTT */}
              {isMqttType(intForm.type) && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">MQTT Topic</label>
                  <input type="text" className="input-field" placeholder="ej. fraccionamiento/porton/1"
                    value={intForm.mqttTopic} onChange={(e) => setIntForm({ ...intForm, mqttTopic: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">Topic al que se publicarán los comandos de apertura</p>
                </div>
              )}

              {/* Campos IP */}
              {isIpType(intForm.type) && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Host / IP</label>
                      <input type="text" className="input-field" placeholder="192.168.1.100"
                        value={intForm.host} onChange={(e) => setIntForm({ ...intForm, host: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Puerto</label>
                      <input type="number" className="input-field" placeholder="80"
                        value={intForm.port} onChange={(e) => setIntForm({ ...intForm, port: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
                      <input type="text" className="input-field" placeholder="admin"
                        value={intForm.username} onChange={(e) => setIntForm({ ...intForm, username: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {editingInt ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                      </label>
                      <input type="password" className="input-field"
                        value={intForm.password} onChange={(e) => setIntForm({ ...intForm, password: e.target.value })} />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowIntModal(false)}
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
      )}
    </div>
  );
}
