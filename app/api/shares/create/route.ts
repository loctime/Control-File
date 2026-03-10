import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function backendUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

function authHeader(request: NextRequest) {
  return request.headers.get('Authorization') || request.headers.get('authorization') || '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const upstream = await fetch(`${backendUrl()}/v1/shares/create`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(request),
        'Content-Type': request.headers.get('content-type') || 'application/json',
      },
      body,
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    if (contentType.includes('application/json')) {
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
