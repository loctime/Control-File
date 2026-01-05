import { Timestamp } from 'firebase/firestore';

/**
 * Estado de cuenta platform
 * 
 * REGLA CRÍTICA: enabledApps y limits son overrides opcionales.
 * Las apps DEBEN resolver valores efectivos contra plan:
 * - effectiveEnabledApps = account.enabledApps ?? plan.apps
 * - effectiveLimits = account.limits ?? plan.limits
 */
export type PlatformAccountStatus = 'active' | 'suspended' | 'trial' | 'expired' | 'warning';

export interface PlatformAccountEnabledApps {
  controlfile?: boolean;
  controlaudit?: boolean;
  controldoc?: boolean;
  // Futuras apps se agregan aquí
}

export interface PlatformAccountLimits {
  storageBytes?: number;
  // Otros límites por app si necesario
}

export interface PlatformAccountMetadata {
  notes?: string;
  /**
   * Flags operativos internos (NO son contrato)
   * Las apps NO deben depender de flags para lógica de negocio
   * Solo para uso interno del owner/backend
   */
  flags?: Record<string, any>;
}

/**
 * Documento platform/accounts/{uid}
 * 
 * Responsabilidad: Estado comercial del cliente (una sola fuente de verdad)
 */
export interface PlatformAccount {
  uid: string; // Firebase Auth UID (document ID)
  status: PlatformAccountStatus;
  planId: string; // Referencia a platform/plans/{planId}
  
  /**
   * Override explícito de apps (opcional)
   * Si no existe, usar plan.apps como default
   */
  enabledApps?: PlatformAccountEnabledApps;
  
  /**
   * Override explícito de límites (opcional)
   * Si no existe, usar plan.limits como default
   */
  limits?: PlatformAccountLimits;
  
  paidUntil: Timestamp | null; // Hasta cuándo está pagado (null = trial/free)
  trialEndsAt: Timestamp | null; // Fin de trial (si aplica)
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata: PlatformAccountMetadata;
}

/**
 * Helpers para validar estados
 * 
 * REGLA: Las apps NO deben inferir por nombre, deben usar estos helpers explícitos
 */
export function canWrite(account: PlatformAccount): boolean {
  return account.status === 'active' || account.status === 'trial' || account.status === 'warning';
}

export function canRead(account: PlatformAccount): boolean {
  return account.status !== 'suspended';
}

/**
 * Resuelve valores efectivos de enabledApps
 * account.enabledApps es override, plan.apps es default
 */
export function resolveEffectiveEnabledApps(
  account: PlatformAccount | null,
  planApps: PlatformPlanApps | null
): PlatformAccountEnabledApps {
  if (account?.enabledApps) {
    return account.enabledApps;
  }
  return planApps || {};
}

/**
 * Resuelve valores efectivos de limits
 * account.limits es override, plan.limits es default
 */
export function resolveEffectiveLimits(
  account: PlatformAccount | null,
  planLimits: PlatformPlanLimits | null
): PlatformAccountLimits {
  if (account?.limits) {
    return account.limits;
  }
  return planLimits || {};
}

// Importar tipos de plan para resolver valores efectivos
import type { PlatformPlanApps, PlatformPlanLimits } from './plans';

// Re-exportar para uso externo
export type { PlatformPlanApps, PlatformPlanLimits };
