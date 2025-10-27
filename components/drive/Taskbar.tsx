'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation } from '@/hooks/useNavigation';
import { useQueryInvalidation } from '@/hooks/useQueryInvalidation';
import { useRouter } from 'next/navigation';
import { useFiles } from '@/hooks/useFiles';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Folder, 
  Image, 
  FileText, 
  Monitor, 
  Plus, 
  Settings,
  User,
  Search,
  Clock,
  Trash2,
  LogOut
} from 'lucide-react';

const iconMap: Record<string, any> = {
  Home, Folder, Image, FileText, Monitor, Plus, Settings, User, Search, Clock, Trash2, LogOut,
};


export function Taskbar() {
  const { currentFolderId, getTrashItems, createMainFolder } = useDriveStore();
  const { isTrashView, toggleTrashView, closeTrashView, addToast } = useUIStore();
  const { logOut } = useAuth();
  const { invalidateFiles } = useQueryInvalidation();
  // Usar directamente el store (como el sidebar) para evitar conflictos
  const { user } = useAuth();
  const { items } = useDriveStore();
  
  // Filtrar carpetas con source: 'taskbar'
  const folders = useMemo(() => {
    const userId = user?.uid;
    if (!userId) return [];
    // Solo mostrar carpetas con source: 'taskbar'
    const taskbarFolders = items.filter(item => 
      item.type === 'folder' && 
      item.userId === userId &&
      !item.deletedAt && // Excluir carpetas en la papelera
      item.metadata?.source === 'taskbar' // Solo carpetas del taskbar
    );
    
    return taskbarFolders;
  }, [items, user]);
  const { navigateToFolder } = useNavigation();
  const router = useRouter();
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // El taskbar ahora se maneja a través del hook useTaskbar

  // El guardado de items ahora se maneja en el hook useTaskbar

  // Actualizar reloj
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Cerrar menú de inicio al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.start-menu-container')) {
        setShowStartMenu(false);
      }
    };

    if (showStartMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStartMenu]);

  const handleStartClick = () => {
    setShowStartMenu(!showStartMenu);
  };

  // Abrir buscador y enfocar input
  const handleOpenSearch = () => {
    setShowSearch((prev) => !prev);
    setShowUserMenu(false);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setShowSearch(false);
      return;
    }

    const allItems = useDriveStore.getState().items || [];
    const match = allItems.find((i: any) => (i.name || '').toString().toLowerCase().includes(query));
    if (match) {
      if (match.type === 'folder') {
        navigateToFolder(match.id);
        closeTrashView();
        addToast({ type: 'success', title: 'Carpeta encontrada', message: `Abriendo "${match.name}"` });
      } else {
        addToast({ type: 'info', title: 'Archivo encontrado', message: match.name || 'Archivo' });
      }
    } else {
      addToast({ type: 'warning', title: 'Sin resultados', message: 'No se encontraron elementos' });
    }
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleToggleUserMenu = () => {
    setShowUserMenu((prev) => !prev);
    setShowSearch(false);
  };

  // Usar la misma lógica simple del Navbar
  const handleFolderClick = (folderId: string) => {
    navigateToFolder(folderId);
    // Cerrar la papelera si está abierta
    closeTrashView();
    // Efecto de feedback táctil
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleAddFolder = async () => {
    if (newFolderName.trim() && !isCreating) {
      setIsCreating(true);
      // Crear carpeta específica para el taskbar
      console.log('📁 Creando carpeta desde taskbar:', newFolderName);
      
      try {
        const folderId = await createMainFolder(newFolderName.trim(), 'Taskbar', 'text-blue-600', 'taskbar');
        
        addToast({
          title: 'Carpeta creada',
          message: `Carpeta "${newFolderName.trim()}" creada en el taskbar`,
          type: 'success'
        });
        
        setNewFolderName('');
        setIsAddingFolder(false);
        closeTrashView();
      } catch (error) {
        console.error('Error creando carpeta:', error);
        addToast({
          title: 'Error',
          message: 'No se pudo crear la carpeta',
          type: 'error'
        });
      } finally {
        setIsCreating(false);
      }
    }
  };



  // Funciones para la papelera
  const handleToggleTrashView = () => {
    toggleTrashView();
    setShowStartMenu(false); // Cerrar el menú de inicio
  };

  const getTrashCount = () => {
    const trashItems = getTrashItems();
    return trashItems.length;
  };

  const handleLogOut = async () => {
    try {
      await logOut();
      router.push('/auth');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-secondary z-[110]">
      <div className="flex items-center justify-between px-2 py-1 h-12">
        {/* Botón de inicio (Windows) */}
        <div className="flex items-center relative start-menu-container">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartClick}
            className={`flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent ${
              showStartMenu ? 'bg-accent' : ''
            }`}
          >
            <Home className="w-5 h-5" />
          </Button>
          {/* Controles: búsqueda, ajustes, usuario, logout y reloj */}
          <div className="ml-1 flex items-center space-x-2 relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenSearch}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent"
            >
              <Search className="w-5 h-5" />
            </Button>
            {showSearch && (
              <div className="absolute bottom-12 left-0 w-72 bg-card border border-border rounded-lg shadow-lg p-2 z-50">
                <form onSubmit={handleSearchSubmit}>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="w-full px-3 py-2 text-sm rounded border focus:outline-none bg-background"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowSearch(false);
                        setSearchQuery('');
                      }
                    }}
                  />
                </form>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowUserMenu(false);
                router.push('/settings');
              }}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent"
            >
              <Settings className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleUserMenu}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent"
            >
              <User className="w-5 h-5" />
            </Button>
            {showUserMenu && (
              <div className="absolute bottom-12 left-0 w-44 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => {
                    router.push('/settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                >
                  Perfil y configuración
                </button>
                <button
                  onClick={async () => {
                    setShowUserMenu(false);
                    await handleLogOut();
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent text-red-600"
                >
                  Cerrar sesión
                </button>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogOut}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent hover:text-red-500"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </Button>

            {/* Reloj se movió al extremo derecho */}
          </div>
          
          {/* Menú de inicio */}
          {showStartMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50">
              <div className="p-4">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                    <User className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Usuario</p>
                    <p className="text-sm text-muted-foreground">usuario@ejemplo.com</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-accent flex items-center space-x-3">
                    <Settings className="w-4 h-4" />
                    <span>Configuración</span>
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-accent flex items-center space-x-3">
                    <Folder className="w-4 h-4" />
                    <span>Documentos</span>
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-accent flex items-center space-x-3">
                    <Image className="w-4 h-4" />
                    <span>Imágenes</span>
                  </button>
                </div>
                
                {/* Botón de papelera */}
                <div className="border-t mt-4 pt-4">
                  <button 
                    onClick={handleToggleTrashView}
                    className="w-full text-left px-3 py-2 rounded hover:bg-accent flex items-center space-x-3"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                    <span>Papelera</span>
                    {getTrashCount() > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {getTrashCount()}
                      </span>
                    )}
                  </button>
                </div>
                
                <div className="border-t mt-4 pt-4">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-accent flex items-center space-x-3 text-muted-foreground">
                    <span>Apagar</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Carpetas de la barra de tareas - solo carpetas del taskbar */}
        <div className="flex items-center space-x-1 flex-1 justify-center">
          {folders.map((folder) => {
            return (
              <Button
                key={folder.id}
                variant="outline"
                size="sm"
                onClick={() => handleFolderClick(folder.id)}
                className={`px-3 py-2 h-10 rounded-lg hover:bg-accent transition-all duration-200 hover:scale-105 border-2 ${
                  currentFolderId === folder.id 
                    ? 'bg-primary/20 border-primary shadow-lg ring-2 ring-primary/30' 
                    : 'border-blue-500 hover:border-blue-600'
                }`}
                title={`Carpeta del Taskbar: ${folder.name}`}
              >
                <span className="text-sm font-medium">{folder.name}</span>
              </Button>
            );
          })}

          {/* Botón para agregar carpeta */}
          <div className="relative">
            {isAddingFolder ? (
              <div className="flex items-center space-x-2 bg-background border rounded-lg px-2 py-1">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nombre de carpeta"
                  className="px-2 py-1 text-sm border border-border rounded w-32 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddFolder();
                    } else if (e.key === 'Escape') {
                      setIsAddingFolder(false);
                      setNewFolderName('');
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAddFolder}
                  disabled={!newFolderName.trim() || isCreating}
                  className="h-6 px-2"
                >
                  {isCreating ? '...' : '+'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingFolder(false);
                    setNewFolderName('');
                  }}
                  className="h-6 px-2"
                >
                  ×
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingFolder(true)}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Área de la derecha: reloj (hora + fecha) */}
        <div className="flex items-center">
          <div className="flex flex-col items-end justify-center px-3 h-10 rounded-lg">
            <span className="text-sm font-mono">
              {currentTime.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            <span className="text-xs text-muted-foreground">
              {currentTime.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
