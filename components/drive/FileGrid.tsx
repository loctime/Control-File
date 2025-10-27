'use client';

import { useState, memo } from 'react';
import { 
  File, 
  Folder, 
  MoreHorizontal, 
  Download, 
  Share2, 
  Trash2, 
  Edit3,
  Copy,
  Move
} from 'lucide-react';
import { DriveItem } from '@/types';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { formatFileSize, getMimeTypeIcon, isImageFile } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

interface FileGridProps {
  items: DriveItem[];
  onNavigateToFolder?: (folderId: string) => void;
}

export const FileGrid = memo(function FileGrid({ items, onNavigateToFolder }: FileGridProps) {
  const { selectedItems, toggleItemSelection } = useDriveStore();
  const { addToast } = useUIStore();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleItemClick = (item: DriveItem, multi: boolean = false) => {
    toggleItemSelection(item.id, multi);
  };

  const handleDoubleClick = (item: DriveItem) => {
    if (item.type === 'folder') {
      onNavigateToFolder?.(item.id);
    } else {
      addToast({ type: 'info', title: 'Función no disponible', message: 'La apertura de archivos no está implementada' });
    }
  };

  const startRename = (item: DriveItem) => {
    setEditingItem(item.id);
    setEditName(item.name);
  };

  const handleRename = (itemId: string) => {
    addToast({ type: 'info', title: 'Función no disponible', message: 'El renombrado no está implementado' });
    setEditingItem(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === 'Enter') {
      handleRename(itemId);
    } else if (e.key === 'Escape') {
      setEditingItem(null);
      setEditName('');
    }
  };

  const getIcon = (item: DriveItem) => {
    if (item.type === 'folder') {
      return <Folder className="h-8 w-8 text-blue-500" />;
    }
    
    const iconName = getMimeTypeIcon(item.mime || '');
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const getPreview = (item: DriveItem) => {
    if (item.type === 'folder') {
      return (
        <div className="w-full h-full bg-blue-50 dark:bg-blue-950/30 rounded flex items-center justify-center">
          <Folder className="h-8 w-8 text-blue-500" />
        </div>
      );
    }
    
    if (isImageFile(item.mime || '')) {
      return (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded flex items-center justify-center">
          <span className="text-xs text-muted-foreground">IMG</span>
        </div>
      );
    }
    
    return (
      <div className="w-full h-full bg-gray-100 dark:bg-gray-900 rounded flex items-center justify-center">
        <span className="text-xs text-muted-foreground font-mono">
          {(item.name.split('.').pop() || '').toUpperCase()}
        </span>
      </div>
    );
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className={`group p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedItems.includes(item.id) ? 'bg-accent border-primary' : 'hover:bg-accent/50'
            }`}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                handleItemClick(item, true);
              } else {
                handleItemClick(item, false);
              }
            }}
            onDoubleClick={() => handleDoubleClick(item)}
          >
            {/* Preview/Icon */}
            <div className="aspect-square mb-2 flex items-center justify-center">
              {getPreview(item)}
            </div>

            {/* Name */}
            <div className="text-center relative">
              {editingItem === item.id ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, item.id)}
                  onBlur={() => handleRename(item.id)}
                  autoFocus
                  className="h-6 text-sm text-center"
                />
              ) : (
                <p className="text-sm truncate" title={item.name}>
                  {item.name}
                </p>
              )}
              
              {item.type === 'file' && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatFileSize(item.size || 0)}
                </p>
              )}
            </div>

            {/* Context menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDoubleClick(item)}>
                  Abrir
                </DropdownMenuItem>
                
                {item.type === 'file' && (
                  <DropdownMenuItem>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem>
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartir
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => startRename(item)}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Renombrar
                </DropdownMenuItem>
                
                <DropdownMenuItem>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </DropdownMenuItem>
                
                <DropdownMenuItem>
                  <Move className="mr-2 h-4 w-4" />
                  Mover
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="text-center">
            <Folder className="h-12 w-12 mx-auto mb-2" />
            <p>Esta carpeta está vacía</p>
            <p className="text-sm mt-1">Arrastra archivos aquí o usa el botón Subir</p>
          </div>
        </div>
      )}
    </div>
  );
});
