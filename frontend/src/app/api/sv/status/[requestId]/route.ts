import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.API_URL || 'http://localhost:3001/api';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const res = await fetch(`${BACKEND}/service-qr/public/request-status/${requestId}`, {
      cache: 'no-store',
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, message: 'Error de conexión' }, { status: 502 });
  }
}
