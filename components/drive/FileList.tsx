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

interface FileListProps {
  items: DriveItem[];
}

export const FileList = memo(function FileList({ items }: FileListProps) {
  const { selectedItems, toggleItemSelection } = useDriveStore();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleItemClick = (item: DriveItem, multi: boolean = false) => {
    toggleItemSelection(item.id, multi);
  };

  const handleDoubleClick = (item: DriveItem) => {
    if (item.type === 'folder') {
      // TODO: Navigate to folder
      console.log('Navigate to folder:', item.id);
    } else {
      // TODO: Open file
      console.log('Open file:', item.id);
    }
  };

  const startRename = (item: DriveItem) => {
    setEditingItem(item.id);
    setEditName(item.name);
  };

  const handleRename = (itemId: string) => {
    // TODO: Implement rename
    console.log('Rename item:', itemId, 'to:', editName);
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
      return <Folder className="h-4 w-4 text-blue-500" />;
    }
    
    const iconName = getMimeTypeIcon(item.mime || '');
    return <File className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="p-4">
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className={`group flex items-center p-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-accent/50 ${
              selectedItems.includes(item.id) ? 'bg-accent' : ''
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
            {/* Icon */}
            <div className="flex-shrink-0 mr-3">
              {getIcon(item)}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              {editingItem === item.id ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, item.id)}
                  onBlur={() => handleRename(item.id)}
                  autoFocus
                  className="h-6 text-sm"
                />
              ) : (
                <p className="text-sm truncate" title={item.name}>
                  {item.name}
                </p>
              )}
            </div>

            {/* Size */}
            {item.type === 'file' && (
              <div className="flex-shrink-0 ml-2">
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(item.size || 0)}
                </p>
              </div>
            )}

            {/* Modified date */}
            <div className="flex-shrink-0 ml-4">
              <p className="text-xs text-muted-foreground">
                {item.modifiedAt ? new Date(item.modifiedAt).toLocaleDateString() : '-'}
              </p>
            </div>

            {/* Context menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 ml-2"
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
