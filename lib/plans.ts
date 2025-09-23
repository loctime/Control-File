import plansConfig from '@/config/plans.json';

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

export function getPlansCatalog(): PlansCatalog {
  if (!cachedCatalog) {
    cachedCatalog = plansConfig as PlansCatalog;
  }
  return cachedCatalog;
}

export function getAllPlans(): Plan[] {
  const catalog = getPlansCatalog();
  return [catalog.free, ...catalog.plans];
}

export function findPlanById(planId: string): Plan | undefined {
  const catalog = getPlansCatalog();
  if (catalog.free.planId === planId) return catalog.free;
  return catalog.plans.find(p => p.planId === planId);
}

export function getDefaultFreeQuotaBytes(): number {
  return getPlansCatalog().free.quotaBytes;
}

export function formatPrice(price: number, currency = getPlansCatalog().currency): string {
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  return formatter.format(price);
}

export type BillingInterval = 'monthly' | 'yearly';

export function getPlanPrice(plan: Plan, interval: BillingInterval = getPlansCatalog().billingInterval): number {
  if (interval === 'yearly') {
    return plan.yearlyPrice ?? plan.price * 12;
  }
  return plan.price;
}

export function getRecommendedUpsells(currentQuotaBytes: number): Plan[] {
  const catalog = getPlansCatalog();
  const ordered = [...catalog.plans].sort((a, b) => a.quotaBytes - b.quotaBytes);
  return ordered.filter(p => p.quotaBytes > currentQuotaBytes).slice(0, 3);
}
