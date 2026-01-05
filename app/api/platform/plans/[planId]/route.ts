import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb, requireAdminAuth } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase/firestore';
import { createAuditLog, createChangeDiff } from '@/lib/platform/audit';
import type { PlatformPlan } from '@/lib/platform/plans';

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
 * GET /api/platform/plans/[planId]
 * Obtener un plan específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    await verifyPlatformOwner(request);
    const db = requireAdminDb();
    const planRef = db.collection('platform').doc('plans').collection('plans').doc(params.planId);
    const planSnap = await planRef.get();

    if (!planSnap.exists) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    return NextResponse.json(planSnap.data());
  } catch (error: any) {
    console.error('Error obteniendo plan:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: error.message?.includes('autorizado') ? 401 : 500 }
    );
  }
}

/**
 * PATCH /api/platform/plans/[planId]
 * Actualizar un plan existente
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const performedBy = await verifyPlatformOwner(request);
    const db = requireAdminDb();
    const planRef = db.collection('platform').doc('plans').collection('plans').doc(params.planId);
    const planSnap = await planRef.get();

    if (!planSnap.exists) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    const currentPlan = planSnap.data() as PlatformPlan;
    const body = await request.json();
    const { reason, action } = body;

    let updates: Partial<PlatformPlan> = {
      updatedAt: Timestamp.now(),
    };

    if (action === 'deactivate') {
      updates.isActive = false;
    } else if (action === 'activate') {
      updates.isActive = true;
    } else {
      // Actualización parcial
      Object.assign(updates, body);
      delete (updates as any).planId;
      delete (updates as any).createdAt;
    }

    await planRef.update(updates);

    const updatedSnap = await planRef.get();
    const updatedPlan = updatedSnap.data() as PlatformPlan;

    // Auditoría
    const changes = createChangeDiff(currentPlan, updatedPlan);
    await createAuditLog(
      action === 'deactivate' ? 'plan.deactivate' : 'plan.update',
      performedBy,
      changes,
      { reason }
    );

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (error: any) {
    console.error('Error actualizando plan:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: error.message?.includes('autorizado') ? 401 : 500 }
    );
  }
}
