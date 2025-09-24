'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useProxyUpload } from '@/hooks/useProxyUpload';
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
  ArrowUpDown
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

  const handleSetMainFolder = () => {
    if (!currentFolderId) return;
    
    setMainFolder(currentFolderId);
    
    // Obtener el nombre de la carpeta actual
    const currentFolder = subfolders.find(folder => folder.id === currentFolderId) || 
                         files.find(file => file.id === currentFolderId);
    
    const folderName = currentFolder?.name || 'Carpeta';
    
    addToast({
      type: 'success',
      title: 'Carpeta principal establecida',
      message: `"${folderName}" es ahora tu carpeta principal`,
    });
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
                  <h3 className="text-sm font-medium text-muted-foreground">Archivos</h3>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        <Eye className="h-3 w-3 mr-1" />
                        Vista
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewMode('list')}>
                        <List className="h-4 w-4 mr-2" />
                        Lista
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem onClick={() => setViewMode('grid')}>
                        <Grid className="h-4 w-4 mr-2" />
                        Iconos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setViewMode('content')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Contenido
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Botón Ordenar */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        <ArrowUpDown className="h-3 w-3 mr-1" />
                        Ordenar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSortBy('name')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Nombre
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('size')}>
                        <Square className="h-4 w-4 mr-2" />
                        Tamaño
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('type')}>
                        <File className="h-4 w-4 mr-2" />
                        Tipo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('modifiedAt')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Fecha (modificación)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('createdAt')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Fecha (creación)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSortOrder('asc')}>
                        Ascendente
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortOrder('desc')}>
                        Descendente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                  <Button
                    variant={detailsPanelOpen ? 'default' : 'ghost'}
                    size="sm"
                    onClick={toggleDetailsPanel}
                    title="Atajo: barra espaciadora"
                    className="h-6 px-2"
                  >
                    <PanelRight className="h-3 w-3 mr-1" />
                    Detalles
                  </Button>
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
                      />
                    ))}
                  </div>
                ) : viewMode === 'content' ? (
                  <div className="space-y-4">
                    {sortedFolders.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                        {sortedFolders.map((folder, folderIdx) => (
                          <FolderIcon
                            key={folder.id}
                            folder={folder}
                            onClick={() => navigateToFolder(folder.id)}
                            isSelected={selectedItems.includes(folder.id)}
                            itemIndex={folderIdx}
                            onShiftRangeSelect={handleShiftRangeSelect}
                            onSetAnchor={handleSetAnchor}
                          />
                        ))}
                      </div>
                    )}
                    {sortedFiles.map((file) => (
                      <div key={file.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <File className="h-5 w-5 text-blue-500" />
                          <h4 className="font-medium">{file.name}</h4>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Tamaño: {file.size ? formatFileSize(file.size) : '-'}</p>
                          <p>Modificado: {file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : '-'}</p>
                          {file.mime && <p>Tipo: {file.mime}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {sortedFolders.map((folder, folderIdx) => (
                      <FolderIcon
                        key={folder.id}
                        folder={folder}
                        onClick={() => onFolderClick(folder.id)}
                        isSelected={selectedItems.includes(folder.id)}
                        itemIndex={folderIdx}
                        onShiftRangeSelect={handleShiftRangeSelect}
                        onSetAnchor={handleSetAnchor}
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
    </div>
  );
}
