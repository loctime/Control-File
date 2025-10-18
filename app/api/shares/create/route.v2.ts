import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/firebase-admin';
import { withAuth, validateRequest, createErrorResponse, createSuccessResponse } from '@/lib/middleware/api-auth';
import { shareCreateSchema } from '@/lib/schemas/api-schemas';
import { logger } from '@/lib/logger';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    // Validar request body
    const validation = await validateRequest(request, shareCreateSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { fileId, expiresIn } = validation.data;

    // Get file document
    const adminDb = requireAdminDb();
    const fileRef = adminDb.collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      logger.error('File not found for sharing', { fileId, userId });
      return createErrorResponse('Archivo no encontrado', 404, 'FILE_NOT_FOUND');
    }

    const fileData = fileDoc.data()!;

    // Verify file belongs to user
    if (fileData.userId !== userId) {
      logger.error('Unauthorized share creation attempt', {
        fileId,
        fileUserId: fileData.userId,
        requestUserId: userId,
      });
      return createErrorResponse('No autorizado', 403, 'UNAUTHORIZED');
    }

    // Create share document
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shareRef = adminDb.collection('shares').doc(shareId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    await shareRef.set({
      fileId,
      userId,
      fileName: fileData.name,
      fileSize: fileData.size,
      mimeType: fileData.mime,
      expiresAt,
      createdAt: new Date(),
      downloadCount: 0,
    });

    logger.info('Share created', {
      shareId,
      fileId,
      userId,
      expiresIn,
    });

    return createSuccessResponse({
      shareId,
      expiresAt: expiresAt.toISOString(),
      shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/share/${shareId}`,
    });
  } catch (error: any) {
    logger.error('Error creating share', {
      error: error.message,
      stack: error.stack,
    });
    return createErrorResponse(error);
  }
});

