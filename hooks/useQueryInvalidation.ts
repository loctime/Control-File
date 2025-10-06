import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook para invalidar queries de manera segura
 * Maneja la invalidación de queries de React Query de forma centralizada
 */
export function useQueryInvalidation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidateFiles = (folderId: string | null = null) => {
    try {
      // Invalidar todas las queries de archivos
      queryClient.invalidateQueries({ queryKey: ['files'] });
      
      // Invalidar query específica de la carpeta
      if (user?.uid) {
        queryClient.invalidateQueries({ queryKey: ['files', user.uid, folderId] });
      }
      
      console.log('♻️ Queries invalidadas para actualizar UI', { folderId });
    } catch (error) {
      console.warn('⚠️ Error invalidando queries:', error);
    }
  };

  const invalidateAllFiles = () => {
    try {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      console.log('♻️ Todas las queries de archivos invalidadas');
    } catch (error) {
      console.warn('⚠️ Error invalidando todas las queries:', error);
    }
  };

  return {
    invalidateFiles,
    invalidateAllFiles
  };
}
