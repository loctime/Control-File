// components/drive/FileExplorer.tsx
'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useFiles } from '@/hooks/useFiles';
import { isKeyboardShortcut } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth';
import { OfflineMessage } from '@/components/common/OfflineMessage';
import { Navbar } from '@/components/drive/Navbar';
import { Taskbar } from '@/components/drive/Taskbar';
import { Sidebar } from '@/components/drive/Sidebar';
import { ContextMenu } from '@/components/drive/ContextMenu';
import { CreateFolderModal } from '@/components/drive/CreateFolderModal';
import { DeleteConfirmModal } from '@/components/drive/DeleteConfirmModal';
import { TrashView } from '@/components/drive/TrashView';
import { DetailsPanel } from '@/components/drive/DetailsPanel';
import { FileContentArea } from '@/components/drive/FileContentArea';
import { CollapsedSidebar } from '@/components/drive/CollapsedSidebar';
import { UploadProgress } from '@/components/drive/UploadProgress';
import { UploadOverlay } from '@/components/drive/UploadOverlay';
import { DragDropLoader } from '@/components/drive/DragDropLoader';
import { useProxyUpload } from '@/hooks/useProxyUpload';
import { auth } from '@/lib/firebase';
import { useResizableSidebar } from '@/hooks/useResizableSidebar';
import { useExplorerShortcuts } from '@/hooks/useExplorerShortcuts';
import { useMergeCurrentFolderItems } from '@/hooks/useMergeCurrentFolderItems';
import { useNavigation } from '@/hooks/useNavigation';



