import { createAuditLog, type PlatformAuditAction } from '@/lib/platform/audit';
import type { FeedbackDocument, UpdateFeedbackPayload } from './types';

/**
 * Crea un log de auditoría específico para feedback
 * Wrapper sobre el sistema de auditoría global
 */
export async function createFeedbackAuditLog(
  action: 'feedback.created' | 'feedback.updated' | 'feedback.deleted',
  userId: string,
  feedbackId: string,
  changes?: {
    before?: Partial<FeedbackDocument>;
    after?: Partial<FeedbackDocument | UpdateFeedbackPayload>;
  },
  options?: {
    targetUid?: string;
    reason?: string;
  }
): Promise<void> {
  await createAuditLog(
    action as PlatformAuditAction,
    userId,
    {
      before: changes?.before || {},
      after: changes?.after || {},
    },
    {
      targetUid: options?.targetUid,
      reason: options?.reason,
    }
  );
}
