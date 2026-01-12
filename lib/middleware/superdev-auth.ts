/**
 * Middleware de autenticación para endpoints Superdev
 * 
 * Utilidad compartida para validar custom claim superdev: true
 * en endpoints exclusivos para desarrolladores.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth } from '@/lib/firebase-admin';

export interface SuperdevInfo {
  uid: string;
  email?: string;
}

/**
 * Verifica que el usuario tenga permisos de superdev
 * 
 * @param request - Request de Next.js
 * @returns Información del superdev (uid y email)
 * @throws Error si no está autorizado o no tiene permisos
 */
export async function verifySuperdev(request: NextRequest): Promise<SuperdevInfo> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No autorizado: token requerido');
  }

  const token = authHeader.split('Bearer ')[1];
  const adminAuth = requireAdminAuth();
  const decoded = await adminAuth.verifyIdToken(token);

  // Verificar custom claim superdev
  if (decoded.superdev !== true) {
    throw new Error('No autorizado: se requieren permisos de superdev');
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
  };
}
