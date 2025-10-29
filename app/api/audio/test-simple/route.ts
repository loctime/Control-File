import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';
import { requireAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
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
      logError(error, 'verifying token (audio test-simple)');
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

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

    // Simular procesamiento exitoso
    const result = {
      success: true,
      message: 'Audio masterizado exitosamente (modo simulado)',
      fileId: fileId,
      fileName: `test_${Date.now()}.wav`,
      fileSize: 1024 * 1024, // 1MB simulado
      action: action,
      simulated: true
    };

    return NextResponse.json(result);

  } catch (error) {
    logError(error, 'simple audio test');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
