import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3002';
    const url = new URL(request.url);
    const qs = url.search;
    const backendResponse = await fetch(`${backendUrl}/api/folders/root${qs}`, {
      method: 'GET',
      headers: {
        'Authorization': request.headers.get('Authorization') || request.headers.get('authorization') || '',
      },
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
    console.error('Error in GET /folders/root:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}


