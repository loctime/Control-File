import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb, requireAdminAuth } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase/firestore';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';
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
 * GET /api/platform/plans
 * 
 * OWNER-ONLY: Listar todos los planes
 * 
 * Requiere: custom claim platform_owner
 * NOTA: Los planes son públicos para lectura (catálogo), pero este endpoint
 * es para gestión completa desde Owner Console
 */
export async function GET(request: NextRequest) {
  try {
    await verifyPlatformOwner(request);
    const db = requireAdminDb();
    const plansSnapshot = await db.collection('platform').doc('plans').collection('plans').get();

    const plans: PlatformPlan[] = [];
    plansSnapshot.forEach((doc: QueryDocumentSnapshot) => {
      plans.push(doc.data() as PlatformPlan);
    });

    return NextResponse.json({ plans });
  } catch (error: any) {
    console.error('Error listando planes:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: error.message?.includes('autorizado') ? 401 : 500 }
    );
  }
}

/**
 * POST /api/platform/plans
 * 
 * OWNER-ONLY: Crear un nuevo plan
 * 
 * Requiere: custom claim platform_owner
 * NO usar desde apps regulares
 */
export async function POST(request: NextRequest) {
  try {
    const performedBy = await verifyPlatformOwner(request);
    const db = requireAdminDb();
    const body = await request.json();

    const {
      planId,
      name,
      description,
      isActive = true,
      limits,
      apps,
      pricing,
      features = [],
    } = body;

    // Validaciones
    if (!planId || !name || !limits || !apps || !pricing) {
      return NextResponse.json(
        { error: 'Campos requeridos: planId, name, limits, apps, pricing' },
        { status: 400 }
      );
    }

    // Verificar que no existe
    const existingRef = db.collection('platform').doc('plans').collection('plans').doc(planId);
    const existingSnap = await existingRef.get();
    if (existingSnap.exists) {
      return NextResponse.json({ error: 'Plan ya existe' }, { status: 409 });
    }

    const now = Timestamp.now();
    const newPlan: PlatformPlan = {
      planId,
      name,
      description,
      isActive,
      limits,
      apps,
      pricing,
      features,
      createdAt: now,
      updatedAt: now,
    };

    await existingRef.set(newPlan);

    // Auditoría
    await createAuditLog(
      'plan.create',
      performedBy,
      { before: {}, after: newPlan },
      { reason: `Plan creado: ${name}` }
    );

    return NextResponse.json({ success: true, plan: newPlan });
  } catch (error: any) {
    console.error('Error creando plan:', error);
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
    const { reason } = body;

    const updates: Partial<PlatformPlan> = {
      ...body,
      updatedAt: Timestamp.now(),
    };

    // Remover campos que no deben actualizarse
    delete (updates as any).planId;
    delete (updates as any).createdAt;

    await planRef.update(updates);

    const updatedSnap = await planRef.get();
    const updatedPlan = updatedSnap.data() as PlatformPlan;

    // Auditoría
    const changes = createChangeDiff(currentPlan, updatedPlan);
    await createAuditLog(
      'plan.update',
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
