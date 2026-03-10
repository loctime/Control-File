// hooks/useContextMenuActions.ts
import { useCallback, useMemo } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useNavigation } from '@/hooks/useNavigation';
import { useUIStore } from '@/lib/stores/ui';
import { createBrowserControlFileClient } from '@/lib/controlfile-client';

/**
 * Hook centralizado para manejar todas las acciones del menu contextual.
 */
export function useContextMenuActions() {
  const { moveToTrash, removeItem } = useDriveStore();
  const { navigateToFolder } = useNavigation();
  const { addToast } = useUIStore();
  const sdk = useMemo(() => createBrowserControlFileClient(), []);

  const handleOpenItem = useCallback((itemId: string) => {
    navigateToFolder(itemId);
  }, [navigateToFolder]);

  const handleDownloadFile = useCallback(async (itemId: string) => {
    try {
      const data = await sdk.presignGet(itemId);
      const downloadUrl = data.downloadUrl || data.presignedUrl;
      if (!downloadUrl) {
        throw new Error('No se pudo obtener el enlace de descarga');
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = data.fileName || 'archivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast({ type: 'success', title: 'Descarga iniciada' });
    } catch (error: any) {
      console.error('Error al descargar:', error);
      addToast({ type: 'error', title: 'Error al descargar', message: error?.message || 'Intenta nuevamente' });
    }
  }, [addToast, sdk]);

  const handleShareItem = useCallback(async (itemId: string) => {
    try {
      const data = await sdk.createShare(itemId, 7);
      const shareId = data.shareId || data.shareToken;
      const url = `${window.location.origin}/share/${shareId}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      addToast({ type: 'success', title: 'Enlace de compartir copiado', message: url });
    } catch (error: any) {
      console.error('Error al compartir:', error);
      addToast({ type: 'error', title: 'Error al compartir', message: error?.message || 'Intenta nuevamente' });
    }
  }, [addToast, sdk]);

  const handleRenameItem = useCallback((_itemId: string) => {
    addToast({ type: 'info', title: 'Funcion no disponible', message: 'El renombrado no esta implementado' });
  }, [addToast]);

  const handleCopyItem = useCallback((_itemId: string) => {
    addToast({ type: 'info', title: 'Funcion no disponible', message: 'La copia no esta implementada' });
  }, [addToast]);

  const handleCutItem = useCallback((_itemId: string) => {
    addToast({ type: 'info', title: 'Funcion no disponible', message: 'El corte no esta implementado' });
  }, [addToast]);

  const handleDeleteItem = useCallback((itemId: string) => {
    moveToTrash(itemId);
    addToast({ type: 'success', title: 'Elemento movido a papelera' });
  }, [moveToTrash, addToast]);

  const handlePermanentDelete = useCallback((itemId: string) => {
    removeItem(itemId);
    addToast({ type: 'success', title: 'Elemento eliminado permanentemente' });
  }, [removeItem, addToast]);

  const handleShowProperties = useCallback((_itemId: string) => {
    addToast({ type: 'info', title: 'Funcion no disponible', message: 'Las propiedades no estan implementadas' });
  }, [addToast]);

  const handleCreateFolder = useCallback(() => {
    addToast({ type: 'info', title: 'Funcion no disponible', message: 'La creacion de carpetas no esta implementada' });
  }, [addToast]);

  const handlePasteItems = useCallback(() => {
    addToast({ type: 'info', title: 'Funcion no disponible', message: 'El pegado no esta implementado' });
  }, [addToast]);

  const handleSelectAll = useCallback(() => {
    addToast({ type: 'info', title: 'Funcion no disponible', message: 'La seleccion multiple no esta implementada' });
  }, [addToast]);

  return {
    handleOpenItem,
    handleDownloadFile,
    handleShareItem,
    handleRenameItem,
    handleCopyItem,
    handleCutItem,
    handleDeleteItem,
    handlePermanentDelete,
    handleShowProperties,
    handleCreateFolder,
    handlePasteItems,
    handleSelectAll,
  };
}
