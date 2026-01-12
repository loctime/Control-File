import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { verifySuperdev } from '@/lib/middleware/superdev-auth';

export const runtime = 'nodejs';

/**
 * POST /api/superdev/impersonate
 * 
 * SUPERDEV-ONLY: Generar un custom token para impersonar a un owner
 * 
 * Requiere:
 * - Custom claim superdev: true
 * - Body: { ownerId: string }
 * 
 * Retorna:
 * - { customToken: string }
 * 
 * Restricciones:
 * - No modifica Firestore
 * - No persiste estado
 * - Solo genera token temporal (logout revierte)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar que el usuario tenga permisos de superdev
    const superdevInfo = await verifySuperdev(request);
    const superdevUid = superdevInfo.uid;
    const superdevEmail = superdevInfo.email;

    // 2. Validar body
    const body = await request.json();
    const { ownerId } = body;

    if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
      logger.warn('Impersonate attempt with invalid ownerId', {
        superdevUid,
        ownerId: ownerId || 'missing',
      });
      return NextResponse.json(
        { error: 'ownerId es requerido y debe ser un string válido', code: 'INVALID_OWNER_ID' },
        { status: 400 }
      );
    }

    const targetOwnerId = ownerId.trim();

    // 3. Verificar que el owner existe en Firestore (colección correcta)
    const adminDb = requireAdminDb();
    const ownerDoc = await adminDb
      .collection('apps')
      .doc('auditoria')
      .collection('owners')
      .doc(targetOwnerId)
      .get();

    if (!ownerDoc.exists) {
      logger.warn('Impersonate attempt for non-existent owner', {
        superdevUid,
        targetOwnerId,
      });
      return NextResponse.json(
        { error: 'Owner no encontrado', code: 'OWNER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 4. Validar que el target sea realmente un OWNER válido
    const ownerData = ownerDoc.data();
    if (
      !ownerData ||
      ownerData.role !== 'admin' ||
      ownerData.ownerId !== targetOwnerId ||
      ownerData.appId !== 'auditoria'
    ) {
      logger.warn('Impersonate attempt for invalid owner (not a valid owner)', {
        superdevUid,
        targetOwnerId,
        ownerData: ownerData ? {
          role: ownerData.role,
          ownerId: ownerData.ownerId,
          appId: ownerData.appId,
        } : null,
      });
      return NextResponse.json(
        { error: 'El UID no corresponde a un owner válido', code: 'INVALID_OWNER' },
        { status: 403 }
      );
    }

    // 5. Verificar que el owner existe en Firebase Auth
    const adminAuth = requireAdminAuth();
    let authUser;
    try {
      authUser = await adminAuth.getUser(targetOwnerId);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        logger.warn('Impersonate attempt for owner without Auth account', {
          superdevUid,
          targetOwnerId,
        });
        return NextResponse.json(
          { error: 'Owner no tiene cuenta de autenticación', code: 'OWNER_AUTH_NOT_FOUND' },
          { status: 404 }
        );
      }
      throw error;
    }

    // 6. Generar Firebase Custom Token para el owner con claims reforzados
    const customToken = await adminAuth.createCustomToken(targetOwnerId, {
      appId: 'auditoria',
      role: 'admin',
      ownerId: targetOwnerId,
    });

    // 7. Logging de auditoría
    logger.info('Superdev impersonation successful', {
      superdevUid,
      superdevEmail,
      targetOwnerId,
      targetOwnerEmail: authUser.email,
      timestamp: new Date().toISOString(),
    });

    // 8. Retornar custom token
    return NextResponse.json(
      { customToken },
      { status: 200 }
    );

  } catch (error: any) {
    // Manejo de errores específicos
    // 401 → token inválido / ausente / expirado
    // 403 → token válido pero sin permisos
    
    if (error.message?.includes('token requerido') || error.message?.includes('No autorizado: token')) {
      logger.warn('Unauthorized impersonate attempt (missing token)', {
        error: error.message,
        path: request.url,
      });
      return NextResponse.json(
        { error: error.message, code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (error.message?.includes('se requieren permisos de superdev')) {
      logger.warn('Forbidden impersonate attempt (no superdev claim)', {
        error: error.message,
        path: request.url,
      });
      return NextResponse.json(
        { error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Error de Firebase Auth (token inválido/expirado)
    if (error.code === 'auth/id-token-expired') {
      logger.warn('Impersonate attempt with expired token', {
        error: error.message,
      });
      return NextResponse.json(
        { error: 'Token expirado', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      );
    }

    if (error.code === 'auth/id-token-revoked') {
      logger.warn('Impersonate attempt with revoked token', {
        error: error.message,
      });
      return NextResponse.json(
        { error: 'Token revocado', code: 'TOKEN_REVOKED' },
        { status: 401 }
      );
    }

    // Error desconocido
    logger.error('Error en impersonate endpoint', {
      error: error.message,
      stack: error.stack,
      path: request.url,
    });

    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
