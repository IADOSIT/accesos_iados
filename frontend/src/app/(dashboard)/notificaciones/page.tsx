'use client';

import { useState, useEffect, useCallback } from 'react';
import { notificationsApi, usersApi, unitsApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';
import {
  BellIcon,
  PaperAirplaneIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

// ── Tipos ──────────────────────────────────────────────────────
interface NotifConfig {
  ACCESS_DENIED?: boolean;
  QR_USED?: boolean;
  NEW_CHARGE?: boolean;
  PAYMENT_CONFIRMED?: boolean;
  DEVICE_OFFLINE?: boolean;
}

interface NotifHistory {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  user?: { firstName?: string; lastName?: string; email?: string };
}

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface Unit {
  id: string;
  number: string;
  block?: string;
}

const EVENT_LABELS: Record<string, { label: string; desc: string }> = {
  ACCESS_DENIED:     { label: 'Acceso denegado (moroso)', desc: 'Residente + Guardia' },
  QR_USED:           { label: 'QR de visita usado',       desc: 'Residente' },
  NEW_CHARGE:        { label: 'Nuevo cargo registrado',   desc: 'Residente' },
  PAYMENT_CONFIRMED: { label: 'Pago confirmado',          desc: 'Residente' },
  DEVICE_OFFLINE:    { label: 'Dispositivo desconectado', desc: 'Admin + Guardia' },
};

const TYPE_LABELS: Record<string, string> = {
  ACCESS_DENIED: 'Acceso denegado',
  QR_USED: 'QR usado',
  NEW_CHARGE: 'Nuevo cargo',
  PAYMENT_CONFIRMED: 'Pago confirmado',
  DEVICE_OFFLINE: 'Dispositivo offline',
  MANUAL: 'Manual',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Sección 1: Config de alertas ──────────────────────────────
function ConfigSection() {
  const [config, setConfig] = useState<NotifConfig>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (notificationsApi.getConfig() as Promise<{ data: NotifConfig }>)
      .then((r) => setConfig(r.data ?? {}))
      .catch(() => {});
  }, []);

  const toggle = async (key: keyof NotifConfig) => {
    const next = { ...config, [key]: !config[key] };
    setConfig(next);
    setSaving(true);
    try {
      await notificationsApi.updateConfig(next);
      setMsg('Guardado');
      setTimeout(() => setMsg(''), 2000);
    } catch {
      setMsg('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <BellIcon className="w-5 h-5 text-emerald-600" />
        <h2 className="text-base font-semibold text-slate-800">Configuración de alertas</h2>
        {msg && <span className="ml-auto text-xs text-emerald-600">{msg}</span>}
        {saving && <span className="ml-auto text-xs text-slate-400">Guardando…</span>}
      </div>
      <div className="divide-y divide-slate-100">
        {Object.entries(EVENT_LABELS).map(([key, { label, desc }]) => (
          <div key={key} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-700">{label}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
            <button
              onClick={() => toggle(key as keyof NotifConfig)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config[key as keyof NotifConfig] !== false ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  config[key as keyof NotifConfig] !== false ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sección 2: Envío manual ───────────────────────────────────
function BroadcastSection() {
  const [target, setTarget] = useState<'ALL' | 'ROLE' | 'USER' | 'UNIT'>('ALL');
  const [role, setRole] = useState('RESIDENT');
  const [userId, setUserId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (target === 'USER') {
      (usersApi.list() as Promise<{ data: { data: User[] } }>)
        .then((r) => setUsers(r.data?.data ?? []))
        .catch(() => {});
    }
    if (target === 'UNIT') {
      (unitsApi.list() as Promise<{ data: { data: Unit[] } }>)
        .then((r) => setUnits(r.data?.data ?? []))
        .catch(() => {});
    }
  }, [target]);

  const send = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setMsg('');
    try {
      await notificationsApi.broadcast({ target, role, userId, unitId, title, body });
      setMsg('Notificación enviada');
      setTitle('');
      setBody('');
    } catch {
      setMsg('Error al enviar');
    } finally {
      setSending(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <PaperAirplaneIcon className="w-5 h-5 text-emerald-600" />
        <h2 className="text-base font-semibold text-slate-800">Enviar notificación manual</h2>
      </div>
      <div className="space-y-4">
        {/* Destinatario */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Destinatario</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as typeof target)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
          >
            <option value="ALL">Todos los residentes</option>
            <option value="ROLE">Por rol</option>
            <option value="USER">Residente específico</option>
            <option value="UNIT">Por unidad</option>
          </select>
        </div>

        {target === 'ROLE' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
            >
              <option value="RESIDENT">Residente</option>
              <option value="GUARD">Guardia</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
        )}

        {target === 'USER' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Usuario</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
            >
              <option value="">Seleccionar…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {target === 'UNIT' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Unidad</label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
            >
              <option value="">Seleccionar…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.block ? `${u.block}-` : ''}{u.number}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Aviso importante"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Mensaje</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Escribe el mensaje de la notificación…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={send}
            disabled={sending || !title.trim() || !body.trim()}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {sending ? 'Enviando…' : 'Enviar notificación'}
          </button>
          {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Sección 3: Historial ──────────────────────────────────────
function HistorySection() {
  const [history, setHistory] = useState<NotifHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    (notificationsApi.history('limit=50') as Promise<{ data: { data: NotifHistory[] } }>)
      .then((r) => setHistory(r.data?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <ClockIcon className="w-5 h-5 text-emerald-600" />
        <h2 className="text-base font-semibold text-slate-800">Historial de enviadas</h2>
        <button onClick={load} className="ml-auto text-xs text-emerald-600 hover:underline">
          Actualizar
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-slate-400">Sin notificaciones enviadas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 pr-4 font-medium">Fecha</th>
                <th className="pb-2 pr-4 font-medium">Tipo</th>
                <th className="pb-2 pr-4 font-medium">Título</th>
                <th className="pb-2 font-medium">Destinatario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map((n) => (
                <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap">{fmtDate(n.createdAt)}</td>
                  <td className="py-2.5 pr-4">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-700 max-w-[200px] truncate">{n.title}</td>
                  <td className="py-2.5 text-slate-500 text-xs">
                    {n.user
                      ? `${n.user.firstName ?? ''} ${n.user.lastName ?? ''}`.trim() || n.user.email
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function NotificacionesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificaciones"
        subtitle="Configura alertas automáticas y envía mensajes manuales a los usuarios"
      />
      <ConfigSection />
      <BroadcastSection />
      <HistorySection />
    </div>
  );
}
