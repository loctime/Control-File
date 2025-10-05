'use client';

import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { formatFileSize, isImageFile, isVideoFile, isPDFFile } from '@/lib/utils';
import { File, Share2, Play } from 'lucide-react';
import { useFileDownloadUrl } from '@/hooks/useFileDownloadUrl';
import { useEffect, useRef } from 'react';

interface FileItemProps {
  file: any;
  isSelected: boolean;
  // Opcionales para selección por rango con Shift
  itemIndex?: number;
  onShiftRangeSelect?: (itemIndex: number) => void;
  onSetAnchor?: (itemIndex: number) => void;
  // Para selección por arrastre
  itemRef?: React.RefObject<HTMLDivElement>;
}

export function FileItem({ file, isSelected, itemIndex, onShiftRangeSelect, onSetAnchor, itemRef }: FileItemProps) {
  const { toggleItemSelection } = useDriveStore();
  const { setDetailsPanelOpen, viewMode, iconSize, autoplayVideoThumbnails, videoPreviewOnHover } = useUIStore();
  const { downloadUrl, loading } = useFileDownloadUrl(
    file?.id || null,
    // Solo obtener URL cuando: es imagen, o es video y (autoplay o hover activo y seleccionado/hover)
    isImageFile(file?.mime || '') || isVideoFile(file?.mime || '')
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isVideoFile(file?.mime || '')) return;
    const video = videoRef.current;
    if (!video) return;
    const shouldPlay = isSelected && autoplayVideoThumbnails;
    if (shouldPlay) {
      video.play().catch(() => {});
    } else {
      try {
        video.pause();
        video.currentTime = 0;
      } catch {}
    }
  }, [isSelected, autoplayVideoThumbnails, file?.mime]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Manejo de rango con Shift
    if (e.shiftKey && onShiftRangeSelect !== undefined && typeof itemIndex === 'number') {
      onShiftRangeSelect(itemIndex);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      toggleItemSelection(file.id, true);
      if (onSetAnchor !== undefined && typeof itemIndex === 'number') {
        onSetAnchor(itemIndex);
      }
    } else {
      toggleItemSelection(file.id, false);
      if (onSetAnchor !== undefined && typeof itemIndex === 'number') {
        onSetAnchor(itemIndex);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    console.log('🖱️ FileItem - clic derecho en archivo:', file.id);
    // Si el archivo no está seleccionado, seleccionarlo y permitir que el menú se abra
    if (!isSelected) {
      toggleItemSelection(file.id, false);
    }
  };

  const handleDoubleClick = () => {
    // Seleccionar el archivo y abrir el panel de detalles
    toggleItemSelection(file.id, false);
    setDetailsPanelOpen(true);
    console.log('Abrir panel de detalles para archivo:', file.id);
  };

  // Determinar el tamaño del icono basado en el estado
  const getIconSize = () => {
    switch (iconSize) {
      case 'extra-large': return 'h-8 w-8';
      case 'large': return 'h-6 w-6';
      case 'small': return 'h-4 w-4';
      default: return 'h-5 w-5'; // medium
    }
  };

  // Renderizar según el modo de vista
  if (viewMode === 'list') {
    return (
      <div
        ref={itemRef}
        className={`
          flex items-center p-3 rounded-lg cursor-pointer
          hover:bg-accent/50 transition-colors group relative
          ${isSelected ? 'bg-accent text-accent-foreground ring-2 ring-primary' : ''}
        `}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        data-item-id={file.id}
      >
        {/* Icono del archivo o miniatura */}
        <div className="flex-shrink-0 mr-3">
          {isImageFile(file?.mime || '') && downloadUrl ? (
            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted/30 flex items-center justify-center">
              <img
                src={downloadUrl}
                alt={file.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ) : isVideoFile(file?.mime || '') && downloadUrl ? (
            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted/30 flex items-center justify-center relative">
              <video
                ref={videoRef}
                src={downloadUrl}
                className="w-full h-full object-cover"
                muted
                playsInline
                loop
                preload="metadata"
                onMouseEnter={() => {
                  if (videoPreviewOnHover && !autoplayVideoThumbnails) {
                    videoRef.current?.play().catch(() => {});
                  }
                }}
                onMouseLeave={() => {
                  if (videoPreviewOnHover && !autoplayVideoThumbnails) {
                    try {
                      videoRef.current?.pause();
                      if (videoRef.current) videoRef.current.currentTime = 0;
                    } catch {}
                  }
                }}
              />
              {!(isSelected || (videoPreviewOnHover && !autoplayVideoThumbnails)) && (
                <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                  <Play className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          ) : isPDFFile(file?.mime || '') ? (
            <div className="w-12 h-12 rounded-md bg-red-500/10 dark:bg-red-900/30 text-red-600 dark:text-red-300 flex items-center justify-center">
              <span className="text-xs font-bold">PDF</span>
            </div>
          ) : (
            <File className={`${getIconSize()} text-blue-500`} />
          )}
        </div>

        {/* Nombre del archivo */}
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate" title={file.name}>
            {file.name}
          </p>
        </div>

        {/* Tamaño del archivo */}
        <div className="flex-shrink-0 ml-2">
          <p className="text-xs text-muted-foreground">
            {file.size ? formatFileSize(file.size) : '-'}
          </p>
        </div>

        {/* Tipo/MIME */}
        <div className="flex-shrink-0 ml-4">
          <p className="text-xs text-muted-foreground truncate w-20" title={file.mime || ''}>
            {(file?.mime?.split('/')?.[1] || file?.name?.split('.').pop() || '')?.toUpperCase() || '-'}
          </p>
        </div>

        {/* Fecha de modificación */}
        <div className="flex-shrink-0 ml-4">
          <p className="text-xs text-muted-foreground">
            {file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : '-'}
          </p>
        </div>
        
        {/* Indicador de selección */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-primary-foreground rounded-full" />
          </div>
        )}

        {/* Botón Compartir */}
        <button
          className="ml-4 opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded border hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation();
            const event = new CustomEvent('file-share-click', { detail: { fileId: file.id } });
            window.dispatchEvent(event);
          }}
          title="Compartir"
        >
          <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" /> Compartir</span>
        </button>
      </div>
    );
  }

  // Vista de iconos (grid)
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
      style={{ 
        minWidth: iconSize === 'extra-large' ? '220px' : 
                  iconSize === 'large' ? '180px' : 
                  iconSize === 'small' ? '120px' : '160px',
        maxWidth: iconSize === 'extra-large' ? '220px' : 
                  iconSize === 'large' ? '180px' : 
                  iconSize === 'small' ? '120px' : '160px'
      }}
      data-item-id={file.id}
    >
      <div className={`${iconSize === 'extra-large' ? 'w-32 h-32' : 
                       iconSize === 'large' ? 'w-24 h-24' : 
                       iconSize === 'small' ? 'w-16 h-16' : 'w-20 h-20'} 
                       mb-2 flex items-center justify-center overflow-hidden rounded-md bg-muted/30`}>
        {isImageFile(file?.mime || '') && downloadUrl ? (
          <img
            src={downloadUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : isVideoFile(file?.mime || '') && downloadUrl ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              src={downloadUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
              loop
              preload="metadata"
              onMouseEnter={() => {
                if (videoPreviewOnHover && !autoplayVideoThumbnails) {
                  videoRef.current?.play().catch(() => {});
                }
              }}
              onMouseLeave={() => {
                if (videoPreviewOnHover && !autoplayVideoThumbnails) {
                  try {
                    videoRef.current?.pause();
                    if (videoRef.current) videoRef.current.currentTime = 0;
                  } catch {}
                }
              }}
            />
            {!(isSelected || (videoPreviewOnHover && !autoplayVideoThumbnails)) && (
              <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                <Play className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
        ) : isPDFFile(file?.mime || '') ? (
          <div className="w-full h-full bg-red-500/10 dark:bg-red-900/30 text-red-600 dark:text-red-300 flex items-center justify-center rounded">
            <span className="text-xs font-bold">PDF</span>
          </div>
        ) : (
          <File className={`${getIconSize()} text-blue-500`} />
        )}
      </div>
      <span className={`text-center break-words leading-tight ${
        iconSize === 'extra-large' ? 'text-sm' : 
        iconSize === 'large' ? 'text-xs' : 
        iconSize === 'small' ? 'text-xs' : 'text-xs'
      }`}>
        {file.name}
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
