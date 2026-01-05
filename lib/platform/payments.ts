import { Timestamp } from 'firebase/firestore';

/**
 * Estado de un pago
 */
export type PlatformPaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

/**
 * Gateway de pago (opcional en Fase 1)
 */
export type PlatformPaymentGateway = 'stripe' | 'manual' | string;

/**
 * Intervalo de facturación
 */
export type PlatformPaymentInterval = 'monthly' | 'yearly';

/**
 * Documento platform/payments/{paymentId}
 * 
 * Responsabilidad: Historial y trazabilidad de pagos
 * 
 * NOTA: En Fase 1, payments solo registra hechos.
 * No activa automáticamente cuentas ni extiende paidUntil.
 * 
 * ESTRUCTURA FUTURA: Posible subcolección platform/accounts/{uid}/payments/{paymentId}
 * Por ahora mantener estructura plana con índices eficientes (uid + createdAt)
 */
export interface PlatformPayment {
  paymentId: string; // ID único (document ID, puede ser UUID)
  uid: string; // Usuario que pagó
  planId: string; // Plan comprado
  amount: number; // Monto pagado
  currency: string; // Default: 'USD'
  interval: PlatformPaymentInterval;
  status: PlatformPaymentStatus;
  gateway?: PlatformPaymentGateway; // 'stripe', 'manual', etc. (opcional en Fase 1)
  gatewayTransactionId?: string; // ID de transacción del gateway
  paidUntil: Timestamp | null; // Hasta cuándo extiende el pago
  createdAt: Timestamp;
  completedAt?: Timestamp;
  metadata?: Record<string, any>; // Datos adicionales del gateway
}

/**
 * Helper para verificar si un pago está activo
 */
export function isPaymentActive(payment: PlatformPayment): boolean {
  return payment.status === 'completed';
}

/**
 * Helper para verificar si un pago está pendiente
 */
export function isPaymentPending(payment: PlatformPayment): boolean {
  return payment.status === 'pending';
}
