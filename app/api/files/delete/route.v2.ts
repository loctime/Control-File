import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { deleteObject } from '@/lib/b2';
import { withAuth, validateRequest, createErrorResponse, createSuccessResponse } from '@/lib/middleware/api-auth';
import { fileDeleteSchema } from '@/lib/schemas/api-schemas';
import { logger, logFileOperation } from '@/lib/logger';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    // Validar request body
    const validation = await validateRequest<{ fileId: string }>(request, fileDeleteSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { fileId } = validation.data;

    // Get file document
    const adminDb = requireAdminDb();
    const fileRef = adminDb.collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      logger.error('File not found', { fileId, userId });
      return createErrorResponse('Archivo no encontrado', 404, 'FILE_NOT_FOUND');
    }

    const fileData = fileDoc.data()!;

    // Verify file belongs to user
    if (fileData.userId !== userId) {
      logger.error('Unauthorized file deletion attempt', {
        fileId,
        fileUserId: fileData.userId,
        requestUserId: userId,
      });
      return createErrorResponse('No autorizado', 403, 'UNAUTHORIZED');
    }

    logFileOperation('delete', fileId, userId, {
      fileName: fileData.name,
      fileSize: fileData.size,
    });

    // Delete file from B2 (con retry automático)
    try {
      await deleteObject(fileData.bucketKey);
      logger.info('File deleted from B2', { fileId, bucketKey: fileData.bucketKey });
    } catch (error: any) {
      logger.error('Error deleting from B2', {
        fileId,
        bucketKey: fileData.bucketKey,
        error: error.message,
      });
      
      // Si falla B2, registrar para limpieza posterior
      // pero continuar con la eliminación en Firestore
      const orphanedRef = adminDb.collection('orphanedFiles').doc();
      await orphanedRef.set({
        fileId,
        bucketKey: fileData.bucketKey,
        userId,
        size: fileData.size,
        createdAt: new Date(),
        reason: 'b2_delete_failed',
        error: error.message,
      });
    }

    // Usar transacción para garantizar consistencia
    const userRef = adminDb.collection('users').doc(userId);
    
    await adminDb.runTransaction(async (transaction) => {
      // 1. Eliminar documento del archivo
      transaction.delete(fileRef);

      // 2. Actualizar quota del usuario
      transaction.update(userRef, {
        usedBytes: FieldValue.increment(-fileData.size),
      });
    });

    logger.info('File deleted successfully', { fileId, userId });

    return createSuccessResponse({
      message: 'Archivo eliminado exitosamente',
    });
  } catch (error: any) {
    logger.error('Error deleting file', {
      error: error.message,
      stack: error.stack,
    });
    return createErrorResponse(error);
  }
});

