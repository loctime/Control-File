import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/firebase-admin';

// Backend URL from environment
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase token
    try {
      const auth = requireAdminAuth();
      await auth.verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Forward request to backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/audio/test-ffmpeg`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const backendData = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: backendData.error || 'Error verificando FFmpeg' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(backendData);

  } catch (error) {
    console.error('Error in FFmpeg test proxy:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
