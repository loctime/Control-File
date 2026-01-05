import plansConfig from '@/config/plans.json';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PlatformPlan } from '@/lib/platform/plans';

export type Plan = {
  planId: string;
  name: string;
  quotaBytes: number;
  price: number;
  yearlyPrice?: number;
};

export type PlansCatalog = {
  currency: string;
  billingInterval: 'monthly' | 'yearly';
  intervals?: Array<'monthly' | 'yearly'>;
  free: Plan;
  plans: Plan[];
};

let cachedCatalog: PlansCatalog | null = null;
let cachedPlatformPlans: PlatformPlan[] | null = null;

/**
 * Convierte PlatformPlan a Plan (formato legacy)
 */
function convertPlatformPlanToPlan(platformPlan: PlatformPlan): Plan {
  return {
    planId: platformPlan.planId,
    name: platformPlan.name,
    quotaBytes: platformPlan.limits.storageBytes,
    price: platformPlan.pricing.monthly,
    yearlyPrice: platformPlan.pricing.yearly,
  };
}

/**
 * Intenta cargar planes desde Firestore platform/plans
 */
async function loadPlansFromFirestore(): Promise<PlatformPlan[] | null> {
  if (!db || typeof window === 'undefined') {
    return null; // No disponible en servidor o sin db
  }

  try {
    // Estructura: platform (documento) -> plans (subcolección)
    const plansSnapshot = await getDocs(collection(db, 'platform', 'plans'));
    const plans: PlatformPlan[] = [];
    
    plansSnapshot.forEach((docSnap) => {
      const data = docSnap.data() as PlatformPlan;
      plans.push(data);
    });

    if (plans.length > 0) {
      cachedPlatformPlans = plans;
      return plans;
    }
  } catch (error) {
    console.warn('No se pudieron cargar planes desde Firestore, usando fallback:', error);
  }

  return null;
}

/**
 * Obtiene el catálogo de planes, intentando desde Firestore primero
 */
export async function getPlansCatalog(): Promise<PlansCatalog> {
  // Si ya está cacheado, retornar
  if (cachedCatalog) {
    return cachedCatalog;
  }

  // Intentar cargar desde Firestore
  const platformPlans = await loadPlansFromFirestore();
  
  if (platformPlans && platformPlans.length > 0) {
    // Convertir PlatformPlan[] a PlansCatalog
    const freePlan = platformPlans.find(p => p.planId === 'FREE_5GB');
    const paidPlans = platformPlans.filter(p => p.planId !== 'FREE_5GB');

    if (freePlan) {
      cachedCatalog = {
        currency: freePlan.pricing.currency,
        billingInterval: 'monthly',
        intervals: ['monthly', 'yearly'],
        free: convertPlatformPlanToPlan(freePlan),
        plans: paidPlans.map(convertPlatformPlanToPlan),
      };
      return cachedCatalog;
    }
  }

  // Fallback a config/plans.json
  cachedCatalog = plansConfig as PlansCatalog;
  return cachedCatalog;
}

/**
 * Versión síncrona (para compatibilidad con código existente)
 * Usa cache si está disponible, sino fallback a JSON
 */
export function getPlansCatalogSync(): PlansCatalog {
  if (cachedCatalog) {
    return cachedCatalog;
  }
  return plansConfig as PlansCatalog;
}

export async function getAllPlans(): Promise<Plan[]> {
  const catalog = await getPlansCatalog();
  return [catalog.free, ...catalog.plans];
}

export function getAllPlansSync(): Plan[] {
  const catalog = getPlansCatalogSync();
  return [catalog.free, ...catalog.plans];
}

export async function findPlanById(planId: string): Promise<Plan | undefined> {
  const catalog = await getPlansCatalog();
  if (catalog.free.planId === planId) return catalog.free;
  return catalog.plans.find(p => p.planId === planId);
}

export function findPlanByIdSync(planId: string): Plan | undefined {
  const catalog = getPlansCatalogSync();
  if (catalog.free.planId === planId) return catalog.free;
  return catalog.plans.find(p => p.planId === planId);
}

export function getDefaultFreeQuotaBytes(): number {
  return getPlansCatalogSync().free.quotaBytes;
}

export function formatPrice(price: number, currency = getPlansCatalogSync().currency): string {
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  return formatter.format(price);
}

export type BillingInterval = 'monthly' | 'yearly';

export function getPlanPrice(plan: Plan, interval: BillingInterval = getPlansCatalogSync().billingInterval): number {
  if (interval === 'yearly') {
    return plan.yearlyPrice ?? plan.price * 12;
  }
  return plan.price;
}

export function getRecommendedUpsells(currentQuotaBytes: number): Plan[] {
  const catalog = getPlansCatalogSync();
  const ordered = [...catalog.plans].sort((a, b) => a.quotaBytes - b.quotaBytes);
  return ordered.filter(p => p.quotaBytes > currentQuotaBytes).slice(0, 3);
}
