import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb, requireAdminAuth } from '@/lib/firebase-admin';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { PlatformAccount } from '@/lib/platform/accounts';

export const runtime = 'nodejs';

/**
 * OWNER-ONLY ENDPOINT
 * 
 * Este endpoint es EXCLUSIVO para usuarios con custom claim platform_owner.
 * NO debe ser usado por apps regulares.
 * 
 * Verificar si el usuario tiene permisos de platform_owner
 */
async function verifyPlatformOwner(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No autorizado');
  }

  const token = authHeader.split('Bearer ')[1];
  const adminAuth = requireAdminAuth();
  const decoded = await adminAuth.verifyIdToken(token);

  const isOwner = decoded.role === 'platform_owner' || decoded.uid === process.env.PLATFORM_OWNER_UID;
  if (!isOwner) {
    throw new Error('No autorizado: se requieren permisos de platform_owner');
  }

  return decoded.uid;
}

/**
 * GET /api/platform/accounts
 * 
 * OWNER-ONLY: Listar todas las cuentas con filtros opcionales
 * 
 * Requiere: custom claim platform_owner
 * NO usar desde apps regulares
 */
export async function GET(request: NextRequest) {
  try {
    await verifyPlatformOwner(request);
    const db = requireAdminDb();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = db.collection('platform').doc('accounts').collection('accounts')
      .limit(limit);

    if (status) {
      query = query.where('status', '==', status) as any;
    }

    const accountsSnapshot = await query.get();

    const accounts: PlatformAccount[] = [];
    accountsSnapshot.forEach((doc: QueryDocumentSnapshot) => {
      accounts.push(doc.data() as PlatformAccount);
    });

    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error('Error listando cuentas:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: error.message?.includes('autorizado') ? 401 : 500 }
    );
  }
}
