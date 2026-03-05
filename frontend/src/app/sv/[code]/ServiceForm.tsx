'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

interface Unit {
  id: string;
  identifier: string;
  block: string | null;
  phone?: string | null;
  ownerFirstName?: string | null;
}

export interface PublicInfo {
  tenantId: string;
  tenantName: string;
  qrId: string;
  services: string[];
  showResidentPhone: boolean;
  requireUnit: boolean;
  requirePhoto: boolean;
  units: Unit[];
}

const SERVICE_ICONS: Record<string, string> = {
  CFE: '⚡', Gas: '🔥', Agua: '💧', Basura: '🗑️',
  Paquetería: '📦', Mensajería: '📬', Domicilio: '🛵',
  Técnico: '🔧', Jardinería: '🌿', Limpieza: '🧹', Otro: '🔔',
};

async function compressImage(file: File, maxPx = 900, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

interface StatusData {
  status: RequestStatus;
  expiresAt: string;
  exitQrCode?: string | null;
  exitQrExpiresAt?: string | null;
}

export default function ServiceForm({ info }: { info: PublicInfo }) {
  const [selectedService, setSelectedService] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [visitorPhone, setVisitorPhone] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Post-submit state
  const [requestId, setRequestId] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exitQrCanvasRef = useRef<HTMLCanvasElement>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/sv/status/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) return;
      const data: StatusData = json.data;
      setStatusData(data);
      // Stop polling on terminal state
      if (data.status !== 'PENDING') {
        stopPolling();
      }
      // Also stop if expired (grace period 30s para evitar falsos positivos)
      if (data.expiresAt && new Date(data.expiresAt) < new Date(Date.now() - 30000)) {
        setStatusData(d => d ? { ...d, status: 'EXPIRED' } : d);
        stopPolling();
      }
    } catch {
      // ignore network errors, keep polling
    }
  }, [stopPolling]);

  useEffect(() => {
    if (!requestId || !statusData?.expiresAt) return;
    // Poll immediately then every 5 seconds
    pollStatus(requestId);
    pollingRef.current = setInterval(() => pollStatus(requestId), 5000);
    // Countdown timer
    const expiry = new Date(statusData.expiresAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => stopPolling();
  }, [requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await compressImage(file);
      setPhotoBase64(b64);
      setPhotoPreview(b64);
    } catch {
      alert('Error al procesar la imagen');
    }
  }

  async function handleSubmit() {
    if (!selectedService) return;
    if (info.requireUnit && !selectedUnit) { setError('La residencia es obligatoria'); return; }
    if (info.requirePhoto && !photoBase64) { setError('La foto es obligatoria'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/sv/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: info.tenantId,
          qrId: info.qrId,
          service: selectedService,
          unitId: selectedUnit?.id || null,
          photoData: photoBase64 || null,
          visitorPhone: visitorPhone.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setRequestId(json.data.id);
        setStatusData({ status: 'PENDING', expiresAt: json.data.expiresAt });
      } else {
        setError(json.message || 'Error al enviar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Pantalla: Esperando respuesta (PENDING) ──────────────────────────────────
  if (requestId && statusData?.status === 'PENDING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
            <span className="text-4xl animate-pulse">🔔</span>
          </div>
          <h2 className="text-slate-800 font-bold text-2xl mb-2">Solicitud enviada</h2>
          <p className="text-slate-500 text-sm mb-5">
            El residente fue notificado. Esperando respuesta…
          </p>
          <div className="bg-slate-50 rounded-2xl px-4 py-3 text-left space-y-1 mb-4">
            <div className="flex items-center gap-2">
              <span>{SERVICE_ICONS[selectedService] || '🔔'}</span>
              <span className="text-slate-700 font-medium text-sm">{selectedService}</span>
            </div>
            {selectedUnit && (
              <div className="flex items-center gap-2">
                <span>🏠</span>
                <span className="text-slate-600 text-sm">
                  Unidad {selectedUnit.identifier}{selectedUnit.block ? ` – Manzana ${selectedUnit.block}` : ''}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          {secondsLeft !== null && (
            <p className="text-slate-400 text-xs mt-2">
              Expira en: <span className={`font-semibold ${secondsLeft < 120 ? 'text-red-400' : 'text-slate-500'}`}>
                {secondsLeft >= 60
                  ? `${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s`
                  : `${secondsLeft}s`}
              </span>
            </p>
          )}
          <p className="text-slate-400 text-xs mt-1">Si no hay respuesta, comunícate con el guardia.</p>
          <div className="mt-5 flex items-center justify-center gap-2 opacity-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo3_ia2.png" alt="iaDoS" className="h-5 w-auto" />
            <span className="text-xs text-slate-500">Acceso Digital · <a href="https://iados.mx" target="_blank" rel="noopener noreferrer" className="text-emerald-500 font-medium hover:underline">iaDoS.mx</a></span>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla: Acceso Autorizado (APPROVED) ───────────────────────────────────
  if (statusData?.status === 'APPROVED') {
    const hasExitQr = !!statusData.exitQrCode;
    const exitExpires = statusData.exitQrExpiresAt
      ? new Date(statusData.exitQrExpiresAt).toLocaleString('es-MX', {
          hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short',
        })
      : null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 text-center">
              <p className="text-4xl mb-1">✅</p>
              <h2 className="text-white font-bold text-xl">Acceso autorizado</h2>
              <p className="text-white/80 text-sm">Puedes ingresar al fraccionamiento</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">{SERVICE_ICONS[selectedService] || '🔔'}</span>
                <div>
                  <p className="text-emerald-700 font-semibold text-sm">{selectedService}</p>
                  {selectedUnit && (
                    <p className="text-emerald-600 text-xs">
                      Unidad {selectedUnit.identifier}
                      {selectedUnit.block ? ` – Manzana ${selectedUnit.block}` : ''}
                    </p>
                  )}
                </div>
              </div>

              {hasExitQr && (
                <div className="border border-slate-200 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-3">
                    QR de salida
                  </p>
                  <div className="flex justify-center mb-2">
                    <div className="bg-white p-2 rounded-xl border-2 border-slate-100 shadow-inner">
                      <QRCodeSVG value={statusData.exitQrCode!} size={160} level="M" />
                    </div>
                  </div>
                  {/* Canvas oculto para descarga en alta resolución */}
                  <QRCodeCanvas ref={exitQrCanvasRef} value={statusData.exitQrCode!} size={400} level="M" style={{ display: 'none' }} />
                  <p className="font-mono text-xs text-slate-400 text-center tracking-widest mb-1">
                    {statusData.exitQrCode}
                  </p>
                  {exitExpires && (
                    <p className="text-xs text-slate-400 text-center">
                      Válido hasta {exitExpires}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      const canvas = exitQrCanvasRef.current;
                      if (!canvas) return;
                      const link = document.createElement('a');
                      link.download = `QR-salida-${statusData.exitQrCode}.png`;
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                    }}
                    className="mt-3 w-full py-2.5 rounded-xl font-semibold text-sm text-white bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    ⬇ Descargar QR como imagen
                  </button>
                  <div className="mt-2 bg-amber-50 rounded-xl px-3 py-2 text-center">
                    <p className="text-amber-700 text-xs">
                      Presenta este QR al salir — uso único
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo3_ia2.png" alt="iaDoS" className="h-4 w-auto opacity-50" />
              <span className="text-xs text-slate-400">Acceso Digital · <a href="https://iados.mx" target="_blank" rel="noopener noreferrer" className="text-emerald-500 font-medium hover:underline">iaDoS.mx</a></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla: Acceso Denegado (REJECTED) ─────────────────────────────────────
  if (statusData?.status === 'REJECTED') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-red-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full">
          <p className="text-6xl mb-4">⛔</p>
          <h2 className="text-slate-800 font-bold text-2xl mb-2">Acceso denegado</h2>
          <p className="text-slate-500 text-sm">Tu solicitud fue rechazada. Comunícate con el guardia si crees que es un error.</p>
          <div className="mt-5 flex items-center justify-center gap-2 opacity-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo3_ia2.png" alt="iaDoS" className="h-5 w-auto" />
            <span className="text-xs text-slate-500">Acceso Digital · <a href="https://iados.mx" target="_blank" rel="noopener noreferrer" className="text-emerald-500 font-medium hover:underline">iaDoS.mx</a></span>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla: Solicitud Expirada (EXPIRED) ────────────────────────────────────
  if (statusData?.status === 'EXPIRED') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full">
          <p className="text-6xl mb-4">⏰</p>
          <h2 className="text-slate-800 font-bold text-2xl mb-2">Solicitud expirada</h2>
          <p className="text-slate-500 text-sm mb-5">El tiempo de espera se agotó. Puedes enviar una nueva solicitud.</p>
          <button
            onClick={() => {
              stopPolling();
              setRequestId(null);
              setStatusData(null);
              setSecondsLeft(null);
              setSelectedService('');
              setSelectedUnit(null);
              setVisitorPhone('');
              setPhotoBase64(null);
              setPhotoPreview(null);
              setError('');
            }}
            className="w-full py-3 rounded-2xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors mb-4"
          >
            Nueva solicitud
          </button>
          <div className="flex items-center justify-center gap-2 opacity-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo3_ia2.png" alt="iaDoS" className="h-5 w-auto" />
            <span className="text-xs text-slate-500">Acceso Digital · <a href="https://iados.mx" target="_blank" rel="noopener noreferrer" className="text-emerald-500 font-medium hover:underline">iaDoS.mx</a></span>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5">
            <p className="text-white/80 text-xs font-medium uppercase tracking-wider mb-0.5">{info.tenantName}</p>
            <h1 className="text-white font-bold text-xl">Solicitud de acceso</h1>
          </div>

          <div className="p-5 space-y-5">

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl">{error}</div>
            )}

            {/* 1 — Servicio */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                1. ¿Qué servicio eres?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {info.services.map(svc => (
                  <button key={svc} onClick={() => setSelectedService(svc)}
                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border-2 text-center transition-all ${
                      selectedService === svc
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}>
                    <span className="text-2xl">{SERVICE_ICONS[svc] || '🔔'}</span>
                    <span className={`text-xs font-medium leading-tight ${selectedService === svc ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {svc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2 — Residencia */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                2. ¿A qué residencia vas?{' '}
                {info.requireUnit
                  ? <span className="font-normal text-red-400">*obligatorio</span>
                  : <span className="font-normal text-slate-400">(opcional)</span>}
              </p>
              <select value={selectedUnit?.id || ''}
                onChange={e => setSelectedUnit(info.units.find(u => u.id === e.target.value) || null)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">— Seleccionar residencia —</option>
                {info.units.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.identifier}{u.ownerFirstName ? ` — ${u.ownerFirstName}` : ''}
                    {info.showResidentPhone && u.phone ? ` · ${u.phone}` : ''}
                  </option>
                ))}
              </select>
              {info.showResidentPhone && selectedUnit?.phone && (
                <p className="mt-1.5 text-xs text-emerald-600 font-medium">📞 {selectedUnit.phone}</p>
              )}
            </div>

            {/* 3 — Teléfono */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                3. Tu teléfono <span className="font-normal text-slate-400">(opcional)</span>
              </p>
              <input type="tel" placeholder="Ej: 5551234567" value={visitorPhone}
                onChange={e => setVisitorPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            {/* 4 — Foto */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                4. Foto{' '}
                {info.requirePhoto
                  ? <span className="font-normal text-red-400">*obligatorio</span>
                  : <span className="font-normal text-slate-400">(credencial, vehículo…)</span>}
              </p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={handlePhotoChange} />
              {photoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Vista previa"
                    className="w-full h-36 object-cover rounded-2xl border border-slate-200" />
                  <button onClick={() => { setPhotoBase64(null); setPhotoPreview(null); }}
                    className="absolute top-2 right-2 bg-white/80 rounded-full w-7 h-7 flex items-center justify-center text-slate-600 text-sm font-bold shadow">
                    ✕
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-300 rounded-2xl py-5 flex flex-col items-center gap-2 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors">
                  <span className="text-3xl">📷</span>
                  <span className="text-xs font-medium">Tomar foto o seleccionar imagen</span>
                </button>
              )}
            </div>

            {/* Enviar */}
            <button disabled={!selectedService || submitting} onClick={handleSubmit}
              className={`w-full py-3.5 rounded-2xl font-semibold text-white transition-all ${
                selectedService && !submitting
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-200'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}>
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando…
                </span>
              ) : 'Solicitar acceso'}
            </button>

          </div>

          <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo3_ia2.png" alt="iaDoS" className="h-4 w-auto opacity-50" />
            <span className="text-xs text-slate-400">Acceso Digital · <a href="https://iados.mx" target="_blank" rel="noopener noreferrer" className="text-emerald-500 font-medium hover:underline">iaDoS.mx</a></span>
          </div>
        </div>
      </div>
    </div>
  );
}
