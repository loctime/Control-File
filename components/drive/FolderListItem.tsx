'use client';

import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { Folder } from 'lucide-react';

interface FolderListItemProps {
  folder: any;
  isSelected: boolean;
  onOpen: () => void;
  // Opcionales para selección por rango con Shift
  itemIndex?: number;
  onShiftRangeSelect?: (itemIndex: number) => void;
  onSetAnchor?: (itemIndex: number) => void;
}

export function FolderListItem({ folder, isSelected, onOpen, itemIndex, onShiftRangeSelect, onSetAnchor }: FolderListItemProps) {
  const { toggleItemSelection } = useDriveStore();
  const { setDetailsPanelOpen, iconSize } = useUIStore();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Manejo de rango con Shift
    if (e.shiftKey && onShiftRangeSelect !== undefined && typeof itemIndex === 'number') {
      onShiftRangeSelect(itemIndex);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      toggleItemSelection(folder.id, true);
      if (onSetAnchor !== undefined && typeof itemIndex === 'number') {
        onSetAnchor(itemIndex);
      }
    } else {
      toggleItemSelection(folder.id, false);
      onOpen();
      if (onSetAnchor !== undefined && typeof itemIndex === 'number') {
        onSetAnchor(itemIndex);
      }
    }
  };

  const handleContextMenu = () => {
    if (!isSelected) {
      toggleItemSelection(folder.id, false);
    }
  };

  const handleDoubleClick = () => {
    toggleItemSelection(folder.id, false);
    setDetailsPanelOpen(true);
  };

  const getIconSize = () => {
    switch (iconSize) {
      case 'extra-large': return 'h-8 w-8';
      case 'large': return 'h-6 w-6';
      case 'small': return 'h-4 w-4';
      default: return 'h-5 w-5';
    }
  };

  const folderDate = folder.modifiedAt || folder.createdAt || null;

  return (
    <div
      className={`
        flex items-center p-3 rounded-lg cursor-pointer
        hover:bg-accent/50 transition-colors group relative
        ${isSelected ? 'bg-accent text-accent-foreground ring-2 ring-primary' : ''}
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      data-item-id={folder.id}
    >
      {/* Icono */}
      <div className="flex-shrink-0 mr-3">
        <Folder className={`${getIconSize()} text-yellow-500`} />
      </div>

      {/* Nombre */}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" title={folder.name}>
          {folder.name}
        </p>
      </div>

      {/* Tamaño */}
      <div className="flex-shrink-0 ml-2">
        <p className="text-xs text-muted-foreground">-</p>
      </div>

      {/* Tipo */}
      <div className="flex-shrink-0 ml-4">
        <p className="text-xs text-muted-foreground truncate w-20" title="Carpeta">
          CARPETA
        </p>
      </div>

      {/* Fecha */}
      <div className="flex-shrink-0 ml-4">
        <p className="text-xs text-muted-foreground">
          {folderDate ? new Date(folderDate).toLocaleDateString() : '-'}
        </p>
      </div>

      {/* Indicador de selección */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-primary-foreground rounded-full" />
        </div>
      )}
    </div>
  );
}


