import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

const FREE_STORAGE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

/**
 * Convierte un Timestamp de Firestore a ISO string
 * Si es null, retorna null
 */
function timestampToISO(timestamp: any): string | null {
  if (!timestamp) return null;
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  return null;
}

/**
 * Convierte un documento de cuenta de Firestore al formato esperado
 * Convierte timestamps a ISO strings
 */
function formatAccountData(accountData: any, uid: string) {
  if (!accountData) return null;

  return {
    uid,
    ...accountData,
    createdAt: timestampToISO(accountData.createdAt),
    updatedAt: timestampToISO(accountData.updatedAt),
    paidUntil: timestampToISO(accountData.paidUntil),
    trialEndsAt: timestampToISO(accountData.trialEndsAt),
  };
}

/**
 * POST /api/platform/accounts/ensure
 * 
 * Endpoint mínimo y obligatorio para garantizar la existencia
 * de la cuenta global del usuario autenticado.
 * 
 * Reglas:
 * - Requiere autenticación (token Bearer en header)
 * - Es idempotente (se puede llamar múltiples veces)
 * - Crea la cuenta si no existe, la devuelve si ya existe
 * - No depende de otras apps, billing, Stripe ni permisos avanzados
 * 
 * Estructura del documento: platform/accounts/{uid}
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Token inválido', code: 'AUTH_INVALID_TOKEN' },
        { status: 401 }
      );
    }

    // Verificar token con Firebase Admin
    const { requireAdminAuth } = await import('@/lib/firebase-admin');
    const adminAuth = requireAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken.uid) {
      return NextResponse.json(
        { error: 'Token sin UID', code: 'AUTH_NO_UID' },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;
    const email = decodedToken.email || '';

    // Obtener referencia a la cuenta
    // Estructura: platform/accounts/{uid}
    // En Admin SDK, esto se accede como: platform (doc) -> accounts (subcollection) -> {uid} (doc)
    const db = requireAdminDb();
    const accountRef = db.collection('platform').doc('accounts').collection('accounts').doc(uid);
    const accountDoc = await accountRef.get();

    // Si existe, devolverla formateada
    if (accountDoc.exists) {
      const accountData = accountDoc.data();
      const formatted = formatAccountData(accountData, uid);
      return NextResponse.json(formatted);
    }

    // Si NO existe, crearla con valores por defecto
    const now = FieldValue.serverTimestamp();
    const newAccount = {
      uid,
      email,
      status: 'active' as const,
      planId: 'FREE_5GB',
      limits: {
        storageBytes: FREE_STORAGE_BYTES,
      },
      enabledApps: {},
      paidUntil: null,
      trialEndsAt: null,
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    await accountRef.set(newAccount);

    // Leer el documento creado para obtener timestamps reales del servidor
    const createdDoc = await accountRef.get();
    const createdData = createdDoc.data();
    const formatted = formatAccountData(createdData, uid);

    return NextResponse.json(formatted);
  } catch (error: any) {
    // Manejar errores de autenticación específicos
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json(
        { error: 'Token expirado', code: 'AUTH_TOKEN_EXPIRED' },
        { status: 401 }
      );
    }

    if (error.code === 'auth/id-token-revoked') {
      return NextResponse.json(
        { error: 'Token revocado', code: 'AUTH_TOKEN_REVOKED' },
        { status: 401 }
      );
    }

    if (error.code === 'auth/argument-error') {
      return NextResponse.json(
        { error: 'Token malformado', code: 'AUTH_TOKEN_MALFORMED' },
        { status: 401 }
      );
    }

    // Error interno del servidor
    console.error('Error en ensure account:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
