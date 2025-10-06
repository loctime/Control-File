'use client';

import { useState, useCallback, useMemo } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation } from '@/hooks/useNavigation';
import { useQueryInvalidation } from '@/hooks/useQueryInvalidation';
import { useContextMenuActions } from '@/hooks/useContextMenuActions';
import { Button } from '@/components/ui/button';
import { Folder, Image, FileText, User, Monitor, Plus } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { ContextMenu } from '@/components/drive/ContextMenu';
import { DriveItem, DriveFolder } from '@/types';

export function Navbar() {
  const { createMainFolder, items, toggleItemSelection, moveToTrash, currentFolderId } = useDriveStore();
  const { sidebarOpen, closeTrashView } = useUIStore();
  const { user } = useAuth();
  const { navigateToFolder } = useNavigation();
  const { invalidateFiles } = useQueryInvalidation();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Memoizar las carpetas para evitar re-renders innecesarios
  const folders = useMemo(() => {
    const userId = user?.uid;
    if (!userId) return [];
    // Filtrar carpetas directamente desde items para ser reactivo
    // Solo mostrar carpetas de ControlFile del navbar (no del taskbar)
    const mainFolders = items.filter(item => 
      item.type === 'folder' && 
      item.parentId === null &&
      item.metadata?.isMainFolder &&
      item.userId === userId &&
      !item.deletedAt && // Excluir carpetas en la papelera
      item.appCode === 'controlfile' && // Solo carpetas de ControlFile
      (item.metadata?.source === 'navbar' || !item.metadata?.source) // Solo navbar o sin source (compatibilidad)
    );
    
    return mainFolders;
  }, [items, user]); // Ahora es reactivo a los cambios en items y usuario

  // Memoizar el handler para evitar re-creaciones
  const handleFolderClick = useCallback((folderId: string) => {
    navigateToFolder(folderId);
    // Cerrar la papelera si está abierta
    closeTrashView();
  }, [navigateToFolder, closeTrashView]);

  const handleCreateMainFolder = useCallback(async () => {
    if (newFolderName.trim() && !isCreating) {
      setIsCreating(true);
      console.log('📁 Creando carpeta:', newFolderName);
      
      try {
        createMainFolder(newFolderName, 'Folder', 'text-purple-600');
        
        // Invalidar queries para actualizar la UI automáticamente
        invalidateFiles(null);
        
        setNewFolderName('');
        setIsCreatingFolder(false);
      } catch (error) {
        console.error('Error creando carpeta:', error);
      } finally {
        setIsCreating(false);
      }
    }
  }, [newFolderName, createMainFolder, invalidateFiles, isCreating]);

  const handleProfileClick = useCallback(() => {
    // TODO: Navegar a página de perfil
    console.log('Ir a perfil');
  }, []);

  // Handlers para ContextMenuu
  const handleOpenItem = useCallback((itemId: string) => {
    navigateToFolder(itemId);
  }, [navigateToFolder]);

  // Usar handlers centralizados
  const {
    handleRenameItem,
    handleCopyItem,
    handleCutItem,
    handleShareItem,
    handleShowProperties,
  } = useContextMenuActions();

  const handleDeleteItem = useCallback((itemId: string) => {
    // Usar moveToTrash en lugar de removeItem para mover a la papelera
    moveToTrash(itemId);
  }, [moveToTrash]);

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFolderClick(folder.id)}
                  onContextMenu={() => toggleItemSelection(folder.id)}
                  className={`px-3 py-2 border-2 transition-all duration-200 hover:bg-accent ${
                    currentFolderId === folder.id 
                      ? 'bg-primary/20 border-primary shadow-lg ring-2 ring-primary/30' 
                      : 'border-purple-500 hover:border-purple-600'
                  }`}
                >
                  <span className="font-medium">{folder.name}</span>
                </Button>
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
                disabled={!newFolderName.trim() || isCreating}
                className="text-xs px-2 py-1"
              >
                {isCreating ? 'Creando...' : 'Crear'}
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
