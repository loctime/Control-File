import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb, requireAdminAuth } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase/firestore';
import { createAuditLog, createChangeDiff } from '@/lib/platform/audit';
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

  // Verificar custom claim platform_owner o UID específico
  const isOwner = decoded.role === 'platform_owner' || decoded.uid === process.env.PLATFORM_OWNER_UID;
  if (!isOwner) {
    throw new Error('No autorizado: se requieren permisos de platform_owner');
  }

  return decoded.uid;
}

/**
 * GET /api/platform/accounts/[uid]
 * 
 * OWNER-ONLY: Obtener información de una cuenta
 * 
 * Requiere: custom claim platform_owner
 * NO usar desde apps regulares
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    await verifyPlatformOwner(request);
    const db = requireAdminDb();
    const accountRef = db.collection('platform').doc('accounts').collection('accounts').doc(params.uid);
    const accountSnap = await accountRef.get();

    if (!accountSnap.exists) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    return NextResponse.json(accountSnap.data());
  } catch (error: any) {
    console.error('Error obteniendo cuenta:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: error.message?.includes('autorizado') ? 401 : 500 }
    );
  }
}

/**
 * PATCH /api/platform/accounts/[uid]
 * 
 * OWNER-ONLY: Actualizar cuenta (acciones manuales)
 * 
 * Requiere: custom claim platform_owner
 * NO usar desde apps regulares
 * 
 * Acciones disponibles:
 * - suspend: Suspender cuenta
 * - activate: Activar cuenta
 * - change_plan: Cambiar plan
 * - update_apps: Actualizar apps habilitadas
 * - extend_paidUntil: Extender fecha de pago
 * - update_limits: Actualizar límites
 * - update_notes: Actualizar notas internas
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const performedBy = await verifyPlatformOwner(request);
    const db = requireAdminDb();
    const accountRef = db.collection('platform').doc('accounts').collection('accounts').doc(params.uid);
    const accountSnap = await accountRef.get();

    if (!accountSnap.exists) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    const currentAccount = accountSnap.data() as PlatformAccount;
    const body = await request.json();
    const { action, reason } = body;

    let updates: Partial<PlatformAccount> = {};
    let auditAction: string = 'account.update';

    switch (action) {
      case 'suspend':
        updates.status = 'suspended';
        auditAction = 'account.suspend';
        break;

      case 'activate':
        updates.status = 'active';
        auditAction = 'account.activate';
        break;

      case 'change_plan':
        if (!body.planId) {
          return NextResponse.json({ error: 'planId requerido' }, { status: 400 });
        }
        // Validar que el plan existe
        const planRef = db.collection('platform').doc('plans').collection('plans').doc(body.planId);
        const planSnap = await planRef.get();
        if (!planSnap.exists) {
          return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
        }
        updates.planId = body.planId;
        auditAction = 'account.plan_change';
        break;

      case 'update_apps':
        if (!body.enabledApps || typeof body.enabledApps !== 'object') {
          return NextResponse.json({ error: 'enabledApps requerido' }, { status: 400 });
        }
        updates.enabledApps = body.enabledApps;
        auditAction = 'account.apps_change';
        break;

      case 'extend_paidUntil':
        if (!body.paidUntil) {
          return NextResponse.json({ error: 'paidUntil requerido' }, { status: 400 });
        }
        updates.paidUntil = Timestamp.fromDate(new Date(body.paidUntil));
        auditAction = 'account.paidUntil_extend';
        break;

      case 'update_limits':
        if (!body.limits || typeof body.limits !== 'object') {
          return NextResponse.json({ error: 'limits requerido' }, { status: 400 });
        }
        updates.limits = body.limits;
        auditAction = 'account.limits_change';
        break;

      case 'update_notes':
        if (body.note === undefined) {
          return NextResponse.json({ error: 'note requerido' }, { status: 400 });
        }
        updates.metadata = {
          ...currentAccount.metadata,
          notes: body.note,
        };
        auditAction = 'account.notes_update';
        break;

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    // Aplicar actualización
    updates.updatedAt = Timestamp.now();
    await accountRef.update(updates);

    // Obtener cuenta actualizada para auditoría
    const updatedSnap = await accountRef.get();
    const updatedAccount = updatedSnap.data() as PlatformAccount;

    // Crear log de auditoría
    const changes = createChangeDiff(currentAccount, updatedAccount);
    await createAuditLog(
      auditAction as any,
      performedBy,
      changes,
      {
        targetUid: params.uid,
        reason,
      }
    );

    return NextResponse.json({ success: true, account: updatedAccount });
  } catch (error: any) {
    console.error('Error actualizando cuenta:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: error.message?.includes('autorizado') ? 401 : 500 }
    );
  }
}
