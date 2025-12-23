import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { logger, logError } from '@/lib/logger-client';
import { normalizeAppId } from '@/lib/utils/app-ownership';
import { FieldValue, Transaction } from 'firebase-admin/firestore';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    logger.info('API set-main folder endpoint called');
    
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
    const requestBody = await request.json();
    const { folderId, app } = requestBody;

    if (!folderId || typeof folderId !== 'string') {
      return NextResponse.json(
        { error: 'folderId es requerido' },
        { status: 400 }
      );
    }

    // Validación: app.id es obligatorio
    if (!app || !app.id || typeof app.id !== 'string' || !app.id.trim()) {
      return NextResponse.json(
        { error: 'Missing app.id. Every folder or file must belong to an application.' },
        { status: 400 }
      );
    }

    const normalizedAppId = normalizeAppId(app.id);
    const adminDb = requireAdminDb();

    // Validar que la carpeta existe y pertenece al usuario y a la app
    const folderDoc = await adminDb.collection('files').doc(folderId).get();
    
    if (!folderDoc.exists) {
      return NextResponse.json(
        { error: 'Carpeta no encontrada' },
        { status: 404 }
      );
    }

    const folderData = folderDoc.data()!;

    // Verificar que pertenece al usuario
    if (folderData.userId !== userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    // Verificar que es una carpeta
    if (folderData.type !== 'folder') {
      return NextResponse.json(
        { error: 'El elemento no es una carpeta' },
        { status: 400 }
      );
    }

    // Verificar que pertenece a la misma app
    if (!folderData.appId) {
      return NextResponse.json(
        { error: 'La carpeta no tiene appId. No se puede establecer como principal.' },
        { status: 400 }
      );
    }

    const folderAppId = normalizeAppId(folderData.appId);
    if (folderAppId !== normalizedAppId) {
      return NextResponse.json(
        { error: `La carpeta pertenece a la app '${folderData.appId}', pero se solicitó '${app.id}'` },
        { status: 400 }
      );
    }

    // Buscar todas las carpetas del mismo usuario y app que tengan isMainFolder = true
    const existingMainFoldersQuery = await adminDb.collection('files')
      .where('userId', '==', userId)
      .where('appId', '==', normalizedAppId)
      .where('type', '==', 'folder')
      .where('metadata.isMainFolder', '==', true)
      .get();

    // Usar transacción para garantizar atomicidad
    await adminDb.runTransaction(async (transaction: Transaction) => {
      // 1. Quitar isMainFolder de todas las carpetas principales existentes
      existingMainFoldersQuery.forEach((doc) => {
        if (doc.id !== folderId) {
          transaction.update(doc.ref, {
            'metadata.isMainFolder': false,
            updatedAt: new Date(),
          });
        }
      });

      // 2. Setear isMainFolder en la carpeta solicitada
      const folderRef = adminDb.collection('files').doc(folderId);
      transaction.update(folderRef, {
        'metadata.isMainFolder': true,
        updatedAt: new Date(),
      });
    });

    logger.info('Main folder set successfully', {
      folderId,
      userId,
      appId: normalizedAppId,
      previousMainFolders: existingMainFoldersQuery.docs.length,
    });

    return NextResponse.json({
      success: true,
      message: 'Carpeta principal establecida exitosamente',
      folderId,
    });
  } catch (error) {
    logError(error, 'setting main folder', {
      userId: request.headers.get('authorization') ? 'authenticated' : 'anonymous',
    });
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

