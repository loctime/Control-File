import { NextRequest, NextResponse } from 'next/server';

function backendUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

function authHeader(request: NextRequest) {
  return request.headers.get('Authorization') || request.headers.get('authorization') || '';
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const upstream = await fetch(`${backendUrl()}/v1/platform/plans`, {
      method: 'GET',
      headers: { Authorization: authHeader(request) },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const upstream = await fetch(`${backendUrl()}/v1/platform/plans`, {
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.text();
    const upstream = await fetch(`${backendUrl()}/v1/platform/plans`, {
      method: 'PATCH',
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
