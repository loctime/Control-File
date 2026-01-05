/**
 * Verificación de permisos platform_owner
 * 
 * Utilidad para validar custom claim platform_owner en cliente
 * NO confiar solo en autenticación, debe validar el claim explícitamente
 */

import { auth } from '@/lib/firebase';

/**
 * Verifica si el usuario actual tiene el custom claim platform_owner
 * 
 * REGLA: Solo validar el custom claim 'role === platform_owner'
 * NO usar UID específico en cliente (eso es solo para backend)
 * 
 * @returns true si tiene permisos, false si no
 */
export async function verifyPlatformOwnerClaim(): Promise<boolean> {
  if (!auth?.currentUser) {
    return false;
  }

  try {
    // Force refresh para obtener claims actualizados
    const token = await auth.currentUser.getIdToken(true);
    const decoded = JSON.parse(atob(token.split('.')[1]));
    
    // Verificar SOLO custom claim platform_owner
    // El UID específico se valida solo en backend
    const hasClaim = decoded.role === 'platform_owner';
    
    return hasClaim;
  } catch (error) {
    console.error('Error verificando platform_owner claim:', error);
    return false;
  }
}

/**
 * Hook helper para verificar permisos (para usar en componentes)
 */
export async function checkPlatformOwnerAccess(): Promise<{ hasAccess: boolean; error?: string }> {
  if (!auth?.currentUser) {
    return { hasAccess: false, error: 'No autenticado' };
  }

  const hasAccess = await verifyPlatformOwnerClaim();
  
  if (!hasAccess) {
    return { hasAccess: false, error: 'Acceso denegado: se requieren permisos de platform_owner' };
  }

  return { hasAccess: true };
}
