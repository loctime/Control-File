import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Next.js proxy upload endpoint called');

    // Redirigir la petición al backend (configurable por entorno)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    console.log('📤 Backend URL:', backendUrl);

    // Reenviar la solicitud como streaming sin parsear el cuerpo para evitar límites
    const headers = new Headers();
    const auth = request.headers.get('authorization') || request.headers.get('Authorization') || '';
    const contentType = request.headers.get('content-type') || request.headers.get('Content-Type') || '';
    if (auth) headers.set('Authorization', auth);
    if (contentType) headers.set('Content-Type', contentType);

    const backendResponse = await fetch(`${backendUrl}/api/uploads/proxy-upload`, {
      method: 'POST',
      headers,
      body: request.body as any,
      // @ts-expect-error: duplex es necesario para streams en Node 18
      duplex: 'half',
    });

    // Passthrough de la respuesta del backend
    const passthroughHeaders = new Headers();
    passthroughHeaders.set('Content-Type', backendResponse.headers.get('content-type') || 'application/json');
    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      headers: passthroughHeaders,
    });
  } catch (error) {
    console.error('Error in proxy upload:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
