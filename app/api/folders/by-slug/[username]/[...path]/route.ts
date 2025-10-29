import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string; path: string[] } }
) {
  try {
    const { username, path } = params;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    const pathString = path.join('/');
    
    const backendResponse = await fetch(`${backendUrl}/api/folders/by-slug/${username}/${pathString}`, {
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
    logError(error, 'GET /folders/by-slug');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
