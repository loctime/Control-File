/**
 * Capa explícita de resolución de estado para PlatformAccount
 * 
 * Responsabilidad ÚNICA: Resolver valores efectivos desde account + plan
 * 
 * REGLAS CRÍTICAS:
 * - La UI NO debe inferir nada por nombre de estado
 * - Siempre usar estos helpers explícitos
 * - NO duplicar esta lógica en componentes
 */

import type { PlatformAccount, PlatformAccountEnabledApps, PlatformAccountLimits } from './accounts';
import type { PlatformPlan, PlatformPlanApps, PlatformPlanLimits } from './plans';
import { canRead, canWrite } from './accounts';

/**
 * Estado resuelto de una cuenta platform
 * Contiene todos los valores efectivos listos para usar en UI
 */
export interface ResolvedAccountState {
  // Datos base
  account: PlatformAccount;
  plan: PlatformPlan | null;
  
  // Valores efectivos resueltos
  effectiveEnabledApps: PlatformAccountEnabledApps;
  effectiveLimits: PlatformAccountLimits;
  
  // Permisos resueltos (NO inferir por nombre de estado)
  canRead: boolean;
  canWrite: boolean;
  
  // Datos de presentación resueltos
  planDisplayName: string; // plan.name si existe, sino planId
  enabledAppsList: string[]; // Lista de apps habilitadas para mostrar
}

/**
 * Resuelve el estado completo de una cuenta platform
 * 
 * @param account - Cuenta platform (requerido)
 * @param plan - Plan asociado (opcional, si no existe se usan valores por defecto)
 * @returns Estado resuelto listo para usar en UI
 */
export function resolveAccountState(
  account: PlatformAccount,
  plan: PlatformPlan | null
): ResolvedAccountState {
  // Resolver enabledApps: account.enabledApps ?? plan.apps
  const effectiveEnabledApps: PlatformAccountEnabledApps = account.enabledApps ?? plan?.apps ?? {};
  
  // Resolver limits: account.limits ?? plan.limits
  const effectiveLimits: PlatformAccountLimits = account.limits ?? plan?.limits ?? {};
  
  // Resolver permisos usando helpers explícitos (NO inferir por nombre)
  const resolvedCanRead = canRead(account);
  const resolvedCanWrite = canWrite(account);
  
  // Resolver nombre de plan para presentación
  const planDisplayName = plan?.name || account.planId;
  
  // Resolver lista de apps habilitadas para presentación
  const enabledAppsList = Object.entries(effectiveEnabledApps)
    .filter(([_, enabled]) => enabled === true)
    .map(([app]) => app);
  
  return {
    account,
    plan,
    effectiveEnabledApps,
    effectiveLimits,
    canRead: resolvedCanRead,
    canWrite: resolvedCanWrite,
    planDisplayName,
    enabledAppsList,
  };
}

/**
 * Resuelve múltiples cuentas en batch
 * Útil para Owner Console que muestra listas
 */
export function resolveAccountStates(
  accounts: PlatformAccount[],
  plansMap: Map<string, PlatformPlan>
): ResolvedAccountState[] {
  return accounts.map(account => {
    const plan = plansMap.get(account.planId) || null;
    return resolveAccountState(account, plan);
  });
}
