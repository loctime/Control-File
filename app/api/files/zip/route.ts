import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { fileIds, zipName } = body || {};
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'Lista de archivos requerida' }, { status: 400 });
    }

    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002').replace(/\/$/, '');
    const upstream = await fetch(`${backendUrl}/api/files/zip`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileIds, zipName }),
    });

    if (!upstream.ok || !upstream.body) {
      const err = await upstream.json().catch(() => ({}));
      return NextResponse.json({ error: err.error || 'No se pudo generar el ZIP' }, { status: upstream.status || 502 });
    }

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/zip');
    const disp = upstream.headers.get('Content-Disposition');
    if (disp) headers.set('Content-Disposition', disp);
    headers.set('Cache-Control', 'private, no-store');

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error('Error proxying zip:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}


