'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation } from '@/hooks/useNavigation';
import { useContextMenuActions } from '@/hooks/useContextMenuActions';
import { Button } from '@/components/ui/button';
import { Folder, Image, FileText, User, Monitor, Plus, LogOut, Settings, ChevronDown } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { ContextMenu } from '@/components/drive/ContextMenu';
import { Breadcrumb } from '@/components/drive/Breadcrumb';
import { DriveItem, DriveFolder } from '@/types';

export function Navbar() {
  const { createMainFolder, items, toggleItemSelection, moveToTrash, currentFolderId } = useDriveStore();
  const { sidebarOpen, closeTrashView } = useUIStore();
  const { user, logOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { navigateToFolder } = useNavigation();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Memoizar las carpetas para evitar re-renders innecesarios
  const folders = useMemo(() => {
    const userId = user?.uid;
    if (!userId) return [];
    // Filtrar carpetas del navbar (no del taskbar)
    const mainFolders = items.filter(item => 
      item.type === 'folder' && 
      item.parentId === null &&
      item.metadata?.isMainFolder &&
      item.userId === userId &&
      !item.deletedAt && // Excluir carpetas en la papelera
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
        await createMainFolder(newFolderName, 'Folder', 'text-purple-600');
        
        console.log('✅ Carpeta creada y sincronizada correctamente');
        
        setNewFolderName('');
        setIsCreatingFolder(false);
      } catch (error) {
        console.error('Error creando carpeta:', error);
      } finally {
        setIsCreating(false);
      }
    }
  }, [newFolderName, createMainFolder, isCreating]);

  const handleProfileClick = useCallback(() => {
    addToast({ type: 'info', title: 'Función no disponible', message: 'El perfil no está implementado' });
  }, [addToast]);

  const handleUserMenuToggle = useCallback(() => {
    setIsUserMenuOpen(!isUserMenuOpen);
  }, [isUserMenuOpen]);

  const handleSignOut = useCallback(async () => {
    try {
      await logOut();
      setIsUserMenuOpen(false);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }, [logOut]);

  const handleProfileSettings = useCallback(() => {
    navigateToFolder('profile');
    setIsUserMenuOpen(false);
  }, [navigateToFolder]);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

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
    addToast({ type: 'info', title: 'Función no disponible', message: 'El pegado no está implementado' });
  }, [addToast]);

  const handleSelectAll = useCallback(() => {
    addToast({ type: 'info', title: 'Función no disponible', message: 'La selección múltiple no está implementada' });
  }, [addToast]);

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
      {/* Estructura de dos filas con breadcrumb solo en el centro */}
      <div className="flex items-start">
        {/* Columna izquierda: Logo - Ocupa ambas filas */}
        <div className="flex flex-col justify-center min-w-0 flex-shrink-0 h-16">
          <h1 className="text-lg font-semibold">Control File</h1>
        </div>

        {/* Columna central: Carpetas y Breadcrumb */}
        <div className="flex-1 flex flex-col items-center px-4">
          {/* Folder Navigation */}
          <div className="flex items-center space-x-1 mb-2">
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
          
          {/* Línea divisora entre carpetas y breadcrumb */}
          <div className="w-full border-t border-border mb-2"></div>
          
          {/* Breadcrumb de navegación - Solo debajo de las carpetas */}
          <div className="flex items-center justify-center">
            <Breadcrumb />
          </div>
        </div>

        {/* Columna derecha: Profile and Theme Toggle - Ocupa ambas filas */}
        <div className="flex flex-col justify-center space-y-2 min-w-0 flex-shrink-0 h-16">
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            {user?.photoURL ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={handleUserMenuToggle}
                  className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-accent transition-colors"
                >
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Usuario'}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm font-medium">{user.displayName}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Menú desplegable */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-50">
                    <div className="py-1">
                      <button
                        onClick={handleProfileSettings}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Perfil</span>
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm hover:bg-accent transition-colors text-red-600 hover:text-red-700"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
      </div>
    </nav>
  );
}
