'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { authApi, configApi, tenantsApi, devicesApi, serviceQrApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';
import { QRCodeSVG } from 'qrcode.react';

// ── Tipos payment config ───────────────────────────────────────
interface BankAccount {
  bankName: string;
  accountHolder: string;
  clabe: string;
  accountNumber: string;
  referenceTemplate: string;
}

interface AdditionalCharge {
  name: string;
  amount: number;
  dueDate: string;
  description: string;
}

interface PaymentConfig {
  monthlyAmount: number;
  currency: string;
  paymentConcept: string;
  dueDayOfMonth: number;
  gracePeriodDays: number;
  bankAccounts: BankAccount[];
  additionalCharges: AdditionalCharge[];
}

const DEFAULT_PAYMENT_CFG: PaymentConfig = {
  monthlyAmount: 0,
  currency: 'MXN',
  paymentConcept: 'Cuota de mantenimiento',
  dueDayOfMonth: 5,
  gracePeriodDays: 5,
  bankAccounts: [],
  additionalCharges: [],
};

const EMPTY_BANK_ACCOUNT: BankAccount = {
  bankName: '', accountHolder: '', clabe: '', accountNumber: '', referenceTemplate: '',
};

const EMPTY_CHARGE: AdditionalCharge = {
  name: '', amount: 0, dueDate: '', description: '',
};

// ── Tipos emergency ────────────────────────────────────────────
interface EmergencyNumber {
  instance: string;
  number: string;
}

const EMPTY_EMERGENCY: EmergencyNumber = { instance: '', number: '' };

// ── Tipos QR Servicios ─────────────────────────────────────────
interface ServiceQrConfig {
  enabled: boolean;
  deviceId: string;
  services: string[];
  guardCanApprove: boolean;
  adminCanApprove: boolean;
  showResidentPhone: boolean;
  requireUnit: boolean;
  requirePhoto: boolean;
  requestTtlMinutes: number;
  rotateDays: number;
}

const DEFAULT_SVC_QR: ServiceQrConfig = {
  enabled: false,
  deviceId: '',
  services: ['CFE', 'Gas', 'Agua', 'Basura', 'Paquetería', 'Mensajería', 'Otro'],
  guardCanApprove: true,
  adminCanApprove: true,
  showResidentPhone: false,
  requireUnit: false,
  requirePhoto: false,
  requestTtlMinutes: 15,
  rotateDays: 7,
};

// ── Tipos feature flags ────────────────────────────────────────
interface FeatureFlags {
  showResidentAccessButton: boolean;
  showVisitorAccessButton: boolean;
  showExitButton: boolean;
  quickQrEnabled: boolean;
  quickQrDurationHours: number;
  quickQrMaxUses: number;
  residentEntryDeviceId: string;
  residentExitDeviceId: string;
  visitorEntryDeviceId: string;
  visitorExitDeviceId: string;
}

const DEFAULT_FLAGS: FeatureFlags = {
  showResidentAccessButton: false,
  showVisitorAccessButton: false,
  showExitButton: false,
  quickQrEnabled: false,
  quickQrDurationHours: 2,
  quickQrMaxUses: 3,
  residentEntryDeviceId: '',
  residentExitDeviceId: '',
  visitorEntryDeviceId: '',
  visitorExitDeviceId: '',
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

// ── QrPosterModal ───────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, string> = {
  CFE: '⚡', Gas: '🔥', Agua: '💧', Basura: '🗑️',
  Paquetería: '📦', Mensajería: '📬', Domicilio: '🛵',
  Técnico: '🔧', Jardinería: '🌿', Limpieza: '🧹', Otro: '🔔',
};

