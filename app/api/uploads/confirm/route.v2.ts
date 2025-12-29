import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/firebase-admin';
import { FieldValue, Transaction, Timestamp } from 'firebase-admin/firestore';
import { withAuth, validateRequest, createErrorResponse, createSuccessResponse } from '@/lib/middleware/api-auth';
import { uploadConfirmSchema } from '@/lib/schemas/api-schemas';
import { logger, logUpload } from '@/lib/logger';
import { getObjectMetadata } from '@/lib/b2';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Constantes para detección de duplicados
const DUPLICATE_DETECTION_WINDOW_MINUTES = 10;
const FINGERPRINT_TTL_MINUTES = 30;

/**
 * Detecta si la detección de duplicados está activa
 */
function isDuplicateDetectionEnabled(request: NextRequest): boolean {
  const header = request.headers.get('X-Detect-Duplicates');
  const queryParam = request.nextUrl.searchParams.get('detectDuplicates');
  
  return header === 'true' || queryParam === 'true';
}

/**
 * Busca uploads previos del mismo usuario con el mismo hash dentro de la ventana de tiempo
 * Solo busca en uploadFingerprints (no en files)
 */
async function findDuplicateUpload(
  adminDb: FirebaseFirestore.Firestore,
  userId: string,
  hash: string,
  size: number,
  windowMinutes: number
): Promise<{ fileId: string; bucketKey: string; createdAt: Date } | null> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  const fingerprintsRef = adminDb.collection('uploadFingerprints');
  const fingerprintQuery = fingerprintsRef
    .where('userId', '==', userId)
    .where('hash', '==', hash)
    .where('size', '==', size)
    .where('createdAt', '>=', Timestamp.fromDate(windowStart))
    .orderBy('createdAt', 'desc')
    .limit(1);
  
  const fingerprintSnapshot = await fingerprintQuery.get();
  
  if (!fingerprintSnapshot.empty) {
    const fingerprint = fingerprintSnapshot.docs[0].data();
    return {
      fileId: fingerprint.fileId,
      bucketKey: fingerprint.bucketKey,
      createdAt: fingerprint.createdAt.toDate(),
    };
  }
  
  return null;
}

/**
 * Guarda un fingerprint temporal del upload para acelerar detección futura
 */
