import { QRCodeSVG } from 'qrcode.react';

interface QRData {
  id: string;
  code: string;
  visitorName?: string;
  category?: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
  unit?: { identifier: string };
}

const CATEGORY_ICONS: Record<string, string> = {
  'Uber/Didi': '🚗',
  'Delivery': '📦',
  'Servicio': '🔧',
  'Visita': '👤',
};

async function getQRData(code: string): Promise<{ data: QRData | null; error: string }> {
  const apiUrl = process.env.API_URL || 'http://localhost:3001/api';
  try {
    const res = await fetch(`${apiUrl}/access/qr/public/${code}`, { cache: 'no-store' });
    const json = await res.json();
    if (json.success) return { data: json.data, error: '' };
    return { data: null, error: json.message || 'Código no encontrado' };
  } catch {
    return { data: null, error: 'No se pudo cargar el código QR' };
  }
}

export default async function PublicQRPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { data: qr, error } = await getQRData(code);

  if (error || !qr) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 text-center max-w-sm w-full">
          <p className="text-5xl mb-4">❌</p>
          <h2 className="text-white font-bold text-xl mb-2">QR no disponible</h2>
          <p className="text-slate-300 text-sm">{error || 'Código inválido o expirado'}</p>
        </div>
      </div>
    );
  }

  const expired = new Date(qr.expiresAt) < new Date();
  const exhausted = qr.usedCount >= qr.maxUses;
  const invalid = expired || exhausted || !qr.isActive;
  const icon = qr.category ? (CATEGORY_ICONS[qr.category] || '🔑') : '🔑';

  const expiresDate = new Date(qr.expiresAt);
  const expiresStr = expiresDate.toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <>
      <title>{`Acceso QR — ${qr.visitorName || qr.code}`}</title>
      <meta name="description" content={`Código de acceso para ${qr.visitorName || 'visitante'}`} />

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-5 ${invalid ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{invalid ? '⛔' : icon}</span>
                <div>
                  <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Acceso digital</p>
                  <h1 className="text-white font-bold text-lg leading-tight">
                    {qr.visitorName || qr.category || 'Visita'}
                  </h1>
                </div>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center py-6 px-6">
              {invalid ? (
                <div className="w-48 h-48 flex flex-col items-center justify-center bg-red-50 rounded-2xl">
                  <p className="text-5xl mb-2">⛔</p>
                  <p className="text-red-600 text-sm font-medium text-center">
                    {expired ? 'QR vencido' : exhausted ? 'Usos agotados' : 'QR inactivo'}
                  </p>
                </div>
              ) : (
                <div className="bg-white p-3 rounded-2xl border-4 border-slate-100 shadow-inner">
                  <QRCodeSVG value={qr.code} size={180} level="M" />
                </div>
              )}
              <p className="mt-3 font-mono text-xs text-slate-400 tracking-widest">{qr.code}</p>
            </div>

            {/* Info */}
            <div className="px-6 pb-6 space-y-3">
              {qr.unit && (
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3">
                  <span className="text-emerald-500">🏠</span>
                  <div>
                    <p className="text-xs text-slate-400">Unidad</p>
                    <p className="text-sm font-semibold text-slate-700">{qr.unit.identifier}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-400">Válido hasta</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{expiresStr}</p>
                </div>
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-400">Usos</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">
                    {qr.usedCount} / {qr.maxUses}
                  </p>
                </div>
              </div>

              {!invalid && (
                <div className="bg-emerald-50 rounded-xl px-4 py-3 text-center">
                  <p className="text-emerald-700 text-xs font-medium">
                    Muestra este código QR al guardia o escanéalo en la entrada
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-center gap-2">
              <img src="/logo3_ia2.png" alt="iaDoS" className="h-5 w-auto opacity-60" />
              <span className="text-xs text-slate-400">Acceso Digital · iaDoS</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
