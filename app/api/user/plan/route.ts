import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { findPlanById } from '@/lib/plans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = requireAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const userId = decoded.uid;

    const { planId, interval } = await request.json();
    if (!planId) {
      return NextResponse.json({ error: 'planId requerido' }, { status: 400 });
    }
    if (interval && interval !== 'monthly' && interval !== 'yearly') {
      return NextResponse.json({ error: 'interval inválido' }, { status: 400 });
    }

    const plan = await findPlanById(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
    }

    const db = requireAdminDb();
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const userData = userSnap.data() as any;
    const usedBytes = (userData.usedBytes || 0) + (userData.pendingBytes || 0);

    if (usedBytes > plan.quotaBytes) {
      return NextResponse.json({
        error: 'No puedes cambiar a un plan con menos espacio del que ya usas',
        details: {
          usedBytes,
          targetQuotaBytes: plan.quotaBytes,
        }
      }, { status: 409 });
    }

    await userRef.update({
      planQuotaBytes: plan.quotaBytes,
      planId: plan.planId,
      planInterval: interval || 'monthly',
      planUpdatedAt: new Date(),
    });

    return NextResponse.json({ success: true, planId: plan.planId, planQuotaBytes: plan.quotaBytes, planInterval: interval || 'monthly' });
  } catch (error) {
    logError(error, 'updating plan');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
