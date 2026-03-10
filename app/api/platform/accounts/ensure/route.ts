import { NextRequest, NextResponse } from 'next/server';

function backendUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

function authHeader(request: NextRequest) {
  return request.headers.get('Authorization') || request.headers.get('authorization') || '';
}

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const upstream = await fetch(`${backendUrl()}/v1/platform/accounts/ensure`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(request),
        'Content-Type': 'application/json',
      },
      body,
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
