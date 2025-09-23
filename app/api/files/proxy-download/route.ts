import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { fileId } = await request.json();
    if (!fileId) {
      return NextResponse.json({ error: 'ID de archivo requerido' }, { status: 400 });
    }

    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');

    // Solicitar al backend la URL de descarga presignada (el backend valida el token)
    const presignResp = await fetch(`${backendUrl}/api/files/presign-get`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId }),
    });

    if (!presignResp.ok) {
      const errBody = await presignResp.json().catch(() => ({}));
      return NextResponse.json({ error: errBody.error || 'No se pudo generar la URL' }, { status: 502 });
    }

    const data = await presignResp.json();
    const url = data.downloadUrl || data.presignedUrl;
    if (!url) {
      return NextResponse.json({ error: 'Respuesta inválida del backend' }, { status: 502 });
    }

    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'No se pudo obtener el archivo' }, { status: 502 });
    }

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Cache-Control', 'private, max-age=60');

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error('Error proxying download:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}


