import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/firebase-admin';
import { createPresignedPostUrl } from '@/lib/b2';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { withAuth, validateRequest, createErrorResponse, createSuccessResponse } from '@/lib/middleware/api-auth';
import { uploadPresignSchema } from '@/lib/schemas/api-schemas';
import { logger, logUpload } from '@/lib/logger';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    // Validar request body
    const validation = await validateRequest<{
      name: string;
      size: number;
      mime: string;
      parentId?: string | null;
    }>(request, uploadPresignSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { name, size, mime, parentId } = validation.data;

    logUpload(userId, name, size, 'started');

    // Check user quota
    const adminDb = requireAdminDb();
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      logger.error('User not found', { userId });
      return createErrorResponse('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }

    const userData = userDoc.data()!;
    const usedBytes = userData.usedBytes || 0;
    const pendingBytes = userData.pendingBytes || 0;
    const planQuotaBytes = userData.planQuotaBytes;

    // Verificar cuota disponible
    if (usedBytes + pendingBytes + size > planQuotaBytes) {
      logger.warn('Quota exceeded', {
        userId,
        required: size,
        available: planQuotaBytes - usedBytes - pendingBytes,
      });

      return NextResponse.json(
        {
          error: 'Cuota de almacenamiento excedida',
          code: 'QUOTA_EXCEEDED',
          details: {
            usedBytes,
            pendingBytes,
            planQuotaBytes,
            requiredBytes: size,
            availableBytes: planQuotaBytes - usedBytes - pendingBytes,
          },
        },
        { status: 413 }
      );
    }

    // Generate unique file key
    const fileKey = `uploads/${userId}/${Date.now()}_${name}`;

    // Create presigned URL for upload
    const presignedData = await createPresignedPostUrl(fileKey, mime);

    // Create upload session in Firestore
    const uploadSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionRef = adminDb.collection('uploadSessions').doc(uploadSessionId);

    // Usar transacción para garantizar consistencia
    await adminDb.runTransaction(async (transaction: Transaction) => {
      // 1. Crear sesión de upload
      transaction.set(sessionRef, {
        userId,
        fileName: name,
        fileSize: size,
        mimeType: mime,
        parentId: parentId || null,
        bucketKey: fileKey,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // 2. Reservar bytes pendientes
      transaction.update(userRef, {
        pendingBytes: FieldValue.increment(size),
      });
    });

    logger.info('Upload session created', {
      userId,
      uploadSessionId,
      fileName: name,
      fileSize: size,
    });

    return createSuccessResponse({
      uploadSessionId,
      presignedUrl: presignedData.url,
      fields: presignedData.fields,
      fileKey,
    });
  } catch (error: any) {
    logger.error('Error creating presigned URL', {
      error: error.message,
      stack: error.stack,
    });
    return createErrorResponse(error);
  }
});

