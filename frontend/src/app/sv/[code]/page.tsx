import ServiceFormLoader from './ServiceFormLoader';

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 text-center max-w-sm w-full">
        <p className="text-5xl mb-4">⚠️</p>
        <h2 className="text-white font-bold text-xl mb-2">No disponible</h2>
        <p className="text-slate-300 text-sm">{message}</p>
      </div>
    </div>
  );
}

export default async function ServiceVisitorPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const apiUrl = process.env.API_URL || 'http://localhost:3001/api';

  try {
    const res = await fetch(`${apiUrl}/service-qr/public/${code}`, { cache: 'no-store' });
    const json = await res.json();
    if (!json.ok) {
      return <ErrorScreen message={json.message || 'Código no disponible'} />;
    }
    return <ServiceFormLoader info={json.data} />;
  } catch {
    return <ErrorScreen message="No se pudo conectar con el servidor" />;
  }
}
