import { useEffect, useState, useMemo } from 'react';
import { doc, onSnapshot, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PlatformAccount, PlatformPlan } from '@/lib/platform/accounts';
import { resolveEffectiveEnabledApps, resolveEffectiveLimits, canWrite, canRead } from '@/lib/platform/accounts';
import type { PlatformPlanApps, PlatformPlanLimits } from '@/lib/platform/plans';

/**
 * Hook para consumir platform/accounts en modo read-only desde apps
 * 
 * REGLAS CRÍTICAS:
 * - Estructura correcta: platform/accounts/{uid} (colección plana)
 * - Si cuenta no existe: bloquear acceso (NO crear desde frontend)
 * - Resolver valores efectivos: effectiveEnabledApps y effectiveLimits contra plan
 */
export function usePlatformAccount(userId: string | null | undefined) {
  const [account, setAccount] = useState<PlatformAccount | null>(null);
  const [plan, setPlan] = useState<PlatformPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notProvisioned, setNotProvisioned] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId || !db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotProvisioned(false);
    setError(null);

    // CORRECTO: Leer directo de la colección platform/accounts/{uid}
    // Estructura: platform (documento) -> accounts (subcolección) -> {uid} (documento)
    const accountRef = doc(db, 'platform', 'accounts', userId);
    
    const unsubscribeAccount = onSnapshot(
      accountRef,
      async (snap) => {
        if (!snap.exists()) {
          // ❌ PROHIBIDO: crear cuenta desde frontend
          // ✅ CORRECTO: bloquear acceso y mostrar mensaje
          setNotProvisioned(true);
          setAccount(null);
          setPlan(null);
          setLoading(false);
          return;
        }

        try {
          const accountData = snap.data() as PlatformAccount;
          setAccount(accountData);

          // Leer plan para resolver valores efectivos
          if (accountData.planId) {
            const planRef = doc(db, 'platform', 'plans', accountData.planId);
            const planSnap = await getDoc(planRef);
            if (planSnap.exists()) {
              setPlan(planSnap.data() as PlatformPlan);
            } else {
              console.warn(`Plan ${accountData.planId} no encontrado`);
              setPlan(null);
            }
          }

          setLoading(false);
        } catch (err) {
          console.error('Error procesando account:', err);
          setError(err instanceof Error ? err : new Error('Error desconocido'));
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error en snapshot de account:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeAccount();
    };
  }, [userId]);

  // Resolver valores efectivos usando helpers
  const effectiveEnabledApps = useMemo(() => {
    return resolveEffectiveEnabledApps(account, plan?.apps || null);
  }, [account, plan]);

  const effectiveLimits = useMemo(() => {
    return resolveEffectiveLimits(account, plan?.limits || null);
  }, [account, plan]);

  // Helpers de permisos
  const canWriteAccount = useMemo(() => {
    return account ? canWrite(account) : false;
  }, [account]);

  const canReadAccount = useMemo(() => {
    return account ? canRead(account) : false;
  }, [account]);

  return {
    account,
    plan,
    effectiveEnabledApps,
    effectiveLimits,
    canWrite: canWriteAccount,
    canRead: canReadAccount,
    loading,
    notProvisioned,
    error,
  };
}
