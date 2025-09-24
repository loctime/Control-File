'use client';

import { useState, useEffect, useRef } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useAuth } from '@/hooks/useAuth';
import { useTaskbar } from '@/hooks/useTaskbar';
import { useRouter } from 'next/navigation';
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

interface TaskbarItem {
  id: string;
  name: string;
  icon: any;
  color: string;
  type: 'folder' | 'app';
  isCustom?: boolean;
}

export function Taskbar() {
  const { setCurrentFolderId, currentFolderId, getTrashItems } = useDriveStore();
  const { isTrashView, toggleTrashView, closeTrashView, addToast } = useUIStore();
  const { logOut } = useAuth();
  const { taskbarItems, saveTaskbarItems } = useTaskbar();
  const router = useRouter();
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
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
        setCurrentFolderId(match.id);
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

  const handleItemClick = (item: TaskbarItem) => {
    if (item.type === 'folder') {
      // Si es un item del taskbar (no una carpeta real), no navegamos
      if (item.id.startsWith('taskbar-') || item.id.startsWith('custom-')) {
        addToast({
          title: 'Item del Taskbar',
          description: 'Este es un favorito del taskbar. Crea una carpeta real desde el Navbar para navegar.',
          type: 'info'
        });
        return;
      }
      
      // Solo navegar si es una carpeta real
      setCurrentFolderId(item.id);
      // Cerrar la papelera si está abierta
      closeTrashView();
      // Efecto de feedback táctil
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  };

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      // Crear solo un item del taskbar (no una carpeta real)
      const taskbarItemId = `taskbar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newItem: TaskbarItem = {
        id: taskbarItemId,
        name: newFolderName.trim(),
        icon: 'Folder',
        color: 'text-purple-600',
        type: 'folder',
        isCustom: true,
      };
      // Usar la función del hook para guardar
      const updatedItems = [...taskbarItems, newItem];
      saveTaskbarItems(updatedItems);
      setNewFolderName('');
      setIsAddingFolder(false);
      // No abrimos ninguna carpeta ya que es solo un item del taskbar
      closeTrashView();
    }
  };

  const handleRemoveItem = (itemId: string) => {
    const updatedItems = taskbarItems.filter(item => item.id !== itemId);
    saveTaskbarItems(updatedItems);
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
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-secondary z-50">
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

        {/* Items de la barra de tareas */}
        <div className="flex items-center space-x-1 flex-1 justify-center">
          {taskbarItems.map((item) => {
            const IconComponent = typeof item.icon === 'string' ? (iconMap[item.icon] || Folder) : (item.icon || Folder);
            return (
                              <div
                  key={item.id}
                  className="relative group"
                  title={`Abrir ${item.name}`}
                >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center space-x-2 px-3 py-2 h-10 rounded-lg hover:bg-accent transition-all duration-200 hover:scale-105 ${
                    currentFolderId === item.id ? 'bg-accent/50 border-b-2 border-primary' : ''
                  }`}
                >
                  <IconComponent className={`w-4 h-4 ${item.color}`} />
                  <span className="text-sm">{item.name}</span>
                </Button>
                
                {/* Botón de eliminar (solo para items del taskbar) */}
                {(item.id.startsWith('custom-') || item.id.startsWith('taskbar-')) && (
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    ×
                  </button>
                )}
              </div>
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
                  disabled={!newFolderName.trim()}
                  className="h-6 px-2"
                >
                  +
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
