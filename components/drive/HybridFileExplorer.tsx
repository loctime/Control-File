// components/drive/HybridFileExplorer.tsx
'use client';

import { useState, useEffect } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useOptimizedDrive } from '@/hooks/useOptimizedDrive';
import { FileTable } from './FileTable';
import { CreateFolderForm } from './CreateFolderForm';
import { RenameForm } from './RenameForm';
import { useOptimizedUpload } from '@/hooks/useOptimizedUpload';
import { Button } from '@/components/ui/button';
import { 
  UploadIcon, 
  PlusIcon, 
  GridIcon, 
  ListIcon,
  MoreHorizontalIcon,
  DownloadIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { OfflineMessage } from '@/components/common/OfflineMessage';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { Navbar } from './Navbar';
import { Taskbar } from './Taskbar';
import { Sidebar } from './Sidebar';

interface HybridFileExplorerProps {
  folderId?: string | null;
}

export function HybridFileExplorer({ folderId = null }: HybridFileExplorerProps) {
  const { isOnline } = useConnectionStatus();
  const [showUploadArea, setShowUploadArea] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  
  // Usar el hook optimizado
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
    
    // Query controls
    refetch,
    invalidate,
  } = useOptimizedDrive(folderId);

  const { uploadFiles, isUploading } = useOptimizedUpload();

  // Manejar drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowUploadArea(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowUploadArea(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowUploadArea(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  // Manejar upload de archivos
  const handleFileUpload = (files: File[]) => {
    uploadFiles(files, {
      parentId: currentFolderId,
      onComplete: (results) => {
        console.log('Archivos subidos:', results);
        setShowUploadArea(false);
      },
      onError: (error) => {
        console.error('Error en upload:', error);
        setShowUploadArea(false);
      },
    });
  };

  // Manejar click en carpeta
  const handleFolderClick = (folderId: string) => {
    navigateToFolder(folderId);
  };

  // Manejar click en archivo
  const handleFileClick = (fileId: string) => {
    console.log('Abrir archivo:', fileId);
    // Implementar apertura de archivo
  };

  // Manejar cambios de selección
  const handleSelectionChange = (newSelectedItems: any[]) => {
    // Convertir a IDs para mantener compatibilidad con Zustand
    const itemIds = newSelectedItems.map(item => item.id);
    // Aquí podrías actualizar el store de Zustand si es necesario
  };

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
    <div 
      className="flex h-screen bg-gray-50"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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

        {/* Barra de herramientas */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center space-x-2">
            <CreateFolderForm parentId={currentFolderId} />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = (e) => {
                  const files = Array.from((e.target as HTMLInputElement).files || []);
                  if (files.length > 0) {
                    handleFileUpload(files);
                  }
                };
                input.click();
              }}
              disabled={isUploading}
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              {isUploading ? 'Subiendo...' : 'Subir Archivos'}
            </Button>

            <Input
              placeholder="Buscar archivos..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode.type === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleViewMode('grid')}
            >
              <GridIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode.type === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleViewMode('list')}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={toggleDetails}
            >
              <EyeIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Área de upload con drag & drop */}
        {showUploadArea && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-90 flex items-center justify-center z-50">
            <div className="text-center">
              <UploadIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-blue-600">
                Suelta los archivos aquí para subirlos
              </p>
              <p className="text-sm text-blue-500">
                Los archivos se subirán a esta carpeta
              </p>
            </div>
          </div>
        )}

        {/* Área de archivos */}
        <div className="flex-1 overflow-hidden">
          {viewMode.type === 'list' ? (
            <FileTable
              folderId={currentFolderId}
              onFolderClick={handleFolderClick}
              onFileClick={handleFileClick}
              onSelectionChange={handleSelectionChange}
            />
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => file.type === 'folder' ? handleFolderClick(file.id) : handleFileClick(file.id)}
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">
                        {file.type === 'folder' ? '📁' : '📄'}
                      </div>
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {file.type === 'file' ? `${Math.round(file.size / 1024)} KB` : 'Carpeta'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {/* Indicador de carga global */}
      {isUploading && (
        <div className="absolute bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Subiendo archivos...</span>
          </div>
        </div>
      )}
    </div>
  );
}
