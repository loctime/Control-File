import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getBackendUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

function getAuthHeader(request: NextRequest) {
  return request.headers.get('Authorization') || request.headers.get('authorization') || '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendResponse = await fetch(`${getBackendUrl()}/v1/users/plan`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(request),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseData = await backendResponse.json();
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: responseData.error || 'Error en el servidor backend' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    logError(error, 'POST /user/plan');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
