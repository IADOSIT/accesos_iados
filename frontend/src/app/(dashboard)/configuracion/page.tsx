'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { authApi, configApi, tenantsApi, devicesApi, serviceQrApi, saasApi } from '@/services/api';
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
  exitDeviceId: string;
  exitQrValidHours: number;
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
  exitDeviceId: '',
  exitQrValidHours: 4,
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

// ── Tipos SaaS ─────────────────────────────────────────────────
interface SaasConfig {
  pricePerUnit: number;
  billingDay: number;
  gracePeriodDays: number;
  notifyOnOverdue: boolean;
  mpAccessToken: string;
  mpPublicKey: string;
}

const DEFAULT_SAAS_CFG: SaasConfig = {
  pricePerUnit: 0,
  billingDay: 1,
  gracePeriodDays: 5,
  notifyOnOverdue: true,
  mpAccessToken: '',
  mpPublicKey: '',
};

interface BillingStatus {
  period: string;
  activeUnits: number;
  pricePerUnit: number;
  totalAmount: number;
  billingDay: number;
  gracePeriodDays: number;
  dueDate: string;
  graceDue: string;
  isOverdue: boolean;
  currentPayment: any | null;
  history: any[];
  configured: boolean;
}

// ── Tipos integraciones ────────────────────────────────────────
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

// ── Tabs ────────────────────────────────────────────────────────
type ConfigTab = 'cuenta' | 'fraccionamiento' | 'cobros' | 'emergencias' | 'servicios' | 'integraciones' | 'mantenimiento';

const TABS: { key: ConfigTab; label: string; superAdminOnly?: boolean }[] = [
  { key: 'cuenta',          label: 'Cuenta' },
  { key: 'fraccionamiento', label: 'Fraccionamiento' },
  { key: 'cobros',          label: 'Cobros' },
  { key: 'emergencias',     label: 'Emergencias' },
  { key: 'servicios',       label: 'Servicios QR' },
  { key: 'integraciones',   label: 'Integraciones' },
  { key: 'mantenimiento',   label: '🔧 Mantenimiento', superAdminOnly: true },
];

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
        <div style={{
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          padding: '28px 28px 22px',
          position: 'relative',
        }}>
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

        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)', margin: '0 28px' }} />

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

// ── IntegrationModal ─────────────────────────────────────────────────────────
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

