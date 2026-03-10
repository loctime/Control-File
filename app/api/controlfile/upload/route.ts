import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function backendUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const auth = request.headers.get('authorization') || request.headers.get('Authorization') || '';
    const buffer = await request.arrayBuffer();

    const upstream = await fetch(`${backendUrl()}/v1/controlfile/upload`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': contentType,
      },
      body: buffer,
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    logError(error, 'proxy controlfile upload');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
