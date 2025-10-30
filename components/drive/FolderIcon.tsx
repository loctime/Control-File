'use client';

import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { Folder } from 'lucide-react';

interface FolderIconProps {
  folder: any;
  onClick: () => void;
  isSelected: boolean;
  // Opcionales para selección por rango con Shift
  itemIndex?: number;
  onShiftRangeSelect?: (itemIndex: number) => void;
  onSetAnchor?: (itemIndex: number) => void;
  // Para selección por arrastre
  itemRef?: React.RefObject<HTMLDivElement>;
}

export function FolderIcon({ folder, onClick, isSelected, itemIndex, onShiftRangeSelect, onSetAnchor, itemRef }: FolderIconProps) {
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
      onClick();
      if (onSetAnchor !== undefined && typeof itemIndex === 'number') {
        onSetAnchor(itemIndex);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    console.log('🖱️ FolderIcon - clic derecho en carpeta:', folder.id);
    // Si la carpeta no está seleccionada, seleccionarla
    if (!isSelected) {
      toggleItemSelection(folder.id, false);
    }
  };

  const handleDoubleClick = () => {
    // Seleccionar la carpeta y abrir el panel de detalles
    toggleItemSelection(folder.id, false);
    setDetailsPanelOpen(true);
    console.log('Abrir panel de detalles para carpeta:', folder.id);
  };

  // Determinar el tamaño del icono basado en el estado
  const getIconSize = () => {
    switch (iconSize) {
      case 'extra-large': return 'w-16 h-16';
      case 'large': return 'w-12 h-12';
      case 'small': return 'w-8 h-8';
      default: return 'w-12 h-12'; // medium
    }
  };

  // Determinar el tamaño del contenedor
  const getContainerSize = () => {
    switch (iconSize) {
      case 'extra-large': return 'w-20 h-20';
      case 'large': return 'w-16 h-16';
      case 'small': return 'w-12 h-12';
      default: return 'w-16 h-16'; // medium
    }
  };

  // Ancho del contenedor gestionado por grid con minmax; sin fijar ancho aquí

  return (
    <div
      ref={itemRef}
      className={`
        flex flex-col items-center p-4 rounded-lg cursor-pointer
        hover:bg-accent/50 transition-colors group relative
        ${isSelected ? 'bg-accent text-accent-foreground ring-2 ring-primary' : ''}
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      data-item-id={folder.id}
    >
      <div className={`${getContainerSize()} mb-2 flex items-center justify-center`}>
        <Folder className={`${getIconSize()} text-yellow-500`} />
      </div>
      <span className={`text-center break-words leading-tight ${
        iconSize === 'extra-large' ? 'text-sm' : 
        iconSize === 'large' ? 'text-xs' : 
        iconSize === 'small' ? 'text-xs' : 'text-xs'
      }`}>
        {folder.name}
      </span>
      
      {/* Indicador de selección */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-primary-foreground rounded-full" />
        </div>
      )}
    </div>
  );
}