// ── Toggle helper ─────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <div
      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${value ? 'bg-emerald-500' : 'bg-slate-200'}`}
      onClick={onChange}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
    </div>
  );
}

// ── MantenimientoTab ───────────────────────────────────────────

type PurgePreview = {
  accessLogs: number; payments: number; charges: number; qrCodes: number;
  notifications: number; serviceRequests: number; auditLogs: number;
  panicAlerts: number; units: number; residents: number;
};

type PurgeOpKey = 'access_logs' | 'qr_codes' | 'notifications' | 'service_requests' |
  'panic_alerts' | 'audit_logs' | 'payments' | 'charges' | 'residents' | 'units';

const PURGE_OPS: {
  key: PurgeOpKey; label: string; previewKey: keyof PurgePreview;
  group: 'operativo' | 'financiero' | 'estructura'; note?: string;
}[] = [
  { key: 'access_logs',      label: 'Bitácora de accesos',    previewKey: 'accessLogs',      group: 'operativo' },
  { key: 'qr_codes',         label: 'Códigos QR',             previewKey: 'qrCodes',         group: 'operativo' },
  { key: 'notifications',    label: 'Notificaciones',         previewKey: 'notifications',   group: 'operativo' },
  { key: 'service_requests', label: 'Solicitudes de servicio',previewKey: 'serviceRequests', group: 'operativo' },
  { key: 'panic_alerts',     label: 'Alertas de pánico',      previewKey: 'panicAlerts',     group: 'operativo' },
  { key: 'audit_logs',       label: 'Registro de auditoría',  previewKey: 'auditLogs',       group: 'operativo' },
  { key: 'payments',         label: 'Pagos',                  previewKey: 'payments',        group: 'financiero' },
  { key: 'charges',          label: 'Cargos / Cuotas',        previewKey: 'charges',         group: 'financiero' },
  { key: 'residents',        label: 'Residentes (membresías)',previewKey: 'residents',       group: 'estructura',
    note: 'Desvincula usuarios RESIDENT del fraccionamiento' },
  { key: 'units',            label: 'Unidades',               previewKey: 'units',           group: 'estructura',
    note: 'Incluye automáticamente: pagos, cargos, QR y residentes' },
];

const PURGE_GROUPS: { key: 'operativo' | 'financiero' | 'estructura'; label: string; color: string }[] = [
  { key: 'operativo',  label: 'Datos operativos',  color: 'blue' },
  { key: 'financiero', label: 'Datos financieros', color: 'amber' },
  { key: 'estructura', label: 'Estructura',         color: 'red' },
];

const FORCED_BY_UNITS: PurgeOpKey[] = ['payments', 'charges', 'qr_codes', 'residents'];

function MantenimientoTab({ allTenants }: { allTenants: { id: string; name: string }[] }) {
  const [selectedId, setSelectedId] = useState('');
  const [preview, setPreview] = useState<PurgePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selected, setSelected] = useState<Set<PurgeOpKey>>(new Set());
  const [confirmName, setConfirmName] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [err, setErr] = useState('');

  const selectedTenant = allTenants.find(t => t.id === selectedId);

  useEffect(() => {
    if (!selectedId) { setPreview(null); return; }
    setLoadingPreview(true); setPreview(null); setResult(null); setErr('');
    tenantsApi.purgePreview(selectedId)
      .then((res: any) => setPreview(res.data))
      .catch(() => setErr('No se pudo cargar el preview'))
      .finally(() => setLoadingPreview(false));
  }, [selectedId]);

  const isForced = (key: PurgeOpKey) => selected.has('units') && (FORCED_BY_UNITS as string[]).includes(key);

  const toggle = (key: PurgeOpKey) => {
    if (isForced(key)) return;
    setSelected(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  const effectiveSelected = () => {
    const ops = new Set(selected);
    if (ops.has('units')) FORCED_BY_UNITS.forEach(k => ops.add(k));
    return ops;
  };

  const handlePurge = async () => {
    if (!selectedId || !selectedTenant) return;
    setRunning(true); setErr('');
    try {
      const res: any = await tenantsApi.purge(selectedId, Array.from(effectiveSelected()));
      setResult(res.data); setShowDialog(false); setSelected(new Set()); setConfirmName('');
      const prev: any = await tenantsApi.purgePreview(selectedId);
      setPreview(prev.data);
    } catch (e: any) { setErr(e?.message || 'Error al ejecutar purga'); }
    finally { setRunning(false); }
  };

  const colorMap: Record<string, { border: string; header: string; check: string }> = {
    blue:  { border: 'border-blue-100',  header: 'bg-blue-50 border-blue-100 text-blue-700',   check: 'accent-blue-500' },
    amber: { border: 'border-amber-100', header: 'bg-amber-50 border-amber-100 text-amber-700', check: 'accent-amber-500' },
    red:   { border: 'border-red-100',   header: 'bg-red-50 border-red-100 text-red-700',       check: 'accent-red-500' },
  };

  return (
    <div className="space-y-6">
      {/* Banner de advertencia */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
        <span className="text-2xl">⚠️</span>
        <div>
          <p className="font-semibold text-red-700">Zona de mantenimiento — Solo SuperAdmin</p>
          <p className="text-sm text-red-600 mt-1">
            Permite borrar datos de prueba de forma permanente e irreversible. Aislado por fraccionamiento.
          </p>
        </div>
      </div>

      {/* Paso 1: Selección de fraccionamiento */}
      <div className="glass-card">
        <h3 className="font-semibold text-slate-700 mb-4">1. Seleccionar fraccionamiento</h3>
        <select
          className="input-field"
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setSelected(new Set()); setResult(null); setErr(''); }}
        >
          <option value="">— Elige un fraccionamiento —</option>
          {allTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Paso 2: Selección de operaciones */}
      {selectedId && (
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">2. Seleccionar qué borrar</h3>
            <div className="flex gap-2">
              {loadingPreview && <span className="text-sm text-slate-400 self-center">Cargando...</span>}
              {!loadingPreview && preview && (<>
                <button onClick={() => setSelected(new Set(PURGE_OPS.filter(o => o.group === 'operativo').map(o => o.key)))}
                  className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                  Operativos
                </button>
                <button onClick={() => setSelected(new Set(PURGE_OPS.map(o => o.key)))}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                  Todo
                </button>
                <button onClick={() => setSelected(new Set())}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                  Limpiar
                </button>
              </>)}
            </div>
          </div>

          {preview && (
            <div className="space-y-4">
              {PURGE_GROUPS.map(group => {
                const c = colorMap[group.color];
                return (
                  <div key={group.key} className={`rounded-xl border ${c.border} overflow-hidden`}>
                    <div className={`px-4 py-2 border-b ${c.header} font-semibold text-xs uppercase tracking-wide`}>
                      {group.label}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {PURGE_OPS.filter(o => o.group === group.key).map(op => {
                        const count = preview[op.previewKey] ?? 0;
                        const forced = isForced(op.key);
                        const checked = selected.has(op.key) || forced;
                        return (
                          <label key={op.key}
                            className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                              forced ? 'bg-slate-50 opacity-60 cursor-default' : 'hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            <input type="checkbox" className={`w-4 h-4 ${c.check} flex-shrink-0`}
                              checked={checked} onChange={() => toggle(op.key)} disabled={forced} />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-slate-700 text-sm">{op.label}</span>
                              {forced
                                ? <span className="block text-xs text-slate-400">Incluido automáticamente al borrar unidades</span>
                                : op.note && <span className="block text-xs text-slate-400">{op.note}</span>
                              }
                            </div>
                            <span className={`text-sm font-mono font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                              count > 0 ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
                            }`}>
                              {count.toLocaleString()}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="font-semibold text-green-700 mb-3">✓ Purga completada</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(result).map(([k, v]) => (
              <div key={k} className="bg-white rounded-lg px-3 py-2 text-sm border border-green-100 flex justify-between gap-2">
                <span className="text-slate-500 capitalize truncate">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                <span className="font-semibold text-slate-700 flex-shrink-0">{(v as number).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{err}</div>}

      {/* Botón ejecutar */}
      {selected.size > 0 && selectedId && (
        <div className="flex justify-end">
          <button onClick={() => { setShowDialog(true); setConfirmName(''); }}
            className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors shadow-sm">
            Purgar datos seleccionados
          </button>
        </div>
      )}

      {/* Modal de confirmación */}
      {showDialog && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-800 mb-1">⚠️ Confirmar purga de datos</h3>
            <p className="text-sm text-slate-500 mb-4">
              Se borrarán permanentemente los datos seleccionados de{' '}
              <strong className="text-slate-700">{selectedTenant.name}</strong>. Esta acción no se puede deshacer.
            </p>

            {/* Resumen */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 space-y-1.5 max-h-48 overflow-y-auto">
              {Array.from(effectiveSelected()).map(key => {
                const op = PURGE_OPS.find(o => o.key === key)!;
                const count = preview ? (preview[op.previewKey] ?? 0) : 0;
                return (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-slate-600">{op.label}</span>
                    <span className="font-semibold text-red-700">{count.toLocaleString()} registros</span>
                  </div>
                );
              })}
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Escribe <strong>{selectedTenant.name}</strong> para confirmar:
              </label>
              <input type="text" className="input-field"
                placeholder={selectedTenant.name}
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowDialog(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handlePurge}
                disabled={confirmName !== selectedTenant.name || running}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors">
                {running ? 'Purgando...' : 'Confirmar y purgar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────
export default function ConfiguracionPage() {
  const { user, tenantId, setTenant } = useAuthStore();
  const isAdmin    = user?.tenants?.find((t) => t.tenantId === tenantId)?.role === 'ADMIN';
  const isSuperAdmin = user?.isSuperAdmin === true;

  const canManage = isAdmin || isSuperAdmin;

  // ── Tab ──
  const [tab, setTab] = useState<ConfigTab>('cuenta');

  // ── Tenant list (SuperAdmin) ──
  const [allTenants, setAllTenants] = useState<{ id: string; name: string }[]>([]);

  // ── Cuenta ──
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  // ── Fraccionamiento ──
  const [tenantForm, setTenantForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [tenantMsg, setTenantMsg] = useState('');
  const [tenantErr, setTenantErr] = useState('');

  // ── Feature flags ──
  const [flags, setFlags] = useState<FeatureFlags>({ ...DEFAULT_FLAGS });
  const [uiTheme, setUiTheme] = useState<'DARK' | 'LIGHT'>('DARK');
  const [flagsMsg, setFlagsMsg] = useState('');
  const [flagsErr, setFlagsErr] = useState('');
  const [savingFlags, setSavingFlags] = useState(false);

  // ── Payment config ──
  const [paymentCfg, setPaymentCfg] = useState<PaymentConfig>({ ...DEFAULT_PAYMENT_CFG });
  const [paymentMsg, setPaymentMsg] = useState('');
  const [paymentErr, setPaymentErr] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // ── Política de morosos ──
  const DEFAULT_DELINQUENT_POLICY = {
    blockAppAccess: true, blockQrAccess: true, blockQrGeneration: false,
    notifyResident: true, notifyAdmin: false,
  };
  const [delinquentPolicy, setDelinquentPolicy] = useState({ ...DEFAULT_DELINQUENT_POLICY });
  const [savingDelinquent, setSavingDelinquent] = useState(false);
  const [delinquentMsg, setDelinquentMsg] = useState('');
  const [delinquentErr, setDelinquentErr] = useState('');

  // ── SaaS Cobro por Uso ──
  const [saasCfg, setSaasCfg] = useState<SaasConfig>({ ...DEFAULT_SAAS_CFG });
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [saasCfgMsg, setSaasCfgMsg] = useState('');
  const [saasCfgErr, setSaasCfgErr] = useState('');
  const [savingSaas, setSavingSaas] = useState(false);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpMsg, setMpMsg] = useState('');
  const [mpErr, setMpErr] = useState('');

  // ── Emergency numbers ──
  const [emergencyNums, setEmergencyNums] = useState<EmergencyNumber[]>([]);
  const [emergencyMsg, setEmergencyMsg] = useState('');
  const [emergencyErr, setEmergencyErr] = useState('');
  const [savingEmergency, setSavingEmergency] = useState(false);

  // ── Service QR ──
  const [svcQrCfg, setSvcQrCfg] = useState<ServiceQrConfig>({ ...DEFAULT_SVC_QR });
  const [svcQrMsg, setSvcQrMsg] = useState('');
  const [svcQrErr, setSvcQrErr] = useState('');
  const [savingSvcQr, setSavingSvcQr] = useState(false);
  const [svcQrUrl, setSvcQrUrl] = useState('');
  const [newService, setNewService] = useState('');
  const [showQrPoster, setShowQrPoster] = useState(false);

  // ── Dispositivos (para selectors) ──
  const [devices, setDevices] = useState<{ id: string; name: string; status: string }[]>([]);

  // ── Integraciones ──
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showIntModal, setShowIntModal] = useState(false);
  const [editingInt, setEditingInt] = useState<Integration | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // ── Cargar lista de tenants (SuperAdmin) — UNA VEZ ──
  useEffect(() => {
    if (!isSuperAdmin) return;
    tenantsApi.list().then((res: any) => {
      setAllTenants((res.data || []).map((t: any) => ({ id: t.id, name: t.name })));
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cargar datos del tenant cuando cambia tenantId ──
  useEffect(() => {
    if (!tenantId || (!isAdmin && !isSuperAdmin)) return;
    configApi.getTenant().then((res: any) => {
      const t = res.data;
      setTenantForm({ name: t.name || '', address: t.address || '', phone: t.phone || '', email: t.email || '' });
      const s = t.settings || {};
      setFlags({ ...DEFAULT_FLAGS, ...(s.featureFlags || {}) });
      if (s.uiTheme) setUiTheme(s.uiTheme);
      if (s.paymentConfig) setPaymentCfg({ ...DEFAULT_PAYMENT_CFG, ...s.paymentConfig });
      if (s.delinquentPolicy) setDelinquentPolicy({ ...DEFAULT_DELINQUENT_POLICY, ...s.delinquentPolicy });
      if (s.emergencyNumbers) setEmergencyNums(s.emergencyNumbers);
      if (s.serviceQrConfig) setSvcQrCfg({ ...DEFAULT_SVC_QR, ...s.serviceQrConfig });
    }).catch(() => {});
    serviceQrApi.currentQR().then((res: any) => {
      if (res.data?.url) setSvcQrUrl(res.data.url);
    }).catch(() => {});
    loadIntegrations();
    devicesApi.list().then((res: any) => {
      setDevices((res.data || []).filter((d: any) => d.isActive));
    }).catch(() => {});
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cargar billing status cuando se entra al tab de cobros ──
  useEffect(() => {
    if (tab !== 'cobros' || !tenantId || !canManage) return;
    if (isSuperAdmin) {
      saasApi.config().then((res: any) => {
        const c = res.data || {};
        setSaasCfg({ ...DEFAULT_SAAS_CFG, ...c });
      }).catch(() => {});
    }
    setLoadingBilling(true);
    saasApi.status().then((res: any) => {
      setBilling(res.data);
    }).catch(() => {}).finally(() => setLoadingBilling(false));
  }, [tab, tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detectar redirect de MercadoPago al cargar la página ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const mpStatus = params.get('mp_status');
    const mpRef    = params.get('mp_ref');
    const tabParam = params.get('tab') as ConfigTab | null;

    if (tabParam && TABS.some(t => t.key === tabParam)) {
      setTab(tabParam);
    }

    if (mpStatus === 'approved' && mpRef) {
      setTab('cobros');
      setMpMsg('Verificando pago con MercadoPago...');
      saasApi.verify(mpRef).then((res: any) => {
        if (res.data?.verified) {
          setMpMsg('✅ Pago confirmado correctamente');
          saasApi.status().then((r: any) => setBilling(r.data)).catch(() => {});
        } else {
          setMpMsg('Pago recibido, en proceso de confirmación');
        }
      }).catch(() => {
        setMpMsg('Pago recibido. Será confirmado en breve.');
      });
      window.history.replaceState({}, '', '/configuracion?tab=cobros');
    } else if (mpStatus === 'failure') {
      setTab('cobros');
      setMpErr('El pago no fue completado. Puedes intentarlo nuevamente.');
      window.history.replaceState({}, '', '/configuracion?tab=cobros');
    } else if (mpStatus === 'pending') {
      setTab('cobros');
      setMpMsg('Pago en proceso. Te notificaremos cuando se confirme.');
      window.history.replaceState({}, '', '/configuracion?tab=cobros');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loadIntegrations() {
    configApi.listIntegrations().then((res: any) => {
      setIntegrations(res.data || []);
    }).catch(() => {});
  }

  // ── Handlers cuenta ──
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

  // ── Handlers fraccionamiento ──
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

  // ── Handlers cobros ──
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

  const handleSaveDelinquentPolicy = async () => {
    setSavingDelinquent(true); setDelinquentMsg(''); setDelinquentErr('');
    try {
      await configApi.updateTenant({ delinquentPolicy });
      setDelinquentMsg('Política guardada');
      setTimeout(() => setDelinquentMsg(''), 3000);
    } catch (err) {
      setDelinquentErr(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingDelinquent(false);
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

  // ── Handlers SaaS ──
  const handleSaveSaasConfig = async () => {
    setSavingSaas(true); setSaasCfgMsg(''); setSaasCfgErr('');
    try {
      await saasApi.updateConfig(saasCfg);
      setSaasCfgMsg('Configuración guardada');
      setTimeout(() => setSaasCfgMsg(''), 3000);
      saasApi.status().then((res: any) => setBilling(res.data)).catch(() => {});
    } catch (err) {
      setSaasCfgErr(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingSaas(false);
    }
  };

  const handlePagarMP = async () => {
    setMpLoading(true); setMpErr(''); setMpMsg('');
    try {
      const res: any = await saasApi.createPreference();
      window.location.href = res.data.initPoint;
    } catch (err) {
      setMpErr(err instanceof Error ? err.message : 'Error al iniciar pago');
      setMpLoading(false);
    }
  };

  // ── Handlers emergencias ──
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

  function addEmergencyNumber() { setEmergencyNums((n) => [...n, { ...EMPTY_EMERGENCY }]); }
  function updateEmergencyNumber(idx: number, field: keyof EmergencyNumber, value: string) {
    setEmergencyNums((n) => { const arr = [...n]; arr[idx] = { ...arr[idx], [field]: value }; return arr; });
  }
  function removeEmergencyNumber(idx: number) {
    setEmergencyNums((n) => n.filter((_, i) => i !== idx));
  }

  // ── Handlers Service QR ──
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

  // ── Handlers integraciones ──
  function openCreateModal() { setEditingInt(null); setShowIntModal(true); }
  function openEditModal(int: Integration) { setEditingInt(int); setShowIntModal(true); }

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm('¿Eliminar esta integración?')) return;
    await configApi.deleteIntegration(id).catch(() => {});
    loadIntegrations();
  };

  const handleTestIntegration = async (id: string) => {
    setTestingId(id);
    try { await configApi.testIntegration(id); }
    catch { /* ignored */ }
    finally { setTestingId(null); loadIntegrations(); }
  };

  // ── Render ─────────────────────────────────────────────────────
  const statusLabels: Record<string, { label: string; cls: string }> = {
    PAID:    { label: 'Pagado',   cls: 'bg-green-100 text-green-700' },
    PENDING: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
    OVERDUE: { label: 'Vencido',  cls: 'bg-red-100 text-red-700' },
  };

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Preferencias de cuenta y sistema" />

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 bg-white/50 p-1 rounded-xl flex-wrap">
        {TABS.filter(t => !t.superAdminOnly || isSuperAdmin).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════
          TAB: CUENTA
         ══════════════════════════════════ */}
      {tab === 'cuenta' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Info de cuenta */}
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

          {/* Selector de tenant — SuperAdmin */}
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

          {/* Selector de tenant — Admin multi-tenant */}
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

          {/* Cambiar contraseña */}
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
        </div>
      )}

      {/* ══════════════════════════════════
          TAB: FRACCIONAMIENTO
         ══════════════════════════════════ */}
      {tab === 'fraccionamiento' && canManage && (
        <div className="space-y-6">

          {/* Datos del fraccionamiento */}
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

          {/* Feature flags */}
          <div className="glass-card">
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
                    <Toggle value={flags.showResidentAccessButton} onChange={() => setFlags({ ...flags, showResidentAccessButton: !flags.showResidentAccessButton })} />
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
                    <Toggle value={flags.showVisitorAccessButton} onChange={() => setFlags({ ...flags, showVisitorAccessButton: !flags.showVisitorAccessButton })} />
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

                {/* Salida */}
                <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                  <span className="text-sm text-slate-700">Mostrar botón de salida</span>
                  <Toggle value={flags.showExitButton} onChange={() => setFlags({ ...flags, showExitButton: !flags.showExitButton })} />
                </label>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">QR Rápido</h4>
                <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                  <span className="text-sm text-slate-700">Habilitar QR rápido (Uber, Delivery…)</span>
                  <Toggle value={flags.quickQrEnabled} onChange={() => setFlags({ ...flags, quickQrEnabled: !flags.quickQrEnabled })} />
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
        </div>
      )}

      {/* ══════════════════════════════════
          TAB: COBROS
         ══════════════════════════════════ */}
      {tab === 'cobros' && canManage && (
        <div className="space-y-6">

          {/* ── Gestión de cobro (cuotas de mantenimiento) ── */}
          <div className="glass-card">
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
                    <p className="text-sm">No hay cuentas bancarias configuradas.</p>
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

          {/* ── Cobro por Uso (SaaS) ── */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-slate-700">Cobro por Uso</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Facturación mensual del servicio iaDoS — {billing?.activeUnits ?? '…'} unidades activas
                </p>
              </div>
              {isSuperAdmin && (
                <button onClick={handleSaveSaasConfig} disabled={savingSaas} className="btn-primary text-sm disabled:opacity-60">
                  {savingSaas ? 'Guardando...' : 'Guardar config'}
                </button>
              )}
            </div>

            {saasCfgMsg && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl mb-4">{saasCfgMsg}</div>}
            {saasCfgErr && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-4">{saasCfgErr}</div>}
            {mpMsg      && <div className="bg-blue-50 text-blue-700 text-sm px-4 py-2 rounded-xl mb-4">{mpMsg}</div>}
            {mpErr      && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-4">{mpErr}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Columna izquierda — Configuración (solo SuperAdmin) */}
              {isSuperAdmin && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Configuración (SuperAdmin)</h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Precio por unidad (MXN)</label>
                      <input type="number" min={0} step={0.01} className="input-field"
                        value={saasCfg.pricePerUnit || ''}
                        onChange={(e) => setSaasCfg({ ...saasCfg, pricePerUnit: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Día de facturación</label>
                      <input type="number" min={1} max={28} className="input-field"
                        value={saasCfg.billingDay || ''}
                        onChange={(e) => setSaasCfg({ ...saasCfg, billingDay: parseInt(e.target.value) || 1 })} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Días de gracia</label>
                    <input type="number" min={0} max={30} className="input-field"
                      value={saasCfg.gracePeriodDays ?? ''}
                      onChange={(e) => setSaasCfg({ ...saasCfg, gracePeriodDays: parseInt(e.target.value) || 0 })} />
                    <p className="text-xs text-slate-400 mt-1">Días adicionales después del día de facturación antes de marcar como vencido</p>
                  </div>

                  <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                    <div>
                      <p className="text-sm text-slate-700">Notificar si hay retraso en el pago</p>
                      <p className="text-xs text-slate-400">Enviar notificación FCM al administrador</p>
                    </div>
                    <Toggle value={saasCfg.notifyOnOverdue} onChange={() => setSaasCfg({ ...saasCfg, notifyOnOverdue: !saasCfg.notifyOnOverdue })} />
                  </label>

                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">MercadoPago</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Access Token</label>
                        <input type="password" className="input-field font-mono text-sm" placeholder="APP_USR-..."
                          value={saasCfg.mpAccessToken}
                          onChange={(e) => setSaasCfg({ ...saasCfg, mpAccessToken: e.target.value })} />
                        <p className="text-xs text-slate-400 mt-1">Token privado — nunca se muestra al admin</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Public Key</label>
                        <input type="text" className="input-field font-mono text-sm" placeholder="APP_USR-..."
                          value={saasCfg.mpPublicKey}
                          onChange={(e) => setSaasCfg({ ...saasCfg, mpPublicKey: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Columna derecha — Estado de facturación */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Estado de facturación</h4>

                {loadingBilling ? (
                  <div className="text-center py-8 text-slate-400">
                    <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-primary-500 rounded-full mx-auto mb-2" />
                    <p className="text-sm">Cargando...</p>
                  </div>
                ) : billing ? (
                  <>
                    {/* Resumen del período */}
                    <div className={`rounded-xl p-4 border ${billing.isOverdue ? 'bg-red-50 border-red-200' : billing.currentPayment?.status === 'PAID' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Período actual</p>
                          <p className="text-2xl font-bold text-slate-800">{billing.period}</p>
                        </div>
                        {billing.currentPayment ? (
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusLabels[billing.currentPayment.status]?.cls || 'bg-slate-100 text-slate-600'}`}>
                            {statusLabels[billing.currentPayment.status]?.label || billing.currentPayment.status}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700">Sin registrar</span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-white/70 rounded-lg p-2">
                          <p className="text-xs text-slate-500">Unidades activas</p>
                          <p className="text-lg font-bold text-slate-800">{billing.activeUnits}</p>
                        </div>
                        <div className="bg-white/70 rounded-lg p-2">
                          <p className="text-xs text-slate-500">Precio/unidad</p>
                          <p className="text-lg font-bold text-slate-800">${billing.pricePerUnit.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/70 rounded-lg p-2">
                          <p className="text-xs text-slate-500">Total</p>
                          <p className="text-lg font-bold text-primary-700">${billing.totalAmount.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-slate-500 flex justify-between">
                        <span>Vence: {new Date(billing.dueDate).toLocaleDateString('es-MX')}</span>
                        <span>Gracia hasta: {new Date(billing.graceDue).toLocaleDateString('es-MX')}</span>
                      </div>
                    </div>

                    {/* Botón de pago */}
                    {billing.currentPayment?.status !== 'PAID' && (
                      <div>
                        {billing.configured ? (
                          <button
                            onClick={handlePagarMP}
                            disabled={mpLoading}
                            className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-60"
                            style={{ background: mpLoading ? '#94a3b8' : 'linear-gradient(135deg, #009ee3, #0071a5)' }}
                          >
                            {mpLoading ? 'Iniciando pago...' : `Pagar $${billing.totalAmount.toLocaleString()} MXN con MercadoPago`}
                          </button>
                        ) : (
                          <div className="text-center py-4 text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                            {isSuperAdmin
                              ? 'Configura el precio y las credenciales de MercadoPago para habilitar el cobro'
                              : 'El sistema de cobro aún no está configurado. Contacta a soporte.'}
                          </div>
                        )}
                      </div>
                    )}

                    {billing.currentPayment?.status === 'PAID' && (
                      <div className="text-center py-3 bg-green-50 border border-green-200 rounded-xl">
                        <p className="text-sm font-medium text-green-700">✓ Pago del período actual confirmado</p>
                        {billing.currentPayment.paidAt && (
                          <p className="text-xs text-green-600 mt-0.5">
                            {new Date(billing.currentPayment.paidAt).toLocaleDateString('es-MX', { dateStyle: 'long' })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Historial */}
                    {billing.history.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Historial</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {billing.history.map((p: any) => {
                            const st = statusLabels[p.status] || { label: p.status, cls: 'bg-slate-100 text-slate-600' };
                            return (
                              <div key={p.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-white/60 border border-slate-100">
                                <div>
                                  <span className="font-medium text-slate-700">{p.period}</span>
                                  <span className="text-slate-400 text-xs ml-2">{p.activeUnits} unidades</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-slate-800">${parseFloat(p.totalAmount).toLocaleString()}</span>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-sm">No se pudo cargar el estado de facturación</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Política de morosos ── */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-slate-700">Política de morosos</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Define qué acciones se restringen a residentes con adeudo pendiente
                </p>
              </div>
              <button onClick={handleSaveDelinquentPolicy} disabled={savingDelinquent}
                className="btn-primary text-sm disabled:opacity-60">
                {savingDelinquent ? 'Guardando...' : 'Guardar'}
              </button>
            </div>

            {delinquentMsg && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-xl mb-4">{delinquentMsg}</div>}
            {delinquentErr && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-4">{delinquentErr}</div>}

            <div className="space-y-4">
              {/* Restricciones de acceso */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Restricciones de acceso</p>
                <div className="space-y-3">
                  {([
                    { key: 'blockAppAccess',    label: 'Bloquear apertura de portón por app',
                      desc: 'El residente no puede abrir el portón desde la aplicación' },
                    { key: 'blockQrAccess',     label: 'Bloquear acceso de visitas por QR',
                      desc: 'Los QR generados por la unidad dejan de funcionar en entrada' },
                    { key: 'blockQrGeneration', label: 'Bloquear generación de nuevos QR',
                      desc: 'El residente no puede crear nuevos códigos QR mientras tenga adeudo' },
                  ] as { key: keyof typeof DEFAULT_DELINQUENT_POLICY; label: string; desc: string }[]).map(item => (
                    <label key={item.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-slate-700">{item.label}</p>
                        <p className="text-xs text-slate-400">{item.desc}</p>
                      </div>
                      <Toggle
                        value={delinquentPolicy[item.key]}
                        onChange={() => setDelinquentPolicy(p => ({ ...p, [item.key]: !p[item.key] }))}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Notificaciones */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Notificaciones al denegar</p>
                <div className="space-y-3">
                  {([
                    { key: 'notifyResident', label: 'Notificar al residente',
                      desc: 'Envía push al residente cuando se le deniega el acceso' },
                    { key: 'notifyAdmin',    label: 'Notificar al administrador',
                      desc: 'Envía push al ADMIN cuando un moroso intenta acceder' },
                  ] as { key: keyof typeof DEFAULT_DELINQUENT_POLICY; label: string; desc: string }[]).map(item => (
                    <label key={item.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-slate-700">{item.label}</p>
                        <p className="text-xs text-slate-400">{item.desc}</p>
                      </div>
                      <Toggle
                        value={delinquentPolicy[item.key]}
                        onChange={() => setDelinquentPolicy(p => ({ ...p, [item.key]: !p[item.key] }))}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs text-amber-700">
                  <strong>Siempre permitido:</strong> La salida del fraccionamiento nunca se bloquea (seguridad). El guardia siempre puede hacer apertura manual.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          TAB: EMERGENCIAS
         ══════════════════════════════════ */}
      {tab === 'emergencias' && canManage && (
        <div className="glass-card">
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
                <p className="text-sm">No hay números configurados.</p>
              </div>
            )}
            <button onClick={addEmergencyNumber} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              + Agregar número
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          TAB: SERVICIOS QR
         ══════════════════════════════════ */}
      {tab === 'servicios' && canManage && (
        <div className="glass-card">
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
            <Toggle value={svcQrCfg.enabled} onChange={() => setSvcQrCfg(c => ({ ...c, enabled: !c.enabled }))} />
          </label>

          {svcQrCfg.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna izquierda */}
              <div className="space-y-4">
                {/* Catálogo de servicios */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Servicios disponibles</h4>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {svcQrCfg.services.map((svc, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        {svc}
                        <button onClick={() => removeService(idx)} className="text-slate-400 hover:text-red-500 ml-1 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" className="input-field text-sm flex-1" placeholder="Nuevo servicio…"
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addService())} />
                    <button onClick={addService} className="btn-secondary text-sm px-4">Agregar</button>
                  </div>
                </div>

                {/* Dispositivos */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dispositivo de entrada</label>
                    <select className="input-field text-sm" value={svcQrCfg.deviceId}
                      onChange={(e) => setSvcQrCfg(c => ({ ...c, deviceId: e.target.value }))}>
                      <option value="">— Sin dispositivo —</option>
                      {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dispositivo de salida</label>
                    <select className="input-field text-sm" value={svcQrCfg.exitDeviceId}
                      onChange={(e) => setSvcQrCfg(c => ({ ...c, exitDeviceId: e.target.value }))}>
                      <option value="">— Sin dispositivo —</option>
                      {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* TTL + Rotación */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">TTL solicitud (min)</label>
                    <input type="number" min={1} max={120} className="input-field text-sm"
                      value={svcQrCfg.requestTtlMinutes}
                      onChange={(e) => setSvcQrCfg(c => ({ ...c, requestTtlMinutes: parseInt(e.target.value) || 15 }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">QR salida válido (h)</label>
                    <input type="number" min={1} max={24} className="input-field text-sm"
                      value={svcQrCfg.exitQrValidHours}
                      onChange={(e) => setSvcQrCfg(c => ({ ...c, exitQrValidHours: parseInt(e.target.value) || 4 }))} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rotación del QR (días) — 0 = permanente
                  </label>
                  <input type="number" min={0} max={365} className="input-field text-sm"
                    value={svcQrCfg.rotateDays}
                    onChange={(e) => setSvcQrCfg(c => ({ ...c, rotateDays: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>

              {/* Columna derecha */}
              <div className="space-y-4">
                {/* Permisos */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Aprobadores</h4>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                      <div>
                        <p className="text-sm text-slate-700">Guardia puede aprobar</p>
                        <p className="text-xs text-slate-400">Si desactivado, solo recibe la notificación</p>
                      </div>
                      <Toggle value={svcQrCfg.guardCanApprove} onChange={() => setSvcQrCfg(c => ({ ...c, guardCanApprove: !c.guardCanApprove }))} />
                    </label>
                    <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                      <div>
                        <p className="text-sm text-slate-700">Admin puede aprobar</p>
                        <p className="text-xs text-slate-400">Si desactivado, solo recibe la notificación</p>
                      </div>
                      <Toggle value={svcQrCfg.adminCanApprove} onChange={() => setSvcQrCfg(c => ({ ...c, adminCanApprove: !c.adminCanApprove }))} />
                    </label>
                  </div>
                </div>

                {/* Mostrar teléfono */}
                <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                  <div>
                    <p className="text-sm text-slate-700">Mostrar teléfono del residente</p>
                    <p className="text-xs text-slate-400">El visitante verá el teléfono al seleccionar la residencia</p>
                  </div>
                  <Toggle value={svcQrCfg.showResidentPhone} onChange={() => setSvcQrCfg(c => ({ ...c, showResidentPhone: !c.showResidentPhone }))} />
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
                      <Toggle value={svcQrCfg.requireUnit} onChange={() => setSvcQrCfg(c => ({ ...c, requireUnit: !c.requireUnit }))} />
                    </label>
                    <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                      <div>
                        <p className="text-sm text-slate-700">Foto obligatoria</p>
                        <p className="text-xs text-slate-400">El visitante debe tomar foto de credencial o vehículo</p>
                      </div>
                      <Toggle value={svcQrCfg.requirePhoto} onChange={() => setSvcQrCfg(c => ({ ...c, requirePhoto: !c.requirePhoto }))} />
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

      {/* ══════════════════════════════════
          TAB: INTEGRACIONES
         ══════════════════════════════════ */}
      {tab === 'integraciones' && canManage && (
        <div className="glass-card">
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

      {/* ══════════════════════════════════
          TAB: MANTENIMIENTO (SuperAdmin)
         ══════════════════════════════════ */}
      {tab === 'mantenimiento' && isSuperAdmin && (
        <MantenimientoTab allTenants={allTenants} />
      )}

      {/* ── Modales ── */}
      {showQrPoster && svcQrUrl && (
        <QrPosterModal
          url={svcQrUrl}
          tenantName={tenantForm.name}
          services={svcQrCfg.services}
          onClose={() => setShowQrPoster(false)}
        />
      )}

      <IntegrationModal
        isOpen={showIntModal}
        editingInt={editingInt}
        onClose={() => setShowIntModal(false)}
        onSaved={loadIntegrations}
      />
    </div>
  );
}
