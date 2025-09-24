'use client';

import { useState, useCallback, useMemo } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useAuth } from '@/hooks/useAuth';
import { useTaskbar } from '@/hooks/useTaskbar';
import { Button } from '@/components/ui/button';
import { Folder, Image, FileText, User, Monitor, Plus, Pin } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { ContextMenu } from '@/components/drive/ContextMenu';
import { DriveItem, DriveFolder } from '@/types';

export function Navbar() {
  const { setCurrentFolderId, createMainFolder, items, toggleItemSelection, moveToTrash } = useDriveStore();
  const { sidebarOpen, closeTrashView } = useUIStore();
  const { user } = useAuth();
  const { pinFolder, isFolderPinned } = useTaskbar();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Memoizar las carpetas para evitar re-renders innecesarios
  const folders = useMemo(() => {
    const userId = user?.uid;
    if (!userId) return [];
    // Filtrar carpetas directamente desde items para ser reactivo
    const mainFolders = items.filter(item => 
      item.type === 'folder' && 
      item.parentId === null &&
      item.metadata?.isMainFolder &&
      item.userId === userId &&
      !item.deletedAt // Excluir carpetas en la papelera
    );
    
    console.log('📁 Navbar - carpetas disponibles:', mainFolders.length);
    return mainFolders;
  }, [items, user]); // Ahora es reactivo a los cambios en items y usuario

  // Memoizar el handler para evitar re-creaciones
  const handleFolderClick = useCallback((folderId: string) => {
    setCurrentFolderId(folderId);
    // Cerrar la papelera si está abierta
    closeTrashView();
  }, [setCurrentFolderId, closeTrashView]);

  const handleCreateMainFolder = useCallback(() => {
    if (newFolderName.trim()) {
      console.log('📁 Creando carpeta:', newFolderName);
      createMainFolder(newFolderName, 'Folder', 'text-purple-600');
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  }, [newFolderName, createMainFolder]);

  const handleProfileClick = useCallback(() => {
    // TODO: Navegar a página de perfil
    console.log('Ir a perfil');
  }, []);

  // Handlers para ContextMenuu
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
    // Usar moveToTrash en lugar de removeItem para mover a la papelera
    moveToTrash(itemId);
  }, [moveToTrash]);

  const handleShareItem = useCallback((itemId: string) => {
    // TODO: Implementar compartir
    console.log('Compartir item:', itemId);
  }, []);

  const handleShowProperties = useCallback((itemId: string) => {
    // TODO: Implementar propiedades
    console.log('Mostrar propiedades:', itemId);
  }, []);

  const handleCreateFolder = useCallback(() => {
    setIsCreatingFolder(true);
  }, []);

  const handlePasteItems = useCallback(() => {
    // TODO: Implementar pegar
    console.log('Pegar items');
  }, []);

  const handleSelectAll = useCallback(() => {
    // TODO: Implementar seleccionar todo
    console.log('Seleccionar todo');
  }, []);

  // Función para obtener el icono y color de una carpeta
  const getFolderIconAndColor = useCallback((folder: DriveItem) => {
    if (folder.type !== 'folder') return { IconComponent: Folder, color: 'text-gray-600' };
    
    const driveFolder = folder as DriveFolder & { type: 'folder' };
    const iconName = driveFolder.metadata?.icon || 'Folder';
    const color = driveFolder.metadata?.color || 'text-purple-600';
    
    // Mapear nombres de iconos a componentes
    const iconMap: { [key: string]: any } = {
      'Folder': Folder,
      'Image': Image,
      'FileText': FileText,
      'Monitor': Monitor
    };
    
    const IconComponent = iconMap[iconName] || Folder;
    return { IconComponent, color };
  }, []);

  return (
    <nav className="bg-card border-b-2 border-secondary px-4 py-2">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <h1 className="text-lg font-semibold">Control File</h1>
        </div>

        {/* Folder Navigation */}
        <div className="flex items-center space-x-1">
          {folders.map((folder) => {
            const { IconComponent, color } = getFolderIconAndColor(folder);
            
            return (
              <ContextMenu
                key={folder.id}
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
                <div className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFolderClick(folder.id)}
                    onContextMenu={() => toggleItemSelection(folder.id)}
                    className="flex items-center space-x-2 px-3 py-2"
                  >
                    <IconComponent className={`w-4 h-4 ${color}`} />
                    <span>{folder.name}</span>
                  </Button>
                  
                  {/* Botón de pin (solo visible en hover) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      pinFolder(folder.id, folder.name);
                    }}
                    className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ${
                      isFolderPinned(folder.id) 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                    title={isFolderPinned(folder.id) ? 'Ya está en el taskbar' : 'Anclar al taskbar'}
                  >
                    <Pin className={`w-3 h-3 ${isFolderPinned(folder.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </ContextMenu>
            );
          })}
          
          {/* Botón para crear nueva carpeta principal */}
          {isCreatingFolder ? (
            <div className="flex items-center space-x-2 px-3 py-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre de carpeta"
                className="px-2 py-1 text-sm border rounded bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateMainFolder();
                  } else if (e.key === 'Escape') {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleCreateMainFolder}
                disabled={!newFolderName.trim()}
                className="text-xs px-2 py-1"
              >
                Crear
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreatingFolder(true)}
              className="flex items-center space-x-2 px-3 py-2"
              title="Crear nueva carpeta principal"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Carpeta</span>
            </Button>
          )}
        </div>

        {/* Profile and Theme Toggle */}
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          {user?.photoURL ? (
            <button
              onClick={handleProfileClick}
              className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-accent"
            >
              <img
                src={user.photoURL}
                alt={user.displayName || 'Usuario'}
                className="w-6 h-6 rounded-full"
              />
              <span className="text-sm font-medium">{user.displayName}</span>
            </button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleProfileClick}
              className="flex items-center space-x-2 px-3 py-2"
            >
              <User className="w-4 h-4" />
              <span>Perfil</span>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
