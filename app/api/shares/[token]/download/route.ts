import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';

export async function POST(
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
    const backendResponse = await fetch(`${backendUrl}/api/shares/${token}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    logError(error, 'downloading shared file');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