function QrPosterModal({
  url, tenantName, services, onClose,
}: {
  url: string; tenantName: string; services: string[]; onClose: () => void;
}) {
  const posterRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = posterRef.current?.innerHTML;
    if (!content) return;
    const w = window.open('', '_blank', 'width=620,height=900');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>QR Servicios Externos — ${tenantName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          @media print {
            @page { size: letter portrait; margin: 1cm; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>

      {/* Botones de acción (fuera del poster, no se imprimen) */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-colors text-sm"
        >
          🖨️ Imprimir
        </button>
        <button
          onClick={onClose}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          ✕ Cerrar
        </button>
      </div>

      {/* Poster — diseño media carta */}
      <div
        ref={posterRef}
        style={{
          width: '440px',
          background: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header verde */}
        <div style={{
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          padding: '28px 28px 22px',
          position: 'relative',
        }}>
          {/* Logo + nombre tenant */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo3_ia2.png" alt="iaDoS" style={{ height: '44px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
            <div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff', lineHeight: 1.1 }}>
                {tenantName || 'Fraccionamiento'}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', fontWeight: '500', letterSpacing: '0.5px' }}>
                Accesos Digitales · iaDoS
              </div>
            </div>
          </div>
        </div>

        {/* Banda de título */}
        <div style={{
          background: '#f0fdf4',
          borderBottom: '2px solid #d1fae5',
          padding: '16px 28px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#059669', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
            Servicios Externos
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>
            Solicitud de Acceso
          </div>
        </div>

        {/* Servicios disponibles */}
        {services.length > 0 && (
          <div style={{ padding: '18px 28px 12px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
              Servicios disponibles
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {services.map((svc) => (
                <span key={svc} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: '#f8fafc', border: '1.5px solid #e2e8f0',
                  borderRadius: '20px', padding: '5px 12px',
                  fontSize: '13px', fontWeight: '600', color: '#374151',
                }}>
                  {SERVICE_ICONS[svc] || '🔔'} {svc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Instrucción */}
        <div style={{ padding: '16px 28px 0', textAlign: 'center' }}>
          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
            border: '1.5px solid #a7f3d0',
            borderRadius: '12px',
            padding: '12px 18px',
          }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#065f46', marginBottom: '2px' }}>
              Favor de escanear el código QR
            </div>
            <div style={{ fontSize: '13px', color: '#047857' }}>
              para solicitar su acceso al fraccionamiento
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '22px 28px' }}>
          <div style={{
            background: '#ffffff',
            border: '3px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}>
            <QRCodeSVG
              value={url}
              size={220}
              level="M"
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
            <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1.5px', fontFamily: 'monospace' }}>
              {url.split('/').slice(-1)[0]?.toUpperCase().slice(0, 16) || ''}
            </div>
          </div>
        </div>

        {/* Separador */}
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)', margin: '0 28px' }} />

        {/* Footer */}
        <div style={{
          background: '#f8fafc',
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>Desarrollado por</div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>iados.mx</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo3_ia2.png" alt="iaDoS" style={{ height: '22px', width: 'auto', opacity: 0.4 }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>Informes</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>
              WhatsApp 81 2914 3497
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  // Payment config
  const [paymentCfg, setPaymentCfg] = useState<PaymentConfig>({ ...DEFAULT_PAYMENT_CFG });
  const [paymentMsg, setPaymentMsg] = useState('');
  const [paymentErr, setPaymentErr] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Emergency numbers
  const [emergencyNums, setEmergencyNums] = useState<EmergencyNumber[]>([]);
  const [emergencyMsg, setEmergencyMsg] = useState('');
  const [emergencyErr, setEmergencyErr] = useState('');
  const [savingEmergency, setSavingEmergency] = useState(false);

  // Service QR
  const [svcQrCfg, setSvcQrCfg] = useState<ServiceQrConfig>({ ...DEFAULT_SVC_QR });
  const [svcQrMsg, setSvcQrMsg] = useState('');
  const [svcQrErr, setSvcQrErr] = useState('');
  const [savingSvcQr, setSavingSvcQr] = useState(false);
  const [svcQrUrl, setSvcQrUrl] = useState('');
  const [newService, setNewService] = useState('');
  const [showQrPoster, setShowQrPoster] = useState(false);

  // Dispositivos (para selectors en feature flags)
  const [devices, setDevices] = useState<{ id: string; name: string; status: string }[]>([]);

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
      if (s.paymentConfig) setPaymentCfg({ ...DEFAULT_PAYMENT_CFG, ...s.paymentConfig });
      if (s.emergencyNumbers) setEmergencyNums(s.emergencyNumbers);
      if (s.serviceQrConfig) setSvcQrCfg({ ...DEFAULT_SVC_QR, ...s.serviceQrConfig });
    }).catch(() => {});
    // Cargar QR actual de servicios
    serviceQrApi.currentQR().then((res: any) => {
      if (res.data?.url) setSvcQrUrl(res.data.url);
    }).catch(() => {});
    loadIntegrations();
    devicesApi.list().then((res: any) => {
      setDevices((res.data || []).filter((d: any) => d.isActive));
    }).catch(() => {});
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

  // ── Payment config ──
  const handleSavePaymentConfig = async () => {
    setSavingPayment(true); setPaymentMsg(''); setPaymentErr('');
    try {
      await configApi.updateTenant({ paymentConfig: paymentCfg });
      setPaymentMsg('Configuración de cobro guardada');
      setTimeout(() => setPaymentMsg(''), 3000);
    } catch (err) {
      setPaymentErr(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingPayment(false);
    }
  };

  function addBankAccount() {
    setPaymentCfg((p) => ({ ...p, bankAccounts: [...p.bankAccounts, { ...EMPTY_BANK_ACCOUNT }] }));
  }
  function updateBankAccount(idx: number, field: keyof BankAccount, value: string) {
    setPaymentCfg((p) => {
      const accounts = [...p.bankAccounts];
      accounts[idx] = { ...accounts[idx], [field]: value };
      return { ...p, bankAccounts: accounts };
    });
  }
  function removeBankAccount(idx: number) {
    setPaymentCfg((p) => ({ ...p, bankAccounts: p.bankAccounts.filter((_, i) => i !== idx) }));
  }

  function addAdditionalCharge() {
    setPaymentCfg((p) => ({ ...p, additionalCharges: [...p.additionalCharges, { ...EMPTY_CHARGE }] }));
  }
  function updateAdditionalCharge(idx: number, field: keyof AdditionalCharge, value: string | number) {
    setPaymentCfg((p) => {
      const charges = [...p.additionalCharges];
      charges[idx] = { ...charges[idx], [field]: value };
      return { ...p, additionalCharges: charges };
    });
  }
  function removeAdditionalCharge(idx: number) {
    setPaymentCfg((p) => ({ ...p, additionalCharges: p.additionalCharges.filter((_, i) => i !== idx) }));
  }

  // ── Emergency numbers ──
  const handleSaveEmergency = async () => {
    setSavingEmergency(true); setEmergencyMsg(''); setEmergencyErr('');
    try {
      await configApi.updateTenant({ emergencyNumbers: emergencyNums });
      setEmergencyMsg('Números de emergencia guardados');
      setTimeout(() => setEmergencyMsg(''), 3000);
    } catch (err) {
      setEmergencyErr(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingEmergency(false);
    }
  };

  function addEmergencyNumber() {
    setEmergencyNums((n) => [...n, { ...EMPTY_EMERGENCY }]);
  }
  function updateEmergencyNumber(idx: number, field: keyof EmergencyNumber, value: string) {
    setEmergencyNums((n) => {
      const arr = [...n];
      arr[idx] = { ...arr[idx], [field]: value };
      return arr;
    });
  }
  function removeEmergencyNumber(idx: number) {
    setEmergencyNums((n) => n.filter((_, i) => i !== idx));
  }

  // ── Service QR ──
  const handleSaveSvcQr = async () => {
    setSavingSvcQr(true); setSvcQrMsg(''); setSvcQrErr('');
    try {
      await configApi.updateTenant({ serviceQrConfig: svcQrCfg });
      setSvcQrMsg('Configuración guardada');
      setTimeout(() => setSvcQrMsg(''), 3000);
    } catch (err) {
      setSvcQrErr(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingSvcQr(false);
    }
  };

  const handleRegenerateQR = async () => {
    if (!confirm('¿Regenerar el QR? El anterior dejará de funcionar.')) return;
    try {
      const res: any = await serviceQrApi.regenerate();
      if (res.data?.url) setSvcQrUrl(res.data.url);
      setSvcQrMsg('QR regenerado');
      setTimeout(() => setSvcQrMsg(''), 3000);
    } catch (err) {
      setSvcQrErr(err instanceof Error ? err.message : 'Error al regenerar');
    }
  };

  function addService() {
    const s = newService.trim();
    if (!s || svcQrCfg.services.includes(s)) return;
    setSvcQrCfg(c => ({ ...c, services: [...c.services, s] }));
    setNewService('');
  }

  function removeService(idx: number) {
    setSvcQrCfg(c => ({ ...c, services: c.services.filter((_, i) => i !== idx) }));
  }

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

      {/* ── Gestión de cobro ── */}
      {canManage && (
        <div className="glass-card mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-slate-700">Gestión de cobro</h3>
              <p className="text-sm text-slate-500 mt-0.5">Cuotas de mantenimiento y cuentas bancarias para transferencias</p>
            </div>
            <button onClick={handleSavePaymentConfig} disabled={savingPayment} className="btn-primary text-sm disabled:opacity-60">
              {savingPayment ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {paymentMsg && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl mb-4">{paymentMsg}</div>}
          {paymentErr && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-4">{paymentErr}</div>}

          {/* Cuota mensual */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cuota mensual</label>
              <div className="flex gap-2">
                <select className="text-sm border border-slate-200 rounded-xl px-2 py-2 bg-white w-20"
                  value={paymentCfg.currency}
                  onChange={(e) => setPaymentCfg({ ...paymentCfg, currency: e.target.value })}>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
                <input type="number" min={0} step={0.01} className="input-field flex-1" placeholder="0.00"
                  value={paymentCfg.monthlyAmount || ''}
                  onChange={(e) => setPaymentCfg({ ...paymentCfg, monthlyAmount: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Concepto de pago</label>
              <input type="text" className="input-field" placeholder="ej. Cuota de mantenimiento"
                value={paymentCfg.paymentConcept}
                onChange={(e) => setPaymentCfg({ ...paymentCfg, paymentConcept: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Día de cobro</label>
                <input type="number" min={1} max={31} className="input-field" placeholder="5"
                  value={paymentCfg.dueDayOfMonth || ''}
                  onChange={(e) => setPaymentCfg({ ...paymentCfg, dueDayOfMonth: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Días gracia</label>
                <input type="number" min={0} max={30} className="input-field" placeholder="0"
                  value={paymentCfg.gracePeriodDays ?? ''}
                  onChange={(e) => setPaymentCfg({ ...paymentCfg, gracePeriodDays: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          {/* Cuentas bancarias */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Cuentas bancarias</h4>
              <button onClick={addBankAccount} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Agregar cuenta</button>
            </div>
            <div className="space-y-3">
              {paymentCfg.bankAccounts.map((acc, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-white/60">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Banco</label>
                      <input type="text" className="input-field text-sm" placeholder="ej. BBVA"
                        value={acc.bankName} onChange={(e) => updateBankAccount(idx, 'bankName', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Titular de la cuenta</label>
                      <input type="text" className="input-field text-sm" placeholder="ej. Fracc. Los Pinos"
                        value={acc.accountHolder} onChange={(e) => updateBankAccount(idx, 'accountHolder', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">CLABE interbancaria (18 dígitos)</label>
                      <input type="text" className="input-field text-sm" placeholder="012180001234567890" maxLength={18}
                        value={acc.clabe} onChange={(e) => updateBankAccount(idx, 'clabe', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Número de cuenta</label>
                      <input type="text" className="input-field text-sm" placeholder="10-11 dígitos"
                        value={acc.accountNumber} onChange={(e) => updateBankAccount(idx, 'accountNumber', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Referencia de pago</label>
                      <input type="text" className="input-field text-sm" placeholder="ej. MANT-101-MAR"
                        value={acc.referenceTemplate} onChange={(e) => updateBankAccount(idx, 'referenceTemplate', e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button onClick={() => removeBankAccount(idx)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                      Eliminar cuenta
                    </button>
                  </div>
                </div>
              ))}
              {paymentCfg.bankAccounts.length === 0 && (
                <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-sm">No hay cuentas bancarias. Agrega al menos una para que los residentes puedan hacer transferencias.</p>
                </div>
              )}
            </div>
          </div>

          {/* Cuotas adicionales */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Cuotas adicionales</h4>
              <button onClick={addAdditionalCharge} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Agregar cuota</button>
            </div>
            <div className="space-y-3">
              {paymentCfg.additionalCharges.map((charge, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-white/60">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Concepto</label>
                      <input type="text" className="input-field text-sm" placeholder="ej. Cuota extraordinaria"
                        value={charge.name} onChange={(e) => updateAdditionalCharge(idx, 'name', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Monto ({paymentCfg.currency})</label>
                      <input type="number" min={0} step={0.01} className="input-field text-sm" placeholder="0.00"
                        value={charge.amount || ''}
                        onChange={(e) => updateAdditionalCharge(idx, 'amount', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Fecha límite</label>
                      <input type="date" className="input-field text-sm"
                        value={charge.dueDate} onChange={(e) => updateAdditionalCharge(idx, 'dueDate', e.target.value)} />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs text-slate-500 mb-1">Descripción</label>
                      <input type="text" className="input-field text-sm" placeholder="Descripción opcional"
                        value={charge.description} onChange={(e) => updateAdditionalCharge(idx, 'description', e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button onClick={() => removeAdditionalCharge(idx)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                      Eliminar cuota
                    </button>
                  </div>
                </div>
              ))}
              {paymentCfg.additionalCharges.length === 0 && (
                <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-sm">No hay cuotas adicionales configuradas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

              {/* Residentes */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50">
                  <span className="text-sm text-slate-700">Botón acceso residentes</span>
                  <div className={`relative w-11 h-6 rounded-full transition-colors ${flags.showResidentAccessButton ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    onClick={() => setFlags({ ...flags, showResidentAccessButton: !flags.showResidentAccessButton })}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${flags.showResidentAccessButton ? 'translate-x-5' : ''}`} />
                  </div>
                </label>
                {flags.showResidentAccessButton && (
                  <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/50 space-y-2">
                    {([
                      { label: 'Dispositivo entrada', field: 'residentEntryDeviceId' as const },
                      ...(flags.showExitButton ? [{ label: 'Dispositivo salida', field: 'residentExitDeviceId' as const }] : []),
                    ]).map(({ label, field }) => (
                      <div key={field} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-28 shrink-0">{label}:</span>
                        <select className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                          value={flags[field]}
                          onChange={(e) => setFlags({ ...flags, [field]: e.target.value })}>
                          <option value="">— Sin dispositivo —</option>
                          {devices.map(d => (
                            <option key={d.id} value={d.id}>{d.name}{d.status === 'OFFLINE' ? ' (Offline)' : ''}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Visitas */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50">
                  <span className="text-sm text-slate-700">Botón acceso visitas</span>
                  <div className={`relative w-11 h-6 rounded-full transition-colors ${flags.showVisitorAccessButton ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    onClick={() => setFlags({ ...flags, showVisitorAccessButton: !flags.showVisitorAccessButton })}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${flags.showVisitorAccessButton ? 'translate-x-5' : ''}`} />
                  </div>
                </label>
                {flags.showVisitorAccessButton && (
                  <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/50 space-y-2">
                    {([
                      { label: 'Dispositivo entrada', field: 'visitorEntryDeviceId' as const },
                      ...(flags.showExitButton ? [{ label: 'Dispositivo salida', field: 'visitorExitDeviceId' as const }] : []),
                    ]).map(({ label, field }) => (
                      <div key={field} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-28 shrink-0">{label}:</span>
                        <select className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                          value={flags[field]}
                          onChange={(e) => setFlags({ ...flags, [field]: e.target.value })}>
                          <option value="">— Sin dispositivo —</option>
                          {devices.map(d => (
                            <option key={d.id} value={d.id}>{d.name}{d.status === 'OFFLINE' ? ' (Offline)' : ''}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Salida toggle */}
              <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <span className="text-sm text-slate-700">Mostrar botón de salida</span>
                <div className={`relative w-11 h-6 rounded-full transition-colors ${flags.showExitButton ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  onClick={() => setFlags({ ...flags, showExitButton: !flags.showExitButton })}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${flags.showExitButton ? 'translate-x-5' : ''}`} />
                </div>
              </label>
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

      {/* ── Números de emergencia ── */}
      {canManage && (
        <div className="glass-card mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-slate-700">Números de emergencia</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Aparecen en la alerta de pánico que reciben administradores y guardias
              </p>
            </div>
            <button onClick={handleSaveEmergency} disabled={savingEmergency} className="btn-primary text-sm disabled:opacity-60">
              {savingEmergency ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {emergencyMsg && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl mb-4">{emergencyMsg}</div>}
          {emergencyErr && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-4">{emergencyErr}</div>}

          <div className="space-y-3">
            {emergencyNums.map((en, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="ej. Bomberos"
                  value={en.instance}
                  onChange={(e) => updateEmergencyNumber(idx, 'instance', e.target.value)}
                />
                <input
                  type="text"
                  className="input-field w-40"
                  placeholder="ej. 911"
                  value={en.number}
                  onChange={(e) => updateEmergencyNumber(idx, 'number', e.target.value)}
                />
                <button
                  onClick={() => removeEmergencyNumber(idx)}
                  className="text-red-400 hover:text-red-600 shrink-0 text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
            {emergencyNums.length === 0 && (
              <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <p className="text-sm">No hay números configurados. Los residentes verán esta información en la alerta de pánico.</p>
              </div>
            )}
            <button
              onClick={addEmergencyNumber}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              + Agregar número
            </button>
          </div>
        </div>
      )}

      {/* ── QR Servicios Externos ── */}
      {canManage && (
        <div className="glass-card mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-slate-700">QR Servicios Externos</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                QR único para que visitantes (CFE, paquetería, etc.) soliciten acceso con foto
              </p>
            </div>
            <button onClick={handleSaveSvcQr} disabled={savingSvcQr} className="btn-primary text-sm disabled:opacity-60">
              {savingSvcQr ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {svcQrMsg && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl mb-4">{svcQrMsg}</div>}
          {svcQrErr && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-4">{svcQrErr}</div>}

          {/* Habilitar */}
          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 mb-4">
            <span className="text-sm text-slate-700 font-medium">Habilitar servicio de acceso QR para externos</span>
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${svcQrCfg.enabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
              onClick={() => setSvcQrCfg(c => ({ ...c, enabled: !c.enabled }))}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${svcQrCfg.enabled ? 'translate-x-5' : ''}`} />
            </div>
          </label>

          {svcQrCfg.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna izquierda */}
              <div className="space-y-4">

                {/* Catálogo de servicios */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Catálogo de servicios</h4>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {svcQrCfg.services.map((svc, idx) => (
                      <span key={idx} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-full">
                        {svc}
                        <button onClick={() => removeService(idx)} className="text-slate-400 hover:text-red-500 ml-0.5 font-bold">✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input-field flex-1 text-sm"
                      placeholder="ej. Jardinería"
                      value={newService}
                      onChange={e => setNewService(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addService(); } }}
                    />
                    <button onClick={addService} className="text-sm text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap">+ Agregar</button>
                  </div>
                </div>

                {/* Dispositivo */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Dispositivo de acceso</h4>
                  <select
                    className="input-field text-sm w-full"
                    value={svcQrCfg.deviceId}
                    onChange={e => setSvcQrCfg(c => ({ ...c, deviceId: e.target.value }))}
                  >
                    <option value="">— Sin dispositivo —</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>{d.name}{d.status === 'OFFLINE' ? ' (Offline)' : ''}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Se activa automáticamente cuando el residente aprueba</p>
                </div>

                {/* Tiempos */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      TTL solicitud: <span className="font-bold">{svcQrCfg.requestTtlMinutes} min</span>
                    </label>
                    <input type="range" min={5} max={120} step={5} value={svcQrCfg.requestTtlMinutes}
                      onChange={e => setSvcQrCfg(c => ({ ...c, requestTtlMinutes: Number(e.target.value) }))}
                      className="w-full accent-emerald-500" />
                    <div className="flex justify-between text-xs text-slate-400 mt-0.5"><span>5 min</span><span>2 h</span></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Rotar QR: cada <span className="font-bold">{svcQrCfg.rotateDays} días</span>
                    </label>
                    <input type="range" min={1} max={30} value={svcQrCfg.rotateDays}
                      onChange={e => setSvcQrCfg(c => ({ ...c, rotateDays: Number(e.target.value) }))}
                      className="w-full accent-emerald-500" />
                    <div className="flex justify-between text-xs text-slate-400 mt-0.5"><span>1 día</span><span>30 días</span></div>
                  </div>
                </div>
              </div>

              {/* Columna derecha */}
              <div className="space-y-4">

                {/* Permisos de aprobación */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Permisos de aprobación</h4>
                  <div className="space-y-2">
                    <div className="p-3 border border-slate-200 rounded-xl bg-emerald-50/50">
                      <p className="text-sm text-slate-700 font-medium">✓ Residente</p>
                      <p className="text-xs text-slate-400">Siempre puede aprobar su propia solicitud</p>
                    </div>
                    <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                      <div>
                        <p className="text-sm text-slate-700">Guardia puede aprobar</p>
                        <p className="text-xs text-slate-400">Si desactivado, solo recibe la notificación</p>
                      </div>
                      <div
                        className={`relative w-11 h-6 rounded-full transition-colors ${svcQrCfg.guardCanApprove ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        onClick={() => setSvcQrCfg(c => ({ ...c, guardCanApprove: !c.guardCanApprove }))}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${svcQrCfg.guardCanApprove ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                    <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                      <div>
                        <p className="text-sm text-slate-700">Admin puede aprobar</p>
                        <p className="text-xs text-slate-400">Si desactivado, solo recibe la notificación</p>
                      </div>
                      <div
                        className={`relative w-11 h-6 rounded-full transition-colors ${svcQrCfg.adminCanApprove ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        onClick={() => setSvcQrCfg(c => ({ ...c, adminCanApprove: !c.adminCanApprove }))}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${svcQrCfg.adminCanApprove ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Mostrar teléfono */}
                <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                  <div>
                    <p className="text-sm text-slate-700">Mostrar teléfono del residente</p>
                    <p className="text-xs text-slate-400">El visitante verá el teléfono al seleccionar la residencia</p>
                  </div>
                  <div
                    className={`relative w-11 h-6 rounded-full transition-colors ${svcQrCfg.showResidentPhone ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    onClick={() => setSvcQrCfg(c => ({ ...c, showResidentPhone: !c.showResidentPhone }))}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${svcQrCfg.showResidentPhone ? 'translate-x-5' : ''}`} />
                  </div>
                </label>

                {/* Campos obligatorios */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Campos obligatorios</h4>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                      <div>
                        <p className="text-sm text-slate-700">Residencia obligatoria</p>
                        <p className="text-xs text-slate-400">El visitante debe seleccionar a qué residencia va</p>
                      </div>
                      <div
                        className={`relative w-11 h-6 rounded-full transition-colors ${svcQrCfg.requireUnit ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        onClick={() => setSvcQrCfg(c => ({ ...c, requireUnit: !c.requireUnit }))}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${svcQrCfg.requireUnit ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                    <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                      <div>
                        <p className="text-sm text-slate-700">Foto obligatoria</p>
                        <p className="text-xs text-slate-400">El visitante debe tomar foto de credencial o vehículo</p>
                      </div>
                      <div
                        className={`relative w-11 h-6 rounded-full transition-colors ${svcQrCfg.requirePhoto ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        onClick={() => setSvcQrCfg(c => ({ ...c, requirePhoto: !c.requirePhoto }))}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${svcQrCfg.requirePhoto ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                  </div>
                </div>

                {/* QR actual */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">QR del fraccionamiento</h4>
                  {svcQrUrl ? (
                    <>
                      <p className="text-xs text-slate-500 break-all font-mono mb-3">{svcQrUrl}</p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setShowQrPoster(true)}
                          className="flex-1 text-xs py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
                        >
                          🖨️ Ver / Imprimir QR
                        </button>
                        <button
                          onClick={() => { navigator.clipboard.writeText(svcQrUrl); setSvcQrMsg('URL copiada'); setTimeout(() => setSvcQrMsg(''), 2000); }}
                          className="flex-1 text-xs py-2 rounded-lg border border-slate-200 hover:bg-white transition-colors"
                        >
                          Copiar URL
                        </button>
                        <button
                          onClick={handleRegenerateQR}
                          className="flex-1 text-xs py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Regenerar QR
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">Guarda la configuración para generar el QR</p>
                  )}
                </div>
              </div>
            </div>
          )}
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

      {/* ── Modal poster QR Servicios Externos ── */}
      {showQrPoster && svcQrUrl && (
        <QrPosterModal
          url={svcQrUrl}
          tenantName={tenantForm.name}
          services={svcQrCfg.services}
          onClose={() => setShowQrPoster(false)}
        />
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