export function FileExplorer() {
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const { syncStateWithUrl, navigateToFolder } = useNavigation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState<Array<{ id: string; name: string; type: 'file' | 'folder' }>>([]);
  const [showUploadOverlay, setShowUploadOverlay] = useState(false);
  
  const {
    currentFolderId,
    viewMode,
    selectedItems,
    clearSelection,
    toggleItemSelection,
    setItems,
    getSubfolders,
    getMainFolders,
    getMainFolder,
    initializeDefaultFolder,
    items,
    createMainFolder,
    createSubfolder,
    removeItem,
    moveToTrash,
    getTrashItems,
    setSelectedItems,
    selectAll,
  } = useDriveStore();

  const { uploadProgress } = useUIStore();
  const { uploadFile } = useProxyUpload();

  // Mostrar overlay cuando hay subidas activas
  useEffect(() => {
    const activeUploads = uploadProgress.filter(u => 
      u.status === 'uploading' || u.status === 'processing'
    );
    setShowUploadOverlay(activeUploads.length > 0);
  }, [uploadProgress]);
  
  const { detailsPanelOpen, sidebarOpen, toggleSidebar, setSidebarOpen, isTrashView, toggleTrashView, closeTrashView, toggleDetailsPanel, addToast } = useUIStore();
  const { files, loading, error } = useFiles(currentFolderId);
  const historyNavigatingRef = useRef(false);
  
  // Estado para el ancho del sidebar (hook)
  const { sidebarWidth, isResizing, handleMouseDown } = useResizableSidebar({ initialWidth: 320, minWidth: 200, maxWidth: 600 });

  // Log para debugging del contenedor
  useEffect(() => {
    console.log('Contenedor sidebar width actualizado:', sidebarWidth + 16);
  }, [sidebarWidth]);

  // Merge de items del folder actual al store global
  useMergeCurrentFolderItems(files, currentFolderId, loading);

  // Filtrar archivos que fueron movidos a papelera (deletedAt en el store)
  const visibleFiles = useMemo(() => {
    const deletedIds = new Set(items.filter((i: any) => i.deletedAt).map((i: any) => i.id));
    const currentFolderItems = (files || []);
    // Mostrar únicamente archivos aquí; las carpetas se obtienen por separado del store
    return currentFolderItems.filter((it: any) => it.type === 'file' && !deletedIds.has(it.id));
  }, [files, items]);

  // Drag & Drop global (cubre toda el área de la app)
  const [draggedFiles, setDraggedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('📥 onDrop - archivos aceptados:', acceptedFiles.map(f => f.name));
    setDraggedFiles([]);
    acceptedFiles.forEach((file) => {
      uploadFile.mutate({ file, parentId: currentFolderId });
    });
  }, [uploadFile, currentFolderId]);

  const onDragEnter = useCallback((event: any) => {
    const files = Array.from(event?.dataTransfer?.files || []) as File[];
    setDraggedFiles(files as File[]);
    if (files.length > 0) {
      console.log('🟦 onDragEnter - archivos:', files.map((f: File) => f.name));
    } else {
      console.log('🟦 onDragEnter');
    }
  }, []);

  const onDragLeave = useCallback(() => {
    console.log('⬜ onDragLeave');
    setDraggedFiles([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter,
    onDragLeave,
    noClick: true,
    noKeyboard: true,
  });

  // Inicializar carpeta por defecto si no hay una seleccionada
  useEffect(() => {
    if (!currentFolderId) {
      initializeDefaultFolder();
    }
  }, [currentFolderId, initializeDefaultFolder]);

  // Si hay carpetas disponibles pero no hay carpeta actual, abrir automáticamente
  useEffect(() => {
    if (currentFolderId || loading) return;
    const mainId = getMainFolder();
    if (mainId) {
      navigateToFolder(mainId);
      return;
    }
    const firstRootFolder = (files || []).find((i: any) => i.type === 'folder');
    if (firstRootFolder) {
      navigateToFolder(firstRootFolder.id);
    }
  }, [currentFolderId, loading, files, getMainFolder, navigateToFolder]);

  // Obtener subcarpetas de la carpeta actual
  const subfolders = getSubfolders(currentFolderId || '');

  // Funciones para el menú contextual
  const handleOpenItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      if (item.type === 'folder') {
        navigateToFolder(itemId);
      } else {
        // TODO: Implementar apertura de archivos
        console.log('Abrir archivo:', itemId);
      }
    }
  };

  const handleDownloadFile = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item && item.type === 'file') {
      // TODO: Implementar descarga
      console.log('Descargar archivo:', itemId);
    }
  };

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
      const shareId = data.shareId || data.shareToken; // compatibilidad backend
      const url = `${window.location.origin}/share/${shareId}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      addToast({ type: 'success', title: 'Enlace de compartir copiado', message: url });
      console.log('🔗 Enlace de compartir:', url);
    } catch (error: any) {
      console.error('❌ Error al compartir:', error);
      addToast({ type: 'error', title: 'Error al compartir', message: error?.message || 'Intenta nuevamente' });
    }
  }, [addToast]);

  const handleRenameItem = (itemId: string) => {
    // TODO: Implementar renombrar
    console.log('Renombrar item:', itemId);
  };

  const handleCopyItem = (itemId: string) => {
    // TODO: Implementar copiar
    console.log('Copiar item:', itemId);
  };

  const handleCutItem = (itemId: string) => {
    // TODO: Implementar cortar
    console.log('Cortar item:', itemId);
  };

  const handleDeleteItem = (itemId: string) => {
    // Mover a papelera en lugar de eliminar directamente
    moveToTrash(itemId);
    // Limpiar la selección después de mover a papelera
    clearSelection();
  };

  const handleToggleTrashView = () => {
    toggleTrashView();
    if (!isTrashView) {
      // Al entrar a la papelera, limpiar selección
      clearSelection();
    }
  };

  const handleConfirmDelete = async () => {
    try {
      // Mover elementos a papelera en lugar de eliminar directamente
      itemsToDelete.forEach(item => {
        moveToTrash(item.id);
      });
      
      // Limpiar la selección
      clearSelection();
      
      console.log('✅ Elementos movidos a papelera:', itemsToDelete.map(item => item.name));
    } catch (error) {
      console.error('❌ Error al mover elementos a papelera:', error);
      throw error;
    }
  };

  const handleShowProperties = (itemId: string) => {
    // TODO: Implementar mostrar propiedades
    console.log('Mostrar propiedades:', itemId);
  };

  const handleCreateFolder = () => {
    setIsCreateFolderModalOpen(true);
  };

  const handleCreateFolderSubmit = (folderName: string) => {
    // Crear subcarpeta dentro de la carpeta actualmente abierta
    if (!currentFolderId) {
      console.log('📁 No hay carpeta abierta, no se puede crear subcarpeta');
      return;
    }
    console.log('📁 Creando subcarpeta en:', currentFolderId, 'nombre:', folderName);
    createSubfolder(folderName, currentFolderId);
  };

  const handlePasteItems = () => {
    // TODO: Implementar pegar
    console.log('Pegar items');
  };

  const handleSelectAll = () => {
    if (isTrashView) {
      const trash = getTrashItems();
      setSelectedItems(trash.map((t: any) => t.id));
    } else {
      // Seleccionar todos los elementos visibles (no en papelera)
      selectAll();
    }
  };
  // Merge extraído a hook

  // Manejar clic en carpeta
  const handleFolderClick = (folderId: string) => {
    navigateToFolder(folderId);
    // Cerrar la papelera si está abierta
    closeTrashView();
  };

  // Integración con historial del navegador para soportar botones físicos Atrás/Adelante
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      // Con las nuevas rutas, el navegador maneja automáticamente la navegación
      // Solo necesitamos sincronizar el estado con la URL actual
      syncStateWithUrl();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Sincronizar estado con URL al cargar
  useEffect(() => {
    syncStateWithUrl();
  }, []);

  // Atajos de teclado extraídos a hook
  useExplorerShortcuts({
    onToggleSidebar: toggleSidebar,
    onDeleteSelected: () => {
      if (selectedItems.length > 0) {
        selectedItems.forEach(itemId => handleDeleteItem(itemId));
      }
    },
    onSelectAll: handleSelectAll,
    onCopySelected: () => {
      if (selectedItems.length > 0) {
        selectedItems.forEach(itemId => handleCopyItem(itemId));
      }
    },
    onPaste: handlePasteItems,
    onRenameSelected: () => {
      if (selectedItems.length === 1) {
        handleRenameItem(selectedItems[0]);
      }
    },
    onToggleDetails: toggleDetailsPanel,
    hasSelection: selectedItems.length > 0,
    selectedItemsCount: selectedItems.length,
  });

  // Handle background click to clear selection
  const handleBackgroundClick = (e: React.MouseEvent) => {
    const element = e.target as HTMLElement | null;
    // Si el clic ocurre fuera de cualquier item (archivo/carpeta), limpiar selección
    if (element && element.closest('[data-item-id]')) return;
    clearSelection();
  };

  // Resize movido al hook useResizableSidebar

  // Escucha del botón "Compartir" en FileItem
  useEffect(() => {
    const listener = (e: any) => {
      const fileId = e?.detail?.fileId;
      if (fileId) handleShareItem(fileId);
    };
    window.addEventListener('file-share-click', listener as EventListener);
    return () => window.removeEventListener('file-share-click', listener as EventListener);
  }, [handleShareItem]);

  // Verificar si el error es de conectividad
  const isOfflineError = error?.message?.includes('Sin conexión') || 
                        error?.message?.includes('offline') ||
                        error?.message?.includes('network');

  if (error && isOfflineError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-md w-full p-6">
          <OfflineMessage 
            message="Sin conexión a internet. Los archivos no están disponibles en modo offline."
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive mb-2">Error al cargar archivos</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <ContextMenu
      onOpenItem={handleOpenItem}
      onDownloadFile={handleDownloadFile}
      onShareItem={handleShareItem}
      onRenameItem={handleRenameItem}
      onCopyItem={handleCopyItem}
      onCutItem={handleCutItem}
      onDeleteItem={handleDeleteItem}
      onShowProperties={handleShowProperties}
      onCreateFolder={handleCreateFolder}
      onPasteItems={handlePasteItems}
      onSelectAll={handleSelectAll}
    >
      <div
        {...getRootProps()}
        className={`flex flex-col h-screen bg-background ${isResizing ? 'cursor-col-resize' : ''}`}
      >
        <input {...getInputProps()} />
        {/* Navbar - siempre en la parte superior */}
        <Navbar />
        
        {/* Content area con sidebar y archivos */}
        <div className="flex flex-1">
          {/* Sidebar o barra lateral mínima */}
          {sidebarOpen ? (
            <div 
              className="flex" 
              style={{ width: `${sidebarWidth + 16}px` }}
              onLoad={() => console.log('Contenedor sidebar width:', sidebarWidth + 16)}
            >
              <Sidebar 
                isOpen={true} 
                onToggle={() => {}} 
                width={sidebarWidth}
              />
              {/* Resize handle - más ancho y visible */}
              <div
                className="w-4 bg-border hover:bg-primary/50 cursor-col-resize transition-all duration-200 relative group"
                onMouseDown={handleMouseDown}
                title="Arrastra para redimensionar el panel lateral"
              >
                {/* Indicador visual central más visible */}
                <div className="absolute inset-y-0 left-1/2 w-1 bg-muted-foreground/40 group-hover:bg-primary/80 group-hover:w-1.5 transition-all duration-200 transform -translate-x-0.5" />
                
                {/* Indicadores de puntos para mayor visibilidad */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="flex flex-col space-y-1">
                    <div className="w-1 h-1 bg-primary/60 rounded-full"></div>
                    <div className="w-1 h-1 bg-primary/60 rounded-full"></div>
                    <div className="w-1 h-1 bg-primary/60 rounded-full"></div>
                  </div>
                </div>
              </div>
              
              {/* Botón de reset para debugging */}
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={() => {
                    console.log('Reseteando sidebar a 320px');
                    // Forzar reset del sidebar
                    window.location.reload();
                  }}
                  className="text-xs bg-red-500 text-white px-2 py-1 rounded opacity-50 hover:opacity-100"
                  title="Reset sidebar (debug)"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : (
            <CollapsedSidebar />
          )}
          
          {/* Main content area */}
          <div className="flex-1">
            {/* File area */}
            {isTrashView ? (
              // Vista de papelera
              <div className="flex-1">
                <TrashView
                  onOpenItem={handleOpenItem}
                  onDownloadFile={handleDownloadFile}
                  onShareItem={handleShareItem}
                  onRenameItem={handleRenameItem}
                  onCopyItem={handleCopyItem}
                  onCutItem={handleCutItem}
                  onDeleteItem={handleDeleteItem}
                  onShowProperties={handleShowProperties}
                  onCreateFolder={handleCreateFolder}
                  onPasteItems={handlePasteItems}
                  onSelectAll={handleSelectAll}
                />
              </div>
            ) : (
              <FileContentArea
                files={visibleFiles}
                subfolders={subfolders}
                loading={loading}
                currentFolderId={currentFolderId}
                selectedItems={selectedItems}
                onFolderClick={handleFolderClick}
                onBackgroundClick={handleBackgroundClick}
              />
            )}
          </div>
          
          {/* Details Panel */}
          {detailsPanelOpen && (
            <div className="w-80 border-l border-border bg-card">
              <DetailsPanel />
            </div>
          )}
        </div>
        
        {/* Taskbar */}
        <Taskbar />
      </div>
      
      {/* Modal para crear carpeta */}
      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onCreateFolder={handleCreateFolderSubmit}
        currentFolderId={currentFolderId}
      />

      {/* Modal de confirmación de eliminación */}
      {itemsToDelete.length > 0 && (
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setItemsToDelete([]);
          }}
          onConfirm={handleConfirmDelete}
          itemName={itemsToDelete[0].name}
          itemType={itemsToDelete[0].type}
          isFolder={itemsToDelete[0].type === 'folder'}
        />
      )}

      {/* Upload Progress Bar */}
      <UploadProgress />

      {/* Upload Overlay */}
      <UploadOverlay 
        isVisible={showUploadOverlay}
        onClose={() => setShowUploadOverlay(false)}
      />
      {/* Drag & Drop Loader global */}
      <DragDropLoader isDragOver={isDragActive} files={draggedFiles} />
    </ContextMenu>
  );
}

