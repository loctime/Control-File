import { useEffect, useMemo } from 'react';
import { useDriveStore } from '@/lib/stores/drive';

/**
 * Fusiona los archivos cargados del folder actual con el árbol global del store,
 * preservando flags importantes (p.ej. papelera) y evitando re-render loops.
 */
export function useMergeCurrentFolderItems(files: any[] | undefined, currentFolderId: string | null | undefined, isLoading?: boolean) {
  const { setItems } = useDriveStore();

  const memoizedFiles = useMemo(() => files || [], [files]);

  useEffect(() => {
    // Evitar borrar datos del store mientras la carpeta está cargando para prevenir parpadeos/estado vacío
    if (isLoading) return;
    if (memoizedFiles.length >= 0) {
      const currentItems = useDriveStore.getState().items;
      
      // Debug: Log para entender qué está pasando
      console.log('🔄 useMergeCurrentFolderItems - Fusionando items:', {
        currentFolderId,
        filesCount: memoizedFiles.length,
        currentItemsCount: currentItems.length,
        files: memoizedFiles.map(f => ({ id: f.id, name: f.name, type: f.type, parentId: f.parentId }))
      });

      const existingById = new Map(currentItems.map((i: any) => [i.id, i]));

      const incomingMerged = memoizedFiles.map((f: any) => {
        const prev: any = existingById.get(f.id);
        if (!prev) return f;
        const preserved: any = {
          deletedAt: prev.deletedAt,
          expiresAt: prev.expiresAt,
          originalPath: prev.originalPath ?? prev.path,
        };
        return { ...f, ...preserved };
      });

      const incomingIds = new Set(incomingMerged.map((i: any) => i.id));

      const base = currentItems.filter((it: any) => {
        const belongsToCurrent = it.parentId === currentFolderId;
        const isTrashed = !!it.deletedAt;
        // NO eliminar carpetas que pertenecen a la carpeta actual
        // Solo mantener elementos que NO pertenecen a la carpeta actual O están en la papelera
        return !belongsToCurrent || isTrashed;
      });

      const baseWithoutIncoming = base.filter((it: any) => !incomingIds.has(it.id));

      const nextItems = [...baseWithoutIncoming, ...incomingMerged];

      // Debug: Log del resultado final
      console.log('🔄 useMergeCurrentFolderItems - Resultado:', {
        baseCount: baseWithoutIncoming.length,
        incomingCount: incomingMerged.length,
        nextItemsCount: nextItems.length,
        nextItems: nextItems.map(i => ({ id: i.id, name: i.name, type: i.type, parentId: i.parentId }))
      });

      const prevSignature = JSON.stringify(currentItems.map((i: any) => i.id).sort());
      const nextSignature = JSON.stringify(nextItems.map((i: any) => i.id).sort());
      if (prevSignature !== nextSignature) {
        console.log('🔄 useMergeCurrentFolderItems - Actualizando store (signature changed)');
        setItems(nextItems);
      } else {
        const prevHash = JSON.stringify(currentItems);
        const nextHash = JSON.stringify(nextItems);
        if (prevHash !== nextHash) {
          console.log('🔄 useMergeCurrentFolderItems - Actualizando store (content changed)');
          setItems(nextItems);
        } else {
          console.log('🔄 useMergeCurrentFolderItems - No hay cambios, manteniendo store actual');
        }
      }
    }
  }, [memoizedFiles, setItems, currentFolderId, isLoading]);
}


