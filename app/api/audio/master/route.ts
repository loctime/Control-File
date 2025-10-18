import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';

// Backend URL from environment
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase token
    let decodedToken;
    try {
      const auth = requireAdminAuth();
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { fileId, action } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'ID de archivo requerido' }, { status: 400 });
    }

    if (!action || !['create', 'replace'].includes(action)) {
      return NextResponse.json({ 
        error: 'Acción inválida. Use "create" o "replace"' 
      }, { status: 400 });
    }

    // Verify file exists and belongs to user
    const db = requireAdminDb();
    const fileRef = db.collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const fileData = fileDoc.data()!;
    
    if (fileData.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (fileData.isDeleted) {
      return NextResponse.json({ error: 'Archivo eliminado' }, { status: 400 });
    }

    // Validate audio file
    const supportedTypes = ['audio/wav', 'audio/wave', 'audio/mpeg', 'audio/mp3'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!supportedTypes.includes(fileData.mime)) {
      return NextResponse.json({ 
        error: 'Tipo de archivo no soportado. Solo WAV y MP3 son permitidos.' 
      }, { status: 400 });
    }

    if (fileData.size > maxSize) {
      return NextResponse.json({ 
        error: 'Archivo demasiado grande. El límite es 50MB.' 
      }, { status: 400 });
    }

    // Forward request to backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/audio/master`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ fileId, action }),
    });

    const backendData = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: backendData.error || 'Error en el procesamiento' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(backendData);

  } catch (error) {
    console.error('Error in audio mastering proxy:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase token
    let decodedToken;
    try {
      const auth = requireAdminAuth();
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Get fileId from query params
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'ID de archivo requerido' }, { status: 400 });
    }

    // Forward request to backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/audio/info/${fileId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const backendData = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: backendData.error || 'Error obteniendo información' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(backendData);

  } catch (error) {
    console.error('Error in audio info proxy:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
