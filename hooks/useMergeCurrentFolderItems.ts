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
      
      // Debug específico para la carpeta "Octubre"
      const octubreFolder = memoizedFiles.find(f => f.name === 'Octubre' && f.id === 'main-1759781709442-k2zs81ple');
      if (octubreFolder) {
        console.log('🔍 useMergeCurrentFolderItems - Encontrada carpeta Octubre en files:', octubreFolder);
      }

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
      
      // Debug específico para verificar si "Octubre" está en el resultado final
      const octubreInResult = nextItems.find(i => i.name === 'Octubre' && i.id === 'main-1759781709442-k2zs81ple');
      if (octubreInResult) {
        console.log('✅ useMergeCurrentFolderItems - Carpeta Octubre incluida en resultado final:', octubreInResult);
      } else {
        console.log('❌ useMergeCurrentFolderItems - Carpeta Octubre NO incluida en resultado final');
        console.log('🔍 Items que SÍ están en el resultado:', nextItems.filter(i => i.parentId === 'main-1759781707790-601cgad4r'));
      }

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


