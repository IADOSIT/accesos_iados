'use client';

import { useRef, useState } from 'react';

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

export default function ServiceForm({ info }: { info: PublicInfo }) {
  const [selectedService, setSelectedService] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [visitorPhone, setVisitorPhone] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
        setSuccess(true);
      } else {
        setError(json.message || 'Error al enviar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full">
          <p className="text-6xl mb-4">✅</p>
          <h2 className="text-slate-800 font-bold text-2xl mb-2">Solicitud enviada</h2>
          <p className="text-slate-500 text-sm mb-4">El residente fue notificado. En breve recibirás acceso.</p>
          <div className="bg-emerald-50 rounded-2xl px-4 py-3 text-left space-y-1">
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
          <p className="text-slate-400 text-xs mt-4">Si no hay respuesta, comunícate con el guardia.</p>
          <div className="mt-6 flex items-center justify-center gap-2 opacity-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo3_ia2.png" alt="iaDoS" className="h-5 w-auto" />
            <span className="text-xs text-slate-500">Acceso Digital · iaDoS</span>
          </div>
        </div>
      </div>
    );
  }

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
            <span className="text-xs text-slate-400">Acceso Digital · iaDoS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
