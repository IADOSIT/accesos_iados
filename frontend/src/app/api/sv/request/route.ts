import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.API_URL || 'http://localhost:3001/api';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND}/service-qr/public/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, message: 'Error de conexión con el servidor' }, { status: 502 });
  }
}
