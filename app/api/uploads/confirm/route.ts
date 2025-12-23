import { NextRequest, NextResponse } from 'next/server';
import { logError, logger } from '@/lib/logger-client';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = requireAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse request body
    const { uploadSessionId } = await request.json();

    if (!uploadSessionId) {
      return NextResponse.json({ error: 'ID de sesión de subida requerido' }, { status: 400 });
    }

    // Get upload session
    const adminDb = requireAdminDb();
    const sessionRef = adminDb.collection('uploadSessions').doc(uploadSessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Sesión de subida no encontrada' }, { status: 404 });
    }

    const sessionData = sessionDoc.data()!;
    
    // Verify session belongs to user
    if (sessionData.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Check if session is still valid
    if (sessionData.status !== 'pending') {
      return NextResponse.json({ error: 'Sesión de subida no válida' }, { status: 400 });
    }

    if (sessionData.expiresAt.toDate() < new Date()) {
      return NextResponse.json({ error: 'Sesión de subida expirada' }, { status: 400 });
    }

    // Regla G: Validar que parentId pertenezca a la misma appId
    const appId = sessionData.appId;
    if (!appId) {
      return NextResponse.json(
        { error: 'Upload session does not have appId. Please re-upload the file.' },
        { status: 400 }
      );
    }

    // Validar que el parent pertenece a la misma app
    if (sessionData.parentId) {
      const { validateParentAppId } = await import('@/lib/utils/app-ownership');
      try {
        await validateParentAppId(adminDb, userId, sessionData.parentId, appId);
      } catch (error: any) {
        // Logging detallado para debugging de cruces inválidos de app
        logger.error('Invalid app cross-over attempt detected', {
          userId,
          appId,
          parentId: sessionData.parentId,
          endpoint: '/api/uploads/confirm',
          error: error.message,
          uploadSessionId,
          fileName: sessionData.fileName,
          timestamp: new Date().toISOString()
        });
        
        return NextResponse.json(
          { error: error.message || 'Parent folder validation failed' },
          { status: 400 }
        );
      }
    }

    // Create file document
    const fileRef = adminDb.collection('files').doc();
    const fileId = fileRef.id;

    await fileRef.set({
      id: fileId,
      userId,
      name: sessionData.fileName,
      size: sessionData.fileSize,
      mime: sessionData.mimeType,
      parentId: sessionData.parentId,
      appId, // Regla G: appId obligatorio para archivos
      bucketKey: sessionData.bucketKey,
      type: 'file',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update user quota
    const userRef = adminDb.collection('users').doc(userId);
    await userRef.update({
      usedBytes: FieldValue.increment(sessionData.fileSize),
      pendingBytes: FieldValue.increment(-sessionData.fileSize),
    });

    // Update session status
    await sessionRef.update({
      status: 'confirmed',
      confirmedAt: new Date(),
    });

    // If parent is a folder, update its metadata
    if (sessionData.parentId) {
      const folderRef = adminDb.collection('files').doc(sessionData.parentId);
      await folderRef.update({
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ 
      success: true, 
      fileId,
      message: 'Archivo subido exitosamente' 
    });
  } catch (error) {
    logError(error, 'confirming upload');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
