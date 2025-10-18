import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/firebase-admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { withAuth, validateRequest, createErrorResponse, createSuccessResponse } from '@/lib/middleware/api-auth';
import { uploadConfirmSchema } from '@/lib/schemas/api-schemas';
import { logger, logUpload } from '@/lib/logger';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    // Validar request body
    const validation = await validateRequest<{ uploadSessionId: string }>(request, uploadConfirmSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { uploadSessionId } = validation.data;

    // Get upload session
    const adminDb = requireAdminDb();
    const sessionRef = adminDb.collection('uploadSessions').doc(uploadSessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      logger.error('Upload session not found', { uploadSessionId, userId });
      return createErrorResponse('Sesión de subida no encontrada', 404, 'SESSION_NOT_FOUND');
    }

    const sessionData = sessionDoc.data()!;

    // Verify session belongs to user
    if (sessionData.userId !== userId) {
      logger.error('Unauthorized upload confirmation attempt', {
        uploadSessionId,
        sessionUserId: sessionData.userId,
        requestUserId: userId,
      });
      return createErrorResponse('No autorizado', 403, 'UNAUTHORIZED');
    }

    // Check if session is still valid
    if (sessionData.status !== 'pending') {
      logger.warn('Invalid session status', {
        uploadSessionId,
        status: sessionData.status,
      });
      return createErrorResponse('Sesión de subida no válida', 400, 'INVALID_SESSION_STATUS');
    }

    if (sessionData.expiresAt.toDate() < new Date()) {
      logger.warn('Upload session expired', { uploadSessionId });
      return createErrorResponse('Sesión de subida expirada', 400, 'SESSION_EXPIRED');
    }

    // Create file document using transaction for consistency
    const fileRef = adminDb.collection('files').doc();
    const fileId = fileRef.id;
    const userRef = adminDb.collection('users').doc(userId);

    await adminDb.runTransaction(async (transaction: Transaction) => {
      // 1. Crear documento de archivo
      transaction.set(fileRef, {
        id: fileId,
        userId,
        name: sessionData.fileName,
        size: sessionData.fileSize,
        mime: sessionData.mimeType,
        parentId: sessionData.parentId,
        bucketKey: sessionData.bucketKey,
        type: 'file',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 2. Actualizar quota del usuario (mover de pending a used)
      transaction.update(userRef, {
        usedBytes: FieldValue.increment(sessionData.fileSize),
        pendingBytes: FieldValue.increment(-sessionData.fileSize),
      });

      // 3. Actualizar estado de la sesión
      transaction.update(sessionRef, {
        status: 'confirmed',
        confirmedAt: new Date(),
        fileId,
      });

      // 4. Si hay parent folder, actualizar su timestamp
      if (sessionData.parentId) {
        const folderRef = adminDb.collection('folders').doc(sessionData.parentId);
        transaction.update(folderRef, {
          updatedAt: new Date(),
        });
      }
    });

    logUpload(userId, sessionData.fileName, sessionData.fileSize, 'completed', {
      fileId,
      uploadSessionId,
    });

    return createSuccessResponse({
      fileId,
      message: 'Archivo subido exitosamente',
    });
  } catch (error: any) {
    logger.error('Error confirming upload', {
      error: error.message,
      stack: error.stack,
    });
    return createErrorResponse(error);
  }
});

