import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';

export async function POST(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    const backendResponse = await fetch(`${backendUrl}/api/users/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || request.headers.get('authorization') || '',
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
    logError(error, 'POST /users/initialize');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
