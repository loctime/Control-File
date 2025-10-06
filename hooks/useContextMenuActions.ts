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
  const { navigateToFolder, moveToTrash, removeItem } = useDriveStore();
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
    // TODO: Implementar modal de renombrado
    addToast({ type: 'info', title: 'Función en desarrollo', message: 'El renombrado estará disponible pronto' });
  }, [addToast]);

  // Copiar elemento
  const handleCopyItem = useCallback((itemId: string) => {
    // TODO: Implementar copia al portapapeles
    addToast({ type: 'info', title: 'Función en desarrollo', message: 'La copia estará disponible pronto' });
  }, [addToast]);

  // Cortar elemento
  const handleCutItem = useCallback((itemId: string) => {
    // TODO: Implementar corte al portapapeles
    addToast({ type: 'info', title: 'Función en desarrollo', message: 'El corte estará disponible pronto' });
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
    // TODO: Implementar modal de propiedades
    addToast({ type: 'info', title: 'Función en desarrollo', message: 'Las propiedades estarán disponibles pronto' });
  }, [addToast]);

  // Crear carpeta
  const handleCreateFolder = useCallback(() => {
    // TODO: Implementar modal de creación de carpeta
    addToast({ type: 'info', title: 'Función en desarrollo', message: 'La creación de carpetas estará disponible pronto' });
  }, [addToast]);

  // Pegar elementos
  const handlePasteItems = useCallback(() => {
    // TODO: Implementar pegado desde portapapeles
    addToast({ type: 'info', title: 'Función en desarrollo', message: 'El pegado estará disponible pronto' });
  }, [addToast]);

  // Seleccionar todo
  const handleSelectAll = useCallback(() => {
    // TODO: Implementar selección de todos los elementos visibles
    addToast({ type: 'info', title: 'Función en desarrollo', message: 'La selección múltiple estará disponible pronto' });
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
