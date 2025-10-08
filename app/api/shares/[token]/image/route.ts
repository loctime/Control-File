import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    // Redirigir al backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    const backendResponse = await fetch(`${backendUrl}/api/shares/${token}/image`, {
      method: 'GET',
      redirect: 'manual', // No seguir la redirección automáticamente
    });

    // Si el backend hace redirect, forward it
    if (backendResponse.status === 302 || backendResponse.status === 301 || backendResponse.status === 307 || backendResponse.status === 308) {
      const location = backendResponse.headers.get('location');
      if (location) {
        return NextResponse.redirect(location);
      }
    }

    // Si es un error, devolver JSON
    if (!backendResponse.ok) {
      const contentType = backendResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const responseData = await backendResponse.json();
        return NextResponse.json(
          { error: responseData.error || 'Error en el servidor backend' },
          { status: backendResponse.status }
        );
      }
      return NextResponse.json(
        { error: 'Error en el servidor backend' },
        { status: backendResponse.status }
      );
    }

    // Si todo está bien, forward la respuesta
    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      headers: backendResponse.headers,
    });
  } catch (error) {
    console.error('Error getting shared image:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

