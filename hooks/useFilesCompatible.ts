// hooks/useFilesCompatible.ts
// Hook de compatibilidad que mantiene la API existente pero usa TanStack Query internamente

import { useFiles as useOptimizedFiles } from './useFiles';
import { useDriveStore } from '@/lib/stores/drive';
import { useMemo } from 'react';

export function useFilesCompatible(folderId: string | null = null) {
  // Usar el hook optimizado internamente
  const optimizedFiles = useOptimizedFiles(folderId);
  
  // Mantener compatibilidad con el store de Zustand
  const { setItems, items } = useDriveStore();

  // Sincronizar datos con el store para mantener compatibilidad
  // COMENTADO TEMPORALMENTE PARA EVITAR BUCLES INFINITOS
  // useMemo(() => {
  //   if (optimizedFiles.files.length > 0) {
  //     setItems(optimizedFiles.files);
  //   }
  // }, [optimizedFiles.files, setItems]);

  // Filtrar archivos que fueron movidos a papelera (compatibilidad con código existente)
  const visibleFiles = useMemo(() => {
    const deletedIds = new Set(items.filter((i: any) => i.deletedAt).map((i: any) => i.id));
    return optimizedFiles.files.filter((it: any) => it.type === 'file' && !deletedIds.has(it.id));
  }, [optimizedFiles.files, items]);

  // Retornar API compatible con el código existente
  return {
    // Datos principales (compatibles)
    files: visibleFiles,
    loading: optimizedFiles.isLoading,
    error: optimizedFiles.error,
    
    // Mutations (compatibles)
    createFolder: optimizedFiles.createFolder,
    deleteItems: optimizedFiles.deleteItems,
    renameItem: optimizedFiles.renameItem,
    moveItems: optimizedFiles.moveItems,
    
    // Funciones adicionales (nuevas)
    refetch: optimizedFiles.refetch,
    invalidate: optimizedFiles.invalidate,
    
    // Estados adicionales (nuevos)
    isFetching: optimizedFiles.isFetching,
    isMutating: optimizedFiles.isMutating,
    isError: optimizedFiles.isError,
    isSuccess: optimizedFiles.isSuccess,
    
    // Datos completos (nuevos)
    allFiles: optimizedFiles.files,
    folders: optimizedFiles.files.filter(f => f.type === 'folder'),
    fileItems: optimizedFiles.files.filter(f => f.type === 'file'),
  };
}
