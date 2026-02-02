import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { verifySuperdev } from '@/lib/middleware/superdev-auth';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

/**
 * GET /api/superdev/list-owners
 * 
 * SUPERDEV-ONLY: Listar todos los owners disponibles para impersonación
 * 
 * Requiere:
 * - role === 'superdev'
 * 
 * Retorna:
 * - { owners: Array<{ uid: string; email: string | null; nombre: string | null }> }
 * 
 * Notas:
 * - Solo retorna owners válidos de la colección apps/auditoria/owners
 * - Email y nombre se obtienen desde Firebase Auth
 * - Si un owner no tiene cuenta en Auth, se omite de la lista
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar que el usuario tenga permisos de superdev
    const superdevInfo = await verifySuperdev(request);
    const superdevUid = superdevInfo.uid;
    const superdevEmail = superdevInfo.email;

    // 2. Obtener todos los owners de Firestore
    const adminDb = requireAdminDb();
    const ownersSnapshot = await adminDb
      .collection('apps')
      .doc('auditoria')
      .collection('owners')
      .get();

    // 3. Para cada owner, obtener email y nombre desde Firebase Auth
    const adminAuth = requireAdminAuth();
    const owners: Array<{ uid: string; email: string | null; nombre: string | null }> = [];

    // Procesar owners en paralelo para mejor rendimiento
    const ownerPromises = ownersSnapshot.docs.map(async (ownerDoc: QueryDocumentSnapshot) => {
      const ownerId = ownerDoc.id;
      const ownerData = ownerDoc.data();

      // Validar que sea un owner válido
      if (
        !ownerData ||
        ownerData.role !== 'admin' ||
        ownerData.ownerId !== ownerId ||
        ownerData.appId !== 'auditoria'
      ) {
        // Omitir owners inválidos
        return null;
      }

      try {
        // Obtener datos del usuario desde Firebase Auth
        const authUser = await adminAuth.getUser(ownerId);
        
        return {
          uid: ownerId,
          email: authUser.email || null,
          nombre: authUser.displayName || null,
        };
      } catch (error: any) {
        // Si el owner no tiene cuenta en Auth, omitirlo
        if (error.code === 'auth/user-not-found') {
          logger.debug('Owner sin cuenta Auth omitido de lista', {
            ownerId,
            superdevUid,
          });
          return null;
        }
        // Para otros errores, loguear pero continuar
        logger.warn('Error obteniendo datos de Auth para owner', {
          ownerId,
          error: error.message,
          superdevUid,
        });
        return null;
      }
    });

    // Esperar todas las promesas y filtrar nulos
    const ownerResults = await Promise.all(ownerPromises);
    const validOwners = ownerResults.filter(
      (owner): owner is { uid: string; email: string | null; nombre: string | null } =>
        owner !== null
    );

    // 4. Ordenar por email (o nombre si no hay email)
    validOwners.sort((a, b) => {
      const aDisplay = a.email || a.nombre || a.uid;
      const bDisplay = b.email || b.nombre || b.uid;
      return aDisplay.localeCompare(bDisplay);
    });

    // 5. Logging de auditoría
    logger.info('Superdev list owners successful', {
      superdevUid,
      superdevEmail,
      ownersCount: validOwners.length,
      timestamp: new Date().toISOString(),
    });

    // 6. Retornar lista de owners
    return NextResponse.json(
      { owners: validOwners },
      { status: 200 }
    );

  } catch (error: any) {
    // Manejo de errores específicos
    // 401 → token inválido / ausente / expirado
    // 403 → token válido pero sin permisos
    
    if (error.message?.includes('token requerido') || error.message?.includes('No autorizado: token')) {
      logger.warn('Unauthorized list owners attempt (missing token)', {
        error: error.message,
        path: request.url,
      });
      return NextResponse.json(
        { error: error.message, code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (error.message?.includes('se requieren permisos de superdev')) {
      logger.warn('Forbidden list owners attempt (no superdev role)', {
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
      logger.warn('List owners attempt with expired token', {
        error: error.message,
      });
      return NextResponse.json(
        { error: 'Token expirado', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      );
    }

    if (error.code === 'auth/id-token-revoked') {
      logger.warn('List owners attempt with revoked token', {
        error: error.message,
      });
      return NextResponse.json(
        { error: 'Token revocado', code: 'TOKEN_REVOKED' },
        { status: 401 }
      );
    }

    // Error desconocido
    logger.error('Error en list owners endpoint', {
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
