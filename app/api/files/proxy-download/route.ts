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
    const upstream = await fetch(`${backendUrl()}/v1/files/presign-get`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(request),
        'Content-Type': request.headers.get('content-type') || 'application/json',
      },
      body,
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    const url = data.downloadUrl || data.presignedUrl;
    if (!url) {
      return NextResponse.json({ error: 'Respuesta invalida del backend' }, { status: 502 });
    }

    const fileResp = await fetch(url);
    if (!fileResp.ok || !fileResp.body) {
      return NextResponse.json({ error: 'No se pudo obtener el archivo' }, { status: 502 });
    }

    return new NextResponse(fileResp.body, {
      status: 200,
      headers: {
        'Content-Type': fileResp.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
