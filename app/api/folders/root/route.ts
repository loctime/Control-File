import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function backendUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

function authHeader(request: NextRequest) {
  return request.headers.get('Authorization') || request.headers.get('authorization') || '';
}

export async function GET(request: NextRequest) {
  try {
    const upstream = await fetch(`${backendUrl()}/v1/folders/root${new URL(request.url).search}`, {
      method: 'GET',
      headers: { Authorization: authHeader(request) },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
