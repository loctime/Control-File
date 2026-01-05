import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb, requireAdminAuth } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase/firestore';
import { createAuditLog } from '@/lib/platform/audit';
import type { PlatformPayment } from '@/lib/platform/payments';

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
 * GET /api/platform/payments
 * 
 * OWNER-ONLY: Listar pagos con filtros opcionales
 * 
 * Requiere: custom claim platform_owner
 * NOTA: Los usuarios pueden leer sus propios pagos, pero este endpoint
 * permite listar todos los pagos desde Owner Console
 */
export async function GET(request: NextRequest) {
  try {
    await verifyPlatformOwner(request);
    const db = requireAdminDb();
    const { searchParams } = new URL(request.url);

    const uid = searchParams.get('uid');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const startAfter = searchParams.get('startAfter');

    let query = db.collection('platform').doc('payments').collection('payments')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (uid) {
      query = query.where('uid', '==', uid) as any;
    }

    if (status) {
      query = query.where('status', '==', status) as any;
    }

    if (startAfter) {
      const startAfterDoc = await db.collection('platform').doc('payments').collection('payments').doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc) as any;
      }
    }

    const paymentsSnapshot = await query.get();

    const payments: PlatformPayment[] = [];
    paymentsSnapshot.forEach((doc) => {
      payments.push(doc.data() as PlatformPayment);
    });

    return NextResponse.json({
      payments,
      total: payments.length,
      hasMore: payments.length === limit,
    });
  } catch (error: any) {
    console.error('Error listando pagos:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: error.message?.includes('autorizado') ? 401 : 500 }
    );
  }
}

/**
 * POST /api/platform/payments
 * Crear un pago manual (para pagos fuera de gateway)
 */
export async function POST(request: NextRequest) {
  try {
    const performedBy = await verifyPlatformOwner(request);
    const db = requireAdminDb();
    const body = await request.json();

    const {
      uid,
      planId,
      amount,
      currency = 'USD',
      interval = 'monthly',
      status = 'completed',
      gateway = 'manual',
      paidUntil,
      metadata,
    } = body;

    // Validaciones
    if (!uid || !planId || !amount) {
      return NextResponse.json(
        { error: 'Campos requeridos: uid, planId, amount' },
        { status: 400 }
      );
    }

    const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Timestamp.now();

    const newPayment: PlatformPayment = {
      paymentId,
      uid,
      planId,
      amount,
      currency,
      interval,
      status,
      gateway,
      paidUntil: paidUntil ? Timestamp.fromDate(new Date(paidUntil)) : null,
      createdAt: now,
      completedAt: status === 'completed' ? now : undefined,
      metadata,
    };

    await db.collection('platform').doc('payments').collection('payments').doc(paymentId).set(newPayment);

    // Auditoría
    await createAuditLog(
      'payment.create',
      performedBy,
      { before: {}, after: newPayment },
      { targetUid: uid, reason: `Pago manual creado: $${amount} ${currency}` }
    );

    return NextResponse.json({ success: true, payment: newPayment });
  } catch (error: any) {
    console.error('Error creando pago:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: error.message?.includes('autorizado') ? 401 : 500 }
    );
  }
}
