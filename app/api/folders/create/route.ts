import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('📁 Next.js create folder endpoint called');
    
    // Redirigir la petición al backend
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';
    if (!backendUrl) {
      console.error('❌ BACKEND_URL no configurada');
      return NextResponse.json(
        { error: 'BACKEND_URL no configurada en el entorno del frontend' },
        { status: 500 }
      );
    }
    const backendResponse = await fetch(`${backendUrl}/api/folders/create`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(await request.json()),
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
    console.error('Error in create folder:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
