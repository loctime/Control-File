'use client';

import { useUIStore } from '@/lib/stores/ui';
import { useDriveStore } from '@/lib/stores/drive';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Folder, PanelRight } from 'lucide-react';

export function CollapsedSidebar() {
  const { user } = useAuth();
  const { toggleSidebar, closeTrashView } = useUIStore();
  const { currentFolderId, getSubfolders, setCurrentFolderId, getMainFolders } = useDriveStore();
  
  // Obtener las subcarpetas de la carpeta principal actual
  const subfolders = currentFolderId ? getSubfolders(currentFolderId) : [];
  const mainFolders = getMainFolders();

  return (
    <div className="w-12 bg-card border-r border-border flex flex-col items-center py-2">
      {/* Botón para expandir sidebar */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleSidebar}
        className="w-8 h-8 p-0 mb-2"
        title="Atajo: B"
      >
        <PanelRight className="w-4 h-4" />
      </Button>
      
      {/* Separador */}
      <div className="w-6 h-px bg-border mb-2" />
      
      {/* Botones de subcarpetas creadas */}
      <div className="flex flex-col space-y-1">
        {subfolders.map((folder) => (
          <Button
            key={folder.id}
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentFolderId(folder.id);
              closeTrashView();
            }}
            className="w-8 h-8 p-0"
            title={folder.name}
          >
            <Folder className="w-4 h-4 text-blue-500" />
          </Button>
        ))}
      </div>
      
      {/* Mensaje cuando no hay subcarpetas */}
      {subfolders.length === 0 && mainFolders.length === 0 && (
        <div className="text-center text-muted-foreground mt-2">
          <Folder className="w-4 h-4 mx-auto opacity-50" />
        </div>
      )}
    </div>
  );
}
