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
    const headers = new Headers();
    const auth = authHeader(request);
    if (auth) headers.set('Authorization', auth);
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('Content-Type', contentType);

    const upstream = await fetch(`${backendUrl()}/v1/uploads/proxy-upload`, {
      method: 'POST',
      headers,
      body: request.body as any,
      // @ts-expect-error Node stream upload
      duplex: 'half',
    });

    const upstreamType = upstream.headers.get('content-type') || 'application/json';
    if (upstreamType.includes('application/json')) {
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstreamType },
    });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
