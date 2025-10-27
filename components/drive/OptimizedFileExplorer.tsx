// components/drive/OptimizedFileExplorer.tsx
'use client';

import { useOptimizedDrive } from '@/hooks/useOptimizedDrive';
import { FileExplorerTable } from './FileExplorerTable';
import { Sidebar } from './Sidebar';
import { Taskbar } from './Taskbar';
import { Navbar } from './Navbar';
import { OfflineMessage } from '@/components/common/OfflineMessage';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useSmartPrefetch } from '@/hooks/useOptimizedDrive';
import { useEffect } from 'react';

interface OptimizedFileExplorerProps {
  folderId?: string | null;
}

export function OptimizedFileExplorer({ folderId = null }: OptimizedFileExplorerProps) {
  const { isOnline } = useConnectionStatus();
  const { prefetchCommonFolders } = useSmartPrefetch();
  
  const {
    // Datos
    files,
    folders,
    fileItems,
    
    // Estados
    isLoading,
    isFetching,
    isMutating,
    error,
    isError,
    
    // Navegación
    currentFolderId,
    breadcrumb,
    navigateToFolder,
    navigateBack,
    
    // Selección
    selectedItems,
    selectedCount,
    hasSelection,
    handleItemSelection,
    handleSelectAll,
    handleClearSelection,
    
    // Vista
    viewMode,
    sidebarCollapsed,
    toggleViewMode,
    toggleDetails,
    toggleSidebar,
    
    // Estadísticas
    totalFiles,
    totalFolders,
    totalSize,
    
    // Búsqueda y filtros
    searchFiles,
    filterByType,
    sortFiles,
    
    // Query controls
    refetch,
    invalidate,
  } = useOptimizedDrive(folderId);

  // Prefetch de carpetas comunes al montar
  useEffect(() => {
    prefetchCommonFolders();
  }, [prefetchCommonFolders]);

  // Mostrar mensaje offline si no hay conexión
  if (!isOnline) {
    return <OfflineMessage />;
  }

  // Mostrar error si hay problema
  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-red-600 mb-2">
            Error al cargar archivos
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {error?.message || 'Ha ocurrido un error inesperado'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300`}>
        <Sidebar 
          isOpen={!sidebarCollapsed}
          onToggle={toggleSidebar}
        />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col">
        {/* Navbar */}
        <Navbar />

        {/* Taskbar */}
        {hasSelection && (
          <Taskbar />
        )}

        {/* Área de archivos */}
        <div className="flex-1 overflow-hidden">
          <FileExplorerTable
            folderId={currentFolderId}
            onFolderClick={navigateToFolder}
            onFileClick={(fileId) => {
              // Implementar apertura de archivo
              console.log('Abrir archivo:', fileId);
            }}
          />
        </div>

        {/* Indicadores de estado */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-t text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>
              {totalFolders} carpeta{totalFolders !== 1 ? 's' : ''}
            </span>
            <span>
              {totalFiles} archivo{totalFiles !== 1 ? 's' : ''}
            </span>
            <span>
              {Math.round(totalSize / 1024 / 1024 * 100) / 100} MB
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {isFetching && (
              <div className="flex items-center space-x-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                <span>Actualizando...</span>
              </div>
            )}
            {isMutating && (
              <div className="flex items-center space-x-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                <span>Procesando...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
