'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Home,
  FolderPlus,
  Upload,
  Search,
  List,
  Grid,
  MoreHorizontal,
  Settings,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation } from '@/hooks/useNavigation';
import { useFiles } from '@/hooks/useFiles';
import { useQueryInvalidation } from '@/hooks/useQueryInvalidation';
import { Breadcrumb } from './Breadcrumb';
import { QuotaBar } from '@/components/common/QuotaBar';
import { ThemeToggle } from '@/components/common/ThemeToggle';

export function DriveToolbar() {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const { navigateToRoot } = useNavigation();
  const { invalidateFiles } = useQueryInvalidation();
  
  const { 
    viewMode, 
    setViewMode, 
    searchFilters, 
    setSearchFilters,
    currentFolderId
  } = useDriveStore();
  
  const { toggleDetailsPanel } = useUIStore();
  const { logOut } = useAuth();
  const { createFolder } = useFiles(currentFolderId);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      await createFolder.mutateAsync(newFolderName);
      
      // Invalidar queries para actualizar la UI automáticamente
      invalidateFiles(currentFolderId);
      
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        // TODO: Handle file upload
        console.log('Upload files:', files);
      }
    };
    input.click();
  };

  const handleHomeClick = () => {
    // Ir a la carpeta raíz (sin carpeta seleccionada)
    navigateToRoot();
  };

  return (
    <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
      {/* Main toolbar */}
      <div className="flex items-center gap-2 p-2">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleHomeClick}
            title="Ir a la raíz"
          >
            <Home className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsCreatingFolder(true)}
            disabled={createFolder.isPending}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Nueva carpeta
          </Button>
          
          <Button variant="ghost" size="sm" onClick={handleUploadClick}>
            <Upload className="h-4 w-4 mr-2" />
            Subir
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* View mode */}
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode.type === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode({ type: 'list' })}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode.type === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode({ type: 'grid' })}
          >
            <Grid className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar archivos..."
            value={searchFilters.query}
            onChange={(e) => setSearchFilters({ query: e.target.value })}
            className="border-0 bg-transparent focus-visible:ring-0"
          />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Quota */}
        <QuotaBar />



        {/* Settings */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Create folder dialog */}
      {isCreatingFolder && (
        <div className="p-4 border-t">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nombre de la carpeta"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder();
                } else if (e.key === 'Escape') {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }
              }}
              autoFocus
            />
            <Button size="sm" onClick={handleCreateFolder}>
              Crear
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setIsCreatingFolder(false);
                setNewFolderName('');
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
