import { Timestamp } from 'firebase/firestore';
import { requireAdminDb } from '@/lib/firebase-admin';

// Generar ID único para auditoría
function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Tipos de acciones auditables
 */
export type PlatformAuditAction =
  | 'account.suspend'
  | 'account.activate'
  | 'account.plan_change'
  | 'account.apps_change'
  | 'account.paidUntil_extend'
  | 'account.limits_change'
  | 'account.notes_update'
  | 'plan.create'
  | 'plan.update'
  | 'plan.deactivate'
  | 'payment.create'
  | 'payment.update'
  | string; // Permitir acciones custom

/**
 * Documento platform/audit/{auditId}
 */
export interface PlatformAuditLog {
  auditId: string;
  action: PlatformAuditAction;
  targetUid?: string; // UID afectado (si aplica)
  performedBy: string; // UID del owner/backend
  changes: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  reason?: string; // Motivo del cambio
  createdAt: Timestamp;
}

/**
 * Crea un log de auditoría
 */
export async function createAuditLog(
  action: PlatformAuditAction,
  performedBy: string,
  changes: { before: Record<string, any>; after: Record<string, any> },
  options?: {
    targetUid?: string;
    reason?: string;
  }
): Promise<void> {
  const db = requireAdminDb();
  const auditId = generateAuditId();
  const now = Timestamp.now();

  const auditLog: PlatformAuditLog = {
    auditId,
    action,
    performedBy,
    changes,
    createdAt: now,
    ...options,
  };

  await db.collection('platform').doc('audit').collection('audit').doc(auditId).set(auditLog);
}

/**
 * Helper para crear diff de cambios
 */
export function createChangeDiff<T extends Record<string, any>>(
  before: T,
  after: T
): { before: Record<string, any>; after: Record<string, any> } {
  const changes: { before: Record<string, any>; after: Record<string, any> } = {
    before: {},
    after: {},
  };

  // Encontrar campos que cambiaron
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeValue = before[key];
    const afterValue = after[key];

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes.before[key] = beforeValue;
      changes.after[key] = afterValue;
    }
  }

  return changes;
}