async function saveUploadFingerprint(
  adminDb: FirebaseFirestore.Firestore,
  userId: string,
  hash: string,
  size: number,
  bucketKey: string,
  fileId: string
): Promise<void> {
  const fingerprintRef = adminDb.collection('uploadFingerprints').doc();
  const expiresAt = new Date(Date.now() + FINGERPRINT_TTL_MINUTES * 60 * 1000);
  
  await fingerprintRef.set({
    userId,
    hash,
    size,
    bucketKey,
    fileId,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });
  
  logger.debug('Upload fingerprint saved', {
    fingerprintId: fingerprintRef.id,
    userId,
    hash,
    bucketKey,
    fileId,
  });
}

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    // Validar request body
    const validation = await validateRequest<{ uploadSessionId: string; etag?: string }>(request, uploadConfirmSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { uploadSessionId, etag: etagFromBody } = validation.data;

    // Verificar si la detección de duplicados está activa
    const detectDuplicates = isDuplicateDetectionEnabled(request);

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

    // Regla G: Validar que parentId pertenezca a la misma appId
    const appId = sessionData.appId;
    if (!appId) {
      logger.error('Upload session missing appId', { uploadSessionId, userId });
      return createErrorResponse(
        'Upload session does not have appId. Please re-upload the file.',
        400,
        'MISSING_APP_ID'
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
        
        return createErrorResponse(
          error.message || 'Parent folder validation failed',
          400,
          'PARENT_VALIDATION_FAILED'
        );
      }
    }

    // Obtener etag del archivo subido para detección de duplicados
    // Prioridad: 1) del body, 2) de la sesión (si fue subido vía proxy), 3) de B2
    let fileHash: string | null = null;
    let duplicateInfo: { 
      detected: boolean; 
      duplicateOfFileId?: string; 
      duplicateOfBucketKey?: string; 
      reason?: string; 
      etag?: string; 
      windowMinutes?: number 
    } | null = null;

    if (detectDuplicates) {
      // Intentar obtener etag de diferentes fuentes
      if (etagFromBody) {
        fileHash = etagFromBody;
      } else if (sessionData.etag) {
        fileHash = sessionData.etag;
      } else {
        // Obtener de B2 si no está disponible
        try {
          const metadata = await getObjectMetadata(sessionData.bucketKey);
          if (metadata?.etag) {
            fileHash = metadata.etag;
          }
        } catch (error: any) {
          logger.warn('Could not get metadata from B2 for duplicate detection', {
            bucketKey: sessionData.bucketKey,
            error: error.message,
          });
          // Continuar sin detección si falla (graceful degradation)
        }
      }

      // Si tenemos hash, buscar duplicados solo en uploadFingerprints
      if (fileHash) {
        const duplicate = await findDuplicateUpload(
          adminDb,
          userId,
          fileHash,
          sessionData.fileSize,
          DUPLICATE_DETECTION_WINDOW_MINUTES
        );

        if (duplicate) {
          duplicateInfo = {
            detected: true,
            duplicateOfFileId: duplicate.fileId,
            duplicateOfBucketKey: duplicate.bucketKey,
            reason: 'same-content',
            etag: fileHash,
            windowMinutes: DUPLICATE_DETECTION_WINDOW_MINUTES,
          };

          logger.info('Duplicate file detected', {
            userId,
            bucketKey: sessionData.bucketKey,
            duplicateOfFileId: duplicate.fileId,
            duplicateOfBucketKey: duplicate.bucketKey,
            hash: fileHash,
            windowMinutes: DUPLICATE_DETECTION_WINDOW_MINUTES,
          });
        }
      }
    }

    // Create file document using transaction for consistency
    const fileRef = adminDb.collection('files').doc();
    const fileId = fileRef.id;
    const userRef = adminDb.collection('users').doc(userId);

    // Preparar datos del archivo
    const fileData: any = {
      id: fileId,
      userId,
      name: sessionData.fileName,
      size: sessionData.fileSize,
      mime: sessionData.mimeType,
      parentId: sessionData.parentId,
      appId, // Regla G: appId obligatorio para archivos
      bucketKey: sessionData.bucketKey,
      type: 'file',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Agregar etag si está disponible
    if (fileHash) {
      fileData.etag = fileHash;
    }

    // Agregar metadata de duplicado si se detectó (mergear con metadata existente si hay)
    if (duplicateInfo?.detected) {
      // Mergear con metadata existente si existe (por ejemplo, de sessionData.metadata)
      const existingMetadata = sessionData.metadata || {};
      fileData.metadata = {
        ...existingMetadata,
        duplicate: {
          detected: true,
          reason: duplicateInfo.reason,
          hash: duplicateInfo.etag,
          duplicateOfFileId: duplicateInfo.duplicateOfFileId,
          duplicateOfBucketKey: duplicateInfo.duplicateOfBucketKey,
          detectedAt: FieldValue.serverTimestamp(),
          detectionSource: 'controlfile',
          detectionVersion: 'v1',
        },
      };
    } else if (sessionData.metadata) {
      // Si hay metadata en sessionData pero no se detectó duplicado, preservarla
      fileData.metadata = sessionData.metadata;
    }

    await adminDb.runTransaction(async (transaction: Transaction) => {
      // 1. Crear documento de archivo
      transaction.set(fileRef, fileData);

      // 2. Actualizar quota del usuario (mover de pending a used)
      transaction.update(userRef, {
        usedBytes: FieldValue.increment(sessionData.fileSize),
        pendingBytes: FieldValue.increment(-sessionData.fileSize),
      });

      // 3. Actualizar estado de la sesión
      transaction.update(sessionRef, {
        status: 'confirmed',
        confirmedAt: FieldValue.serverTimestamp(),
        fileId,
      });

      // 4. Si hay parent folder, actualizar su timestamp
      if (sessionData.parentId) {
        const folderRef = adminDb.collection('files').doc(sessionData.parentId);
        transaction.update(folderRef, {
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    // Guardar fingerprint temporal después de la transacción (no crítico si falla)
    if (detectDuplicates && fileHash) {
      try {
        await saveUploadFingerprint(
          adminDb,
          userId,
          fileHash,
          sessionData.fileSize,
          sessionData.bucketKey,
          fileId
        );
      } catch (error: any) {
        logger.warn('Failed to save upload fingerprint', {
          error: error.message,
          userId,
          bucketKey: sessionData.bucketKey,
          fileId,
        });
        // No fallar el upload si falla el fingerprint
      }
    }

    logUpload(userId, sessionData.fileName, sessionData.fileSize, 'completed', {
      fileId,
      uploadSessionId,
      duplicateDetected: duplicateInfo?.detected || false,
    });

    // Preparar respuesta
    const responseData: any = {
      fileId,
      message: 'Archivo subido exitosamente',
    };

    // Incluir información de duplicado si se detectó
    if (duplicateInfo?.detected) {
      responseData.duplicate = {
        detected: true,
        duplicateOfFileId: duplicateInfo.duplicateOfFileId,
        duplicateOfBucketKey: duplicateInfo.duplicateOfBucketKey,
        etag: duplicateInfo.etag,
        reason: duplicateInfo.reason,
        windowMinutes: duplicateInfo.windowMinutes,
      };
    }

    return createSuccessResponse(responseData);
  } catch (error: any) {
    logger.error('Error confirming upload', {
      error: error.message,
      stack: error.stack,
    });
    return createErrorResponse(error);
  }
});

