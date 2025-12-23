'use client';

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useProxyUpload } from '@/hooks/useProxyUpload';
// import { useDragSelection } from '@/hooks/useDragSelection';
import { formatFileSize } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  PanelRight, 
  Plus, 
  Eye, 
  List, 
  Grid, 
  FileText, 
  Monitor,
  Square,
  MonitorOff,
  Smartphone,
  File,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { FileItem } from './FileItem';
import { FolderIcon } from './FolderIcon';
import { EmptyState } from './EmptyState';
import { DragDropLoader } from './DragDropLoader';
import { FolderListItem } from './FolderListItem';
// import { SelectionRectangle } from './SelectionRectangle';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { collection, query as fsQuery, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/lib/stores/auth';
import { useNavigation } from '@/hooks/useNavigation';

interface FileContentAreaProps {
  files: any[];
  subfolders: any[];
  loading: boolean;
  currentFolderId: string | null;
  selectedItems: string[];
  onFolderClick: (folderId: string) => void;
  onBackgroundClick: (e: React.MouseEvent) => void;
}

export function FileContentArea({
  files,
  subfolders,
  loading,
  currentFolderId,
  selectedItems,
  onFolderClick,
  onBackgroundClick
}: FileContentAreaProps) {
  const { toggleDetailsPanel, detailsPanelOpen, viewMode, iconSize, setViewMode, setIconSize, addToast } = useUIStore();
  const { uploadFile } = useProxyUpload();
  const { setMainFolder, getMainFolder, setSelectedItems, getMainFolders, items, breadcrumb } = useDriveStore();
  const { navigateToFolder } = useNavigation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggedFiles, setDraggedFiles] = useState<File[]>([]);
  // Anchor para selección por rango (índice lineal a través de carpetas + archivos)
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  // Estado de orden
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type' | 'modifiedAt' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Referencias para selección por arrastre (DESACTIVADO)
  // const containerRef = useRef<HTMLDivElement>(null);
  // const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Hook de selección por arrastre (DESACTIVADO)
  // const { dragState, handleMouseDown: handleDragMouseDown } = useDragSelection({
  //   onSelectionChange: setSelectedItems,
  //   containerRef,
  //   itemRefs,
  //   selectedItems,
  //   multiSelect: true
  // });
  
  // Estado dummy para evitar errores
  const dragState = { isSelecting: false, selectionRect: null };
  const handleDragMouseDown = () => {};

  // Archivos ordenados según preferencia
  const sortedFiles = useMemo(() => {
    const filesCopy = [...files];
    const getValue = (f: any) => {
      switch (sortBy) {
        case 'size': return f.size ?? 0;
        case 'type': return (f.mime ?? '').toString().toLowerCase();
        case 'modifiedAt': return f.modifiedAt ? new Date(f.modifiedAt).getTime() : 0;
        case 'createdAt': return f.createdAt ? new Date(f.createdAt).getTime() : 0;
        case 'name':
        default: return (f.name ?? '').toString().toLowerCase();
      }
    };
    filesCopy.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return sortOrder === 'asc' ? -1 : 1;
      if (va > vb) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return filesCopy;
  }, [files, sortBy, sortOrder]);

  // Carpetas ordenadas según preferencia (carpetas no tienen tamaño; tipo se trata como 'folder')
  const sortedFolders = useMemo(() => {
    const foldersCopy = [...subfolders];
    const getValue = (f: any) => {
      switch (sortBy) {
        case 'size': return 0;
        case 'type': return 'folder';
        case 'modifiedAt': return f.modifiedAt ? new Date(f.modifiedAt).getTime() : 0;
        case 'createdAt': return f.createdAt ? new Date(f.createdAt).getTime() : 0;
        case 'name':
        default: return (f.name ?? '').toString().toLowerCase();
      }
    };
    foldersCopy.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return sortOrder === 'asc' ? -1 : 1;
      if (va > vb) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return foldersCopy;
  }, [subfolders, sortBy, sortOrder]);

  // Lista lineal combinada para cálculo de rangos, mantiene orden visual: primero subfolders, luego files
  const linearItems = useMemo(() => {
    // Normalizamos objetos con id y un flag de tipo para identificar la lista de origen
    return [
      ...subfolders.map((f: any) => ({ id: f.id, __kind: 'folder' as const })),
      ...sortedFiles.map((f: any) => ({ id: f.id, __kind: 'file' as const })),
    ];
  }, [subfolders, sortedFiles]);

  const handleShiftRangeSelect = useCallback((targetIndex: number) => {
    if (anchorIndex === null) {
      setAnchorIndex(targetIndex);
      const onlyTarget = linearItems[targetIndex]?.id ? [linearItems[targetIndex].id] : [];
      setSelectedItems(onlyTarget);
      return;
    }
    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    const rangeIds = linearItems.slice(start, end + 1).map(i => i.id);
    setSelectedItems(rangeIds);
  }, [anchorIndex, linearItems, setSelectedItems]);

  const handleSetAnchor = useCallback((idx: number) => {
    setAnchorIndex(idx);
  }, []);

  // Funciones para manejar el ordenamiento por columnas
  const handleSortColumn = useCallback((column: 'name' | 'size' | 'type' | 'modifiedAt' | 'createdAt') => {
    if (sortBy === column) {
      // Si es la misma columna, cambiar el orden
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Si es una columna diferente, establecer orden ascendente por defecto
      setSortBy(column);
      setSortOrder('asc');
    }
  }, [sortBy, sortOrder]);

  // Función para registrar referencias de elementos (DESACTIVADO)
  // const registerItemRef = useCallback((itemId: string, element: HTMLDivElement | null) => {
  //   if (element) {
  //     itemRefs.current.set(itemId, element);
  //     console.log('📌 Registrada referencia para:', itemId, element);
  //   } else {
  //     itemRefs.current.delete(itemId);
  //     console.log('🗑️ Eliminada referencia para:', itemId);
  //   }
  // }, []);
  
  // Map para almacenar referencias de elementos
  const itemRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());
  
  // Función para obtener o crear una referencia
  const getItemRef = (itemId: string): React.RefObject<HTMLDivElement> => {
    if (!itemRefs.current.has(itemId)) {
      itemRefs.current.set(itemId, React.createRef<HTMLDivElement>());
    }
    return itemRefs.current.get(itemId)!;
  };

  // Drag and drop for file upload
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setDraggedFiles([]); // Limpiar archivos arrastrados
    acceptedFiles.forEach(file => {
      uploadFile.mutate({ file, parentId: currentFolderId });
    });
  }, [uploadFile, currentFolderId]);

  const onDragEnter = useCallback((event: any) => {
    setDraggedFiles(Array.from(event.dataTransfer.files || []));
  }, []);

  const onDragLeave = useCallback(() => {
    setDraggedFiles([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter,
    onDragLeave,
    noClick: true,
    noKeyboard: true,
    disabled: true, // Deshabilitado para evitar doble manejo: el drop global vive en FileExplorer
  });

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        uploadFile.mutate({ file, parentId: currentFolderId });
      });
    }
    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    event.target.value = '';
  };

  const handleSetMainFolder = async () => {
    if (!currentFolderId) return;
    
    try {
      await setMainFolder(currentFolderId);
      
      // Obtener el nombre de la carpeta actual
      const currentFolder = subfolders.find(folder => folder.id === currentFolderId) || 
                           files.find(file => file.id === currentFolderId);
      
      const folderName = currentFolder?.name || 'Carpeta';
      
      addToast({
        type: 'success',
        title: 'Carpeta principal establecida',
        message: `"${folderName}" es ahora tu carpeta principal`,
      });
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'No se pudo establecer la carpeta principal',
      });
    }
  };

  // Botón Atrás: navegar al parentId si existe
  const currentFolderItem = useMemo(() => {
    return items.find((i: any) => i.id === currentFolderId);
  }, [items, currentFolderId]);

  const parentFolderId = currentFolderItem?.parentId || null;
  const canGoBack = Boolean(parentFolderId);
  const handleGoBack = () => {
    if (parentFolderId) {
      navigateToFolder(parentFolderId);
    }
  };

  // Breadcrumb clicable se renderiza directamente en la UI
  const fullBreadcrumbPath = useMemo(() => (breadcrumb || []).map((b: any) => b.name).join(' / '), [breadcrumb]);
  const lastBreadcrumbId = useMemo(() => {
    return (breadcrumb && breadcrumb.length > 0) ? breadcrumb[breadcrumb.length - 1].id : null;
  }, [breadcrumb]);
  const compactBreadcrumb = useMemo(() => {
    const list = breadcrumb || [];
    if (list.length <= 4) return list.map((b: any) => ({ kind: 'item' as const, item: b }));
    const head = list[0];
    const tail = list.slice(list.length - 3);
    return [
      { kind: 'item' as const, item: head },
      { kind: 'ellipsis' as const },
      ...tail.map((b: any) => ({ kind: 'item' as const, item: b }))
    ];
  }, [breadcrumb]);

  // Prefetch de contenido de carpetas para mejorar reactividad
  const prefetchFolderItems = useCallback(async (folderId: string) => {
    try {
      if (!db || !user?.uid) return;
      const items: any[] = [];
      const foldersRef = collection(db, 'folders');
      const qFolders = fsQuery(
        foldersRef,
        where('userId', '==', user.uid),
        where('parentId', '==', folderId),
        orderBy('createdAt', 'desc')
      );
      const foldersSnap = await getDocs(qFolders);
      foldersSnap.forEach((doc) => {
        const data: any = doc.data();
        items.push({ ...data, id: doc.id, type: 'folder', createdAt: data.createdAt?.toDate?.() || new Date(), modifiedAt: data.modifiedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date() });
      });

      const filesRef = collection(db, 'files');
      const qFiles = fsQuery(
        filesRef,
        where('userId', '==', user.uid),
        where('parentId', '==', folderId),
        orderBy('name', 'asc')
      );
      const filesSnap = await getDocs(qFiles);
      filesSnap.forEach((doc) => {
        const data: any = doc.data();
        items.push({ ...data, id: doc.id, type: 'file', createdAt: data.createdAt?.toDate?.() || new Date(), modifiedAt: data.modifiedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date() });
      });

      queryClient.setQueryData(['files', user.uid, folderId], items);
    } catch {
      // Silenciar errores de prefetch
    }
  }, [queryClient, user]);

  // Prefetch del padre para navegación rápida con botón Atrás
  useEffect(() => {
    if (parentFolderId) prefetchFolderItems(parentFolderId);
  }, [parentFolderId, prefetchFolderItems]);

  // Loader integrado se maneja dentro del contenido para no ocultar la barra de acciones

  if (!currentFolderId) {
    const hasMainFolders = getMainFolders().length > 0;
    if (!hasMainFolders) {
      return <EmptyState />;
    }
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      // ref={containerRef}
      {...getRootProps()}
      className={`flex-1 flex relative ${
        isDragActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
      onClick={onBackgroundClick}
    >
      <input {...getInputProps()} />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* File list/grid */}
      <div className="flex-1 overflow-auto p-4 pb-20">
        <div className="space-y-4">
          {/* Barra de acciones y contenido combinado */}
          <div>
                             <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGoBack}
                    disabled={!canGoBack}
                    title={canGoBack ? 'Volver a la carpeta anterior' : 'Ya estás en el nivel superior'}
                    className="h-6 px-2"
                  >
                    <ChevronLeft className="h-3 w-3 mr-1" />
                    Atrás
                  </Button>
                  {/* Botón +Nuevo */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        <Plus className="h-3 w-3 mr-1" />
                        Nuevo
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleUploadClick}>
                        <FileText className="h-4 w-4 mr-2" />
                        Subir archivos
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {/* Botones de Vista directos */}
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-6 px-2"
                    title="Vista de lista con detalles"
                  >
                    <List className="h-3 w-3" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-6 px-2"
                    title="Vista de iconos"
                  >
                    <Grid className="h-3 w-3" />
                  </Button>
                  
                  {/* Separador visual */}
                  <div className="h-4 w-px bg-border mx-1" />
                  
                  {/* Columnas de ordenamiento */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSortColumn('name')}
                    className={`h-6 px-2 text-xs flex items-center gap-1 ${
                      sortBy === 'name' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileText className="h-3 w-3" />
                    Nombre
                    {sortBy === 'name' && (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSortColumn('size')}
                    className={`h-6 px-2 text-xs flex items-center gap-1 ${
                      sortBy === 'size' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Square className="h-3 w-3" />
                    Tamaño
                    {sortBy === 'size' && (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSortColumn('type')}
                    className={`h-6 px-2 text-xs flex items-center gap-1 ${
                      sortBy === 'type' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <File className="h-3 w-3" />
                    Tipo
                    {sortBy === 'type' && (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSortColumn('modifiedAt')}
                    className={`h-6 px-2 text-xs flex items-center gap-1 ${
                      sortBy === 'modifiedAt' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    Modificado
                    {sortBy === 'modifiedAt' && (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSortColumn('createdAt')}
                    className={`h-6 px-2 text-xs flex items-center gap-1 ${
                      sortBy === 'createdAt' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    Creado
                    {sortBy === 'createdAt' && (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {currentFolderId && (
                    <div className="flex items-center gap-1 max-w-[420px] overflow-hidden" title={fullBreadcrumbPath}>
                      {compactBreadcrumb.map((entry: any, index: number) => (
                        <div key={entry.kind === 'item' ? entry.item.id : `ellipsis-${index}`} className="flex items-center">
                          {index > 0 && (
                            <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground" />
                          )}
                          {entry.kind === 'ellipsis' ? (
                            <span className="text-muted-foreground text-sm px-1">…</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-6 px-2 text-sm ${entry.item.id === lastBreadcrumbId ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                              onClick={() => navigateToFolder(entry.item.id)}
                              disabled={entry.item.id === lastBreadcrumbId}
                              title={entry.item.name}
                            >
                              {entry.item.name}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {currentFolderId && (
                    <Button
                      variant={getMainFolder() === currentFolderId ? 'default' : 'ghost'}
                      size="sm"
                      onClick={handleSetMainFolder}
                      title={getMainFolder() === currentFolderId ? 'Carpeta principal actual' : 'Marcar como carpeta principal'}
                      className="h-6 px-2"
                    >
                      <Star className={`h-3 w-3 mr-1 ${getMainFolder() === currentFolderId ? 'fill-current' : ''}`} />
                      Principal
                    </Button>
                  )}
                  {!detailsPanelOpen && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleDetailsPanel}
                      title="Atajo: barra espaciadora"
                      className="h-6 px-2"
                    >
                      <PanelRight className="h-3 w-3 mr-1" />
                      Detalles
                    </Button>
                  )}
                </div>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Cargando...</span>
                  </div>
                </div>
              ) : (sortedFolders.length + sortedFiles.length) > 0 ? (
                viewMode === 'list' ? (
                  <div className="space-y-4">
                    {/* Carpetas en formato de lista */}
                    {sortedFolders.length > 0 && (
                      <div className="space-y-2">
                        {sortedFolders.map((folder, folderIdx) => (
                          <FolderListItem
                            key={folder.id}
                            folder={folder}
                            isSelected={selectedItems.includes(folder.id)}
                            onOpen={() => navigateToFolder(folder.id)}
                            itemIndex={folderIdx}
                            onShiftRangeSelect={handleShiftRangeSelect}
                            onSetAnchor={handleSetAnchor}
                            itemRef={getItemRef(folder.id)}
                          />
                        ))}
                      </div>
                    )}
                    {/* Archivos usando FileItem para consistencia */}
                    {sortedFiles.length > 0 && (
                      <div className="space-y-2">
                        {sortedFiles.map((file, fileIdx) => (
                          <FileItem
                            key={file.id}
                            file={file}
                            isSelected={selectedItems.includes(file.id)}
                            itemIndex={sortedFolders.length + fileIdx}
                            onShiftRangeSelect={handleShiftRangeSelect}
                            onSetAnchor={handleSetAnchor}
                            itemRef={getItemRef(file.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))] gap-4">
                    {sortedFolders.map((folder, folderIdx) => (
                      <FolderIcon
                        key={folder.id}
                        folder={folder}
                        onClick={() => onFolderClick(folder.id)}
                        isSelected={selectedItems.includes(folder.id)}
                        itemIndex={folderIdx}
                        onShiftRangeSelect={handleShiftRangeSelect}
                        onSetAnchor={handleSetAnchor}
                        itemRef={getItemRef(folder.id)}
                      />
                    ))}
                    {sortedFiles.map((file, fileIdx) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        isSelected={selectedItems.includes(file.id)}
                        itemIndex={sortedFolders.length + fileIdx}
                        onShiftRangeSelect={handleShiftRangeSelect}
                        onSetAnchor={handleSetAnchor}
                        itemRef={getItemRef(file.id)}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-2">Carpeta vacía</p>
                    <p className="text-sm">Arrastra archivos aquí o usa el botón "Nuevo"</p>
                  </div>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Drag and Drop Loader */}
      <DragDropLoader 
        isDragOver={isDragActive} 
        files={draggedFiles}
      />

      {/* Selection Rectangle (DESACTIVADO) */}
      {/* <SelectionRectangle 
        rect={dragState.selectionRect}
        isVisible={dragState.isSelecting}
      /> */}
    </div>
  );
}
