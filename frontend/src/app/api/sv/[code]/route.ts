import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.API_URL || 'http://localhost:3001/api';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  try {
    const res = await fetch(`${BACKEND}/service-qr/public/${code}`, { cache: 'no-store' });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, message: 'Error de conexión con el servidor' }, { status: 502 });
  }
}
