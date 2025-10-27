// hooks/useContextMenuActions.ts
import { useCallback } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useNavigation } from '@/hooks/useNavigation';
import { useUIStore } from '@/lib/stores/ui';
import { auth } from '@/lib/firebase';

/**
 * Hook centralizado para manejar todas las acciones del menú contextual
 * Elimina la duplicación de código entre Navbar, Sidebar, FileExplorer, etc.
 */
export function useContextMenuActions() {
  const { moveToTrash, removeItem } = useDriveStore();
  const { navigateToFolder } = useNavigation();
  const { addToast } = useUIStore();

  // Abrir elemento (carpeta o archivo)
  const handleOpenItem = useCallback((itemId: string) => {
    navigateToFolder(itemId);
  }, [navigateToFolder]);

  // Descargar archivo
  const handleDownloadFile = useCallback(async (itemId: string) => {
    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) {
        addToast({ type: 'error', title: 'Debes iniciar sesión para descargar' });
        return;
      }

      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/files/presign-get', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ fileId: itemId }),
      });

      if (!res.ok) throw new Error('No se pudo obtener el enlace de descarga');
      
      const data = await res.json();
      const downloadUrl = data.url;
      
      // Crear enlace temporal para descarga
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = data.name || 'archivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addToast({ type: 'success', title: 'Descarga iniciada' });
    } catch (error: any) {
      console.error('Error al descargar:', error);
      addToast({ type: 'error', title: 'Error al descargar', message: error?.message || 'Intenta nuevamente' });
    }
  }, [addToast]);

  // Compartir elemento
  const handleShareItem = useCallback(async (itemId: string) => {
    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) {
        addToast({ type: 'error', title: 'Debes iniciar sesión para compartir' });
        return;
      }

      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/shares/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ fileId: itemId, expiresIn: 7 }),
      });

      if (!res.ok) throw new Error('No se pudo crear el enlace');
      
      const data = await res.json();
      const shareId = data.shareId || data.shareToken;
      const url = `${window.location.origin}/share/${shareId}`;
      
      await navigator.clipboard.writeText(url).catch(() => {});
      addToast({ type: 'success', title: 'Enlace de compartir copiado', message: url });
    } catch (error: any) {
      console.error('Error al compartir:', error);
      addToast({ type: 'error', title: 'Error al compartir', message: error?.message || 'Intenta nuevamente' });
    }
  }, [addToast]);

  // Renombrar elemento
  const handleRenameItem = useCallback((itemId: string) => {
    addToast({ type: 'info', title: 'Función no disponible', message: 'El renombrado no está implementado' });
  }, [addToast]);

  // Copiar elemento
  const handleCopyItem = useCallback((itemId: string) => {
    addToast({ type: 'info', title: 'Función no disponible', message: 'La copia no está implementada' });
  }, [addToast]);

  // Cortar elemento
  const handleCutItem = useCallback((itemId: string) => {
    addToast({ type: 'info', title: 'Función no disponible', message: 'El corte no está implementado' });
  }, [addToast]);

  // Eliminar elemento (mover a papelera)
  const handleDeleteItem = useCallback((itemId: string) => {
    moveToTrash(itemId);
    addToast({ type: 'success', title: 'Elemento movido a papelera' });
  }, [moveToTrash, addToast]);

  // Eliminar permanentemente
  const handlePermanentDelete = useCallback((itemId: string) => {
    removeItem(itemId);
    addToast({ type: 'success', title: 'Elemento eliminado permanentemente' });
  }, [removeItem, addToast]);

  // Mostrar propiedades
  const handleShowProperties = useCallback((itemId: string) => {
    addToast({ type: 'info', title: 'Función no disponible', message: 'Las propiedades no están implementadas' });
  }, [addToast]);

  // Crear carpeta
  const handleCreateFolder = useCallback(() => {
    addToast({ type: 'info', title: 'Función no disponible', message: 'La creación de carpetas no está implementada' });
  }, [addToast]);

  // Pegar elementos
  const handlePasteItems = useCallback(() => {
    addToast({ type: 'info', title: 'Función no disponible', message: 'El pegado no está implementado' });
  }, [addToast]);

  // Seleccionar todo
  const handleSelectAll = useCallback(() => {
    addToast({ type: 'info', title: 'Función no disponible', message: 'La selección múltiple no está implementada' });
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
