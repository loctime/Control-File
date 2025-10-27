// components/drive/FileExplorerTable.tsx
'use client';

import { useState, useEffect } from 'react';
import { useFileTable } from '@/hooks/useFileTable';
import { FileTable } from './FileTable';
import { CreateFolderForm } from './CreateFolderForm';
import { RenameForm } from './RenameForm';
import { useOptimizedUpload, useDragDropUpload } from '@/hooks/useOptimizedUpload';
import { Button } from '@/components/ui/button';
import { UploadIcon, PlusIcon, GridIcon, ListIcon } from 'lucide-react';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';

interface FileExplorerTableProps {
  folderId: string | null;
  onFolderClick?: (folderId: string) => void;
  onFileClick?: (fileId: string) => void;
}

export function FileExplorerTable({ 
  folderId, 
  onFolderClick, 
  onFileClick 
}: FileExplorerTableProps) {
  const { viewMode, setViewMode } = useUIStore();
  const { selectedItems, setSelectedItems, clearSelection } = useDriveStore();
  const { uploadFiles, isUploading } = useOptimizedUpload();
  const { 
    handleDrop: handleDropUpload, 
    handleDragOver: handleDragOverUpload, 
    handleDragEnter: handleDragEnterUpload, 
    handleDragLeave: handleDragLeaveUpload 
  } = useDragDropUpload(folderId);

  const [showUploadArea, setShowUploadArea] = useState(false);

  // Manejar cambios de selección
  const handleSelectionChange = (newSelectedItems: any[]) => {
    setSelectedItems(newSelectedItems.map(item => item.id));
  };

  // Manejar click en carpeta
  const handleFolderClick = (folderId: string) => {
    clearSelection();
    onFolderClick?.(folderId);
  };

  // Manejar click en archivo
  const handleFileClick = (fileId: string) => {
    clearSelection();
    onFileClick?.(fileId);
  };

  // Manejar upload de archivos
  const handleFileUpload = (files: File[]) => {
    uploadFiles(files, {
      parentId: folderId,
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

  // Manejar drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDragOverUpload(e);
    setShowUploadArea(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDragLeaveUpload(e);
    setShowUploadArea(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDropUpload(e);
    setShowUploadArea(false);
  };

  return (
    <div 
      className="flex-1 flex flex-col h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Barra de herramientas */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-2">
          <CreateFolderForm parentId={folderId} />
          
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
        </div>

        <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <GridIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <ListIcon className="h-4 w-4" />
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

      {/* Tabla de archivos */}
      <div className="flex-1 overflow-hidden">
        <FileTable
          folderId={folderId}
          onFolderClick={handleFolderClick}
          onFileClick={handleFileClick}
          onSelectionChange={handleSelectionChange}
        />
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
