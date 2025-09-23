'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/lib/stores/ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ContextMenu } from '@/components/drive/ContextMenu';
import { 
  Folder, 
  Image, 
  FileText, 
  Monitor, 
  ChevronRight,
  Plus,
  MoreHorizontal,
  PanelLeft,
  Trash2
} from 'lucide-react';
import { DriveItem, DriveFolder } from '@/types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  width?: number;
}

export function Sidebar({ isOpen, onToggle, width = 320 }: SidebarProps) {
  const { user } = useAuth();
  const { 
    currentFolderId, 
    items, 
    setCurrentFolderId, 
    createSubfolder, 
    getSubfolders,
    getMainFolders,
    toggleItemSelection,
    removeItem
  } = useDriveStore();
  const { toggleSidebar, closeTrashView } = useUIStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  // Obtener todas las carpetas principales (incluyendo las por defecto)
  const allMainFolders = getMainFolders();

  // Obtener la carpeta principal actual basada en el currentFolderId
  const currentMainFolder = useMemo(() => {
    // Si currentFolderId es una de las carpetas principales
    const mainFolder = allMainFolders.find(f => f.id === currentFolderId);
    if (mainFolder) return mainFolder;
    
    // Si no, buscar la carpeta padre hasta encontrar una principal
    const findMainFolder = (folderId: string): string | null => {
      const item = items.find(i => i.id === folderId);
      if (!item || item.type !== 'folder') return null;
      
      // Si el parentId es null o es una carpeta principal
      if (!item.parentId || allMainFolders.find(f => f.id === item.parentId)) {
        return item.parentId || null;
      }
      
      // Recursivamente buscar hacia arriba
      return findMainFolder(item.parentId);
    };
    
    const mainFolderId = findMainFolder(currentFolderId || '');
    return allMainFolders.find(f => f.id === mainFolderId) || allMainFolders[0] || null;
  }, [currentFolderId, items, allMainFolders]);

  // Obtener subcarpetas usando la función del store
  const subfolders = currentMainFolder ? getSubfolders(currentMainFolder.id) : [];

  // Clave de almacenamiento para recordar el árbol expandido por usuario y carpeta principal
  const expansionStorageKey = useMemo(() => {
    const uid = user?.uid || 'anonymous';
    const mainId = currentMainFolder?.id || 'no-main';
    return `drive:expandedFolders:${uid}:${mainId}`;
  }, [user?.uid, currentMainFolder?.id]);

  // Cargar estado de expansión desde localStorage al montar o cambiar de carpeta principal
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(expansionStorageKey) : null;
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        setExpandedFolders(new Set(ids));
      } else {
        setExpandedFolders(new Set());
      }
    } catch (e) {
      // Ignorar errores de parseo/almacenamiento
      setExpandedFolders(new Set());
    }
  }, [expansionStorageKey]);

  // Guardar cambios de expansión en localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(expansionStorageKey, JSON.stringify(Array.from(expandedFolders)));
      }
    } catch (e) {
      // Ignorar errores de almacenamiento
    }
  }, [expandedFolders, expansionStorageKey]);

  // Expandir automáticamente las carpetas padre cuando cambia la carpeta actual
  useEffect(() => {
    if (currentFolderId && currentMainFolder && currentFolderId !== currentMainFolder.id) {
      const expandParentFolders = (folderId: string) => {
        const item = items.find(i => i.id === folderId);
        if (item && item.type === 'folder' && item.parentId && item.parentId !== currentMainFolder.id) {
          setExpandedFolders(prev => new Set(Array.from(prev).concat([item.parentId!])));
          expandParentFolders(item.parentId);
        }
      };
      expandParentFolders(currentFolderId);
    }
  }, [currentFolderId, items, currentMainFolder?.id]);

  // Manejar expansión/contracción de carpetas
  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // Manejar clic en carpeta
  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId);
    
    // Cerrar la papelera si está abierta
    closeTrashView();
    
    // Expandir automáticamente las carpetas padre si es una subcarpeta
    if (currentMainFolder && folderId !== currentMainFolder.id) {
      const expandParentFolders = (folderId: string) => {
        const item = items.find(i => i.id === folderId);
        if (item && item.type === 'folder' && item.parentId && item.parentId !== currentMainFolder.id) {
          setExpandedFolders(prev => new Set(Array.from(prev).concat([item.parentId!])));
          expandParentFolders(item.parentId);
        }
      };
      expandParentFolders(folderId);
    }
  };

  // Crear subcarpeta
  const handleCreateSubfolder = (parentId: string) => {
    if (newFolderName.trim()) {
      createSubfolder(newFolderName, parentId);
      setNewFolderName('');
      setIsCreatingSubfolder(null);
      // Expandir la carpeta padre automáticamente
      setExpandedFolders(prev => new Set(Array.from(prev).concat([parentId])));
    }
  };

  // Función para obtener el icono y color de una carpeta
  const getFolderIconAndColor = (folder: DriveItem) => {
    if (folder.type !== 'folder') return { IconComponent: Folder, color: 'text-gray-600' };
    
    const driveFolder = folder as DriveFolder & { type: 'folder' };
    const iconName = driveFolder.metadata?.icon || 'Folder';
    const color = driveFolder.metadata?.color || 'text-blue-500';
    
    // Mapear nombres de iconos a componentes
    const iconMap: { [key: string]: any } = {
      'Folder': Folder,
      'Image': Image,
      'FileText': FileText,
      'Monitor': Monitor
    };
    
    const IconComponent = iconMap[iconName] || Folder;
    return { IconComponent, color };
  };

  // Handlers para ContextMenu
  const handleOpenItem = useCallback((itemId: string) => {
    setCurrentFolderId(itemId);
  }, [setCurrentFolderId]);

  const handleRenameItem = useCallback((itemId: string) => {
    // TODO: Implementar renombrar
    console.log('Renombrar item:', itemId);
  }, []);

  const handleCopyItem = useCallback((itemId: string) => {
    // TODO: Implementar copiar
    console.log('Copiar item:', itemId);
  }, []);

  const handleCutItem = useCallback((itemId: string) => {
    // TODO: Implementar cortar
    console.log('Cortar item:', itemId);
  }, []);

  const handleDeleteItem = useCallback((itemId: string) => {
    removeItem(itemId);
  }, [removeItem]);

  const handleShareItem = useCallback((itemId: string) => {
    // TODO: Implementar compartir
    console.log('Compartir item:', itemId);
  }, []);

  const handleShowProperties = useCallback((itemId: string) => {
    // TODO: Implementar propiedades
    console.log('Mostrar propiedades:', itemId);
  }, []);

  const handleCreateFolder = useCallback(() => {
    // TODO: Implementar crear carpeta
    console.log('Crear carpeta');
  }, []);

  const handlePasteItems = useCallback(() => {
    // TODO: Implementar pegar
    console.log('Pegar items');
  }, []);

  const handleSelectAll = useCallback(() => {
    // TODO: Implementar seleccionar todo
    console.log('Seleccionar todo');
  }, []);

  // Renderizar carpeta y sus subcarpetas recursivamente
  const renderFolder = (folder: DriveItem, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const folderSubfolders = getSubfolders(folder.id);
    const isSelected = currentFolderId === folder.id;
    const hasSubfolders = folderSubfolders.length > 0;
    const { IconComponent, color } = getFolderIconAndColor(folder);

    return (
      <div key={folder.id}>
        <ContextMenu
          onOpenItem={handleOpenItem}
          onRenameItem={handleRenameItem}
          onCopyItem={handleCopyItem}
          onCutItem={handleCutItem}
          onDeleteItem={handleDeleteItem}
          onShareItem={handleShareItem}
          onShowProperties={handleShowProperties}
          onCreateFolder={handleCreateFolder}
          onPasteItems={handlePasteItems}
          onSelectAll={handleSelectAll}
        >
          <div
            className={`
              flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
              hover:bg-accent/50 transition-colors group
              ${isSelected ? 'bg-accent text-accent-foreground' : ''}
            `}
            style={{ paddingLeft: `${12 + level * 16}px` }}
            onContextMenu={() => toggleItemSelection(folder.id)}
          >
            <div 
              className="flex items-center space-x-2 flex-1"
              onClick={() => handleFolderClick(folder.id)}
            >
              {hasSubfolders ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolderExpansion(folder.id);
                  }}
                  className="p-1 hover:bg-accent/20 rounded"
                >
                  <ChevronRight 
                    className={`w-3 h-3 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`} 
                  />
                </button>
              ) : (
                <div className="w-5" />
              )}
              
              <IconComponent className={`w-4 h-4 ${color}`} />
              <span className="text-sm truncate">{folder.name}</span>
              
              {folderSubfolders.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {folderSubfolders.length}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreatingSubfolder(folder.id);
                }}
                className="p-1 hover:bg-accent/20 rounded"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button className="p-1 hover:bg-accent/20 rounded">
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </div>
          </div>
        </ContextMenu>

        {/* Input para crear subcarpeta */}
        {isCreatingSubfolder === folder.id && (
          <div 
            className="px-3 py-2"
            style={{ paddingLeft: `${12 + (level + 1) * 16}px` }}
          >
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre de carpeta"
                className="flex-1 px-2 py-1 text-xs border rounded bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateSubfolder(folder.id);
                  } else if (e.key === 'Escape') {
                    setIsCreatingSubfolder(null);
                    setNewFolderName('');
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => handleCreateSubfolder(folder.id)}
                disabled={!newFolderName.trim()}
                className="text-xs px-2 py-1"
              >
                Crear
              </Button>
            </div>
          </div>
        )}

        {/* Subcarpetas */}
        {isExpanded && folderSubfolders.map(subfolder => 
          renderFolder(subfolder, level + 1)
        )}
      </div>
    );
  };

    // Si no hay carpetas principales, mostrar mensaje
    if (!currentMainFolder) {
      return (
        <div 
          className="bg-card border-r border-border flex flex-col min-w-0 h-full"
          style={{ width: `${width}px` }}
        >
          {/* Header con botón de toggle */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center space-x-2">
              <Folder className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Sin carpetas</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="p-1"
              title="Ocultar panel de navegación"
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2 pb-16">
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Folder className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-sm mb-2">No hay carpetas creadas</p>
              <p className="text-xs">Crea tu primera carpeta desde la barra de navegación</p>
            </div>
          </div>
        </div>
      );
    }

    return (
    <div 
      className="bg-card border-r border-border flex flex-col min-w-0 h-full"
      style={{ width: `${width}px` }}
    >
      {/* Header con botón de toggle */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center space-x-2">
          {(() => {
            const { IconComponent, color } = getFolderIconAndColor(currentMainFolder);
            return <IconComponent className={`w-4 h-4 ${color}`} />;
          })()}
          <span className="text-sm font-medium">{currentMainFolder.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="p-1"
          title="Ocultar panel de navegación"
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 pb-16">
        <div className="space-y-1">
          {/* Carpeta principal */}
          <ContextMenu
            onOpenItem={handleOpenItem}
            onRenameItem={handleRenameItem}
            onCopyItem={handleCopyItem}
            onCutItem={handleCutItem}
            onDeleteItem={handleDeleteItem}
            onShareItem={handleShareItem}
            onShowProperties={handleShowProperties}
            onCreateFolder={handleCreateFolder}
            onPasteItems={handlePasteItems}
            onSelectAll={handleSelectAll}
          >
            <div
              className={`
                flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                hover:bg-accent/50 transition-colors group
                ${currentFolderId === currentMainFolder.id ? 'bg-accent text-accent-foreground' : ''}
              `}
              onClick={() => handleFolderClick(currentMainFolder.id)}
              onContextMenu={() => toggleItemSelection(currentMainFolder.id)}
            >
              <div className="flex items-center space-x-2">
                {(() => {
                  const { IconComponent, color } = getFolderIconAndColor(currentMainFolder);
                  return <IconComponent className={`w-4 h-4 ${color}`} />;
                })()}
                <span className="text-sm font-medium">{currentMainFolder.name}</span>
              </div>
              
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCreatingSubfolder(currentMainFolder.id);
                  }}
                  className="p-1 hover:bg-accent/20 rounded"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </ContextMenu>

          {/* Input para crear carpeta en la raíz */}
          {isCreatingSubfolder === currentMainFolder.id && (
            <div className="px-3 py-2">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nombre de carpeta"
                  className="flex-1 px-2 py-1 text-xs border rounded bg-background"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateSubfolder(currentMainFolder.id);
                    } else if (e.key === 'Escape') {
                      setIsCreatingSubfolder(null);
                      setNewFolderName('');
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => handleCreateSubfolder(currentMainFolder.id)}
                  disabled={!newFolderName.trim()}
                  className="text-xs px-2 py-1"
                >
                  Crear
                </Button>
              </div>
            </div>
          )}

          {/* Subcarpetas */}
          {subfolders.map(folder => renderFolder(folder))}

          {/* Mensaje cuando no hay subcarpetas */}
          {subfolders.length === 0 && !isCreatingSubfolder && (
            <div className="px-3 py-4 text-center text-muted-foreground">
              <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No hay subcarpetas</p>
              <p className="text-xs mt-1">Haz clic en + para crear una</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
