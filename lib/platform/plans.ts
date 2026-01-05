import { Timestamp } from 'firebase/firestore';

/**
 * Apps incluidas en un plan
 */
export interface PlatformPlanApps {
  controlfile: boolean;
  controlaudit: boolean;
  controldoc: boolean;
  // Futuras apps se agregan aquí
}

/**
 * Límites de un plan
 */
export interface PlatformPlanLimits {
  storageBytes: number;
  // Otros límites globales
}

/**
 * Precios de un plan
 */
export interface PlatformPlanPricing {
  monthly: number; // Precio mensual en USD
  yearly: number; // Precio anual en USD (opcional)
  currency: string; // Default: 'USD'
}

/**
 * Documento platform/plans/{planId}
 * 
 * Responsabilidad: Definición de planes (separada de accounts para flexibilidad)
 */
export interface PlatformPlan {
  planId: string; // ID único (document ID)
  name: string; // Nombre comercial
  description?: string;
  isActive: boolean; // Si está disponible para nuevos usuarios
  limits: PlatformPlanLimits;
  apps: PlatformPlanApps; // Apps incluidas en este plan
  pricing: PlatformPlanPricing;
  features: string[]; // Lista de features incluidas
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Helper para obtener precio según intervalo
 */
export function getPlanPrice(plan: PlatformPlan, interval: 'monthly' | 'yearly'): number {
  if (interval === 'yearly') {
    return plan.pricing.yearly;
  }
  return plan.pricing.monthly;
}

/**
 * Helper para formatear precio
 */
export function formatPlanPrice(plan: PlatformPlan, interval: 'monthly' | 'yearly'): string {
  const price = getPlanPrice(plan, interval);
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: plan.pricing.currency,
  });
  return formatter.format(price);
}
