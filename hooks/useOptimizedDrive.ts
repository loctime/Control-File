// hooks/useOptimizedDrive.ts
import { useQueryClient } from '@tanstack/react-query';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useFiles, fileQueryKeys } from './useFiles';
import { useCallback, useMemo, useState } from 'react';

export function useOptimizedDrive(folderId: string | null = null) {
  const queryClient = useQueryClient();
  const {
    currentFolderId,
    selectedItems,
    viewMode,
    breadcrumb,
    setCurrentFolder,
    setSelectedItems,
    clearSelection,
    toggleItemSelection,
    setViewMode,
  } = useDriveStore();

  // Estado simplificado para sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Usar el hook optimizado de archivos
  const {
    files,
    isLoading,
    isFetching,
    isMutating,
    error,
    isError,
    isSuccess,
    refetch,
    invalidate,
  } = useFiles(folderId);

  // Memoizar archivos y carpetas separados
  const { folders, fileItems } = useMemo(() => {
    const folders = files.filter(item => item.type === 'folder');
    const fileItems = files.filter(item => item.type === 'file');
    return { folders, fileItems };
  }, [files]);

  // Funciones optimizadas para navegación
  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolder(folderId, []);
    clearSelection();
    // Prefetch simplificado
    console.log('Navigate to folder:', folderId);
  }, [setCurrentFolder, clearSelection]);

  const navigateBack = useCallback(() => {
    if (breadcrumb.length > 0) {
      const previousFolder = breadcrumb[breadcrumb.length - 1];
      const newBreadcrumb = breadcrumb.slice(0, -1);
      setCurrentFolder(previousFolder.id, newBreadcrumb);
      clearSelection();
    }
  }, [breadcrumb, setCurrentFolder, clearSelection]);

  // Funciones optimizadas para selección
  const handleItemSelection = useCallback((itemId: string, multi = false) => {
    if (multi) {
      toggleItemSelection(itemId, true);
    } else {
      setSelectedItems([itemId]);
    }
  }, [toggleItemSelection, setSelectedItems]);

  const handleSelectAll = useCallback(() => {
    setSelectedItems(files.map(item => item.id));
  }, [files, setSelectedItems]);

  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Funciones para vista
  const toggleViewMode = useCallback((mode: 'grid' | 'list') => {
    setViewMode({ type: mode });
  }, [setViewMode]);

  const toggleDetails = useCallback(() => {
    // Implementación simplificada
    console.log('Toggle details');
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  // Funciones para búsqueda y filtros
  const searchFiles = useCallback((query: string) => {
    // Implementar búsqueda local o con API
    const filteredFiles = files.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );
    return filteredFiles;
  }, [files]);

  const filterByType = useCallback((type: 'all' | 'files' | 'folders') => {
    switch (type) {
      case 'files':
        return fileItems;
      case 'folders':
        return folders;
      default:
        return files;
    }
  }, [files, fileItems, folders]);

  // Funciones para ordenamiento
  const sortFiles = useCallback((sortBy: 'name' | 'size' | 'date', order: 'asc' | 'desc' = 'asc') => {
    const sortedFiles = [...files].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          // Solo ordenar por tamaño si es un archivo
          if (a.type === 'file' && b.type === 'file') {
            comparison = (a as any).size - (b as any).size;
          }
          break;
        case 'date':
          comparison = a.modifiedAt.getTime() - b.modifiedAt.getTime();
          break;
      }
      
      return order === 'asc' ? comparison : -comparison;
    });
    
    return sortedFiles;
  }, [files]);

  // Estado de la aplicación
  const appState = useMemo(() => ({
    // Datos
    files,
    folders,
    fileItems,
    
    // Estados de carga
    isLoading,
    isFetching,
    isMutating,
    error,
    isError,
    isSuccess,
    
    // Navegación
    currentFolderId,
    breadcrumb,
    
    // Selección
    selectedItems,
    selectedCount: selectedItems.length,
    hasSelection: selectedItems.length > 0,
    
    // Vista
    viewMode,
    sidebarCollapsed,
    
    // Estadísticas
    totalFiles: fileItems.length,
    totalFolders: folders.length,
    totalSize: fileItems.reduce((sum, file) => sum + ((file as any).size || 0), 0),
  }), [
    files,
    folders,
    fileItems,
    isLoading,
    isFetching,
    isMutating,
    error,
    isError,
    isSuccess,
    currentFolderId,
    breadcrumb,
    selectedItems,
    viewMode,
    sidebarCollapsed,
  ]);

  // Funciones de la aplicación
  const appActions = useMemo(() => ({
    // Navegación
    navigateToFolder,
    navigateBack,
    
    // Selección
    handleItemSelection,
    handleSelectAll,
    handleClearSelection,
    
    // Vista
    toggleViewMode,
    toggleDetails,
    toggleSidebar,
    
    // Búsqueda y filtros
    searchFiles,
    filterByType,
    sortFiles,
    
    // Query controls
    refetch,
    invalidate,
  }), [
    navigateToFolder,
    navigateBack,
    handleItemSelection,
    handleSelectAll,
    handleClearSelection,
    toggleViewMode,
    toggleDetails,
    toggleSidebar,
    searchFiles,
    filterByType,
    sortFiles,
    refetch,
    invalidate,
  ]);

  return {
    ...appState,
    ...appActions,
  };
}

// Hook para prefetch inteligente
export function useSmartPrefetch() {
  const queryClient = useQueryClient();

  const prefetchFolder = useCallback((folderId: string) => {
    // Implementación simplificada
    console.log('Prefetch folder:', folderId);
  }, []);

  const prefetchCommonFolders = useCallback(() => {
    // Implementación simplificada
    console.log('Prefetch common folders');
  }, []);

  return {
    prefetchFolder,
    prefetchCommonFolders,
  };
}
