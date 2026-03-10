import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function backendUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const upstream = await fetch(`${backendUrl()}/v1/billing/checkout`, {
      method: 'POST',
      headers: {
        Authorization: request.headers.get('authorization') || request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body,
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    logError(error, 'proxy billing checkout');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
