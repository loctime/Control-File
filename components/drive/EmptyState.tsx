'use client';

import { useState } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useQueryInvalidation } from '@/hooks/useQueryInvalidation';
import { Button } from '@/components/ui/button';
import { Folder, Plus } from 'lucide-react';

export function EmptyState() {
  const { createMainFolder, setMainFolder } = useDriveStore();
  const { invalidateFiles } = useQueryInvalidation();
  const [isCreating, setIsCreating] = useState(false);
  const [folderName, setFolderName] = useState('');

  const handleCreateFirstFolder = () => {
    if (folderName.trim()) {
      const newFolderId = createMainFolder(folderName, 'Folder', 'text-purple-600');
      
      // Invalidar queries para actualizar la UI automáticamente
      invalidateFiles(null);
      
      // Establecer la carpeta recién creada como principal automáticamente
      setMainFolder(newFolderId);
      setFolderName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
        <Folder className="w-12 h-12 text-muted-foreground" />
      </div>
      
      <h2 className="text-2xl font-semibold mb-2">¡Bienvenido a Control File!</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Comienza organizando tus archivos creando tu primera carpeta. 
        Podrás subir archivos, crear subcarpetas y mantener todo organizado.
      </p>
      
      {isCreating ? (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Nombre de tu primera carpeta"
            className="px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateFirstFolder();
              } else if (e.key === 'Escape') {
                setIsCreating(false);
                setFolderName('');
              }
            }}
          />
          <Button onClick={handleCreateFirstFolder} disabled={!folderName.trim()}>
            Crear
          </Button>
          <Button variant="outline" onClick={() => {
            setIsCreating(false);
            setFolderName('');
          }}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button onClick={() => setIsCreating(true)} className="flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Crear mi primera carpeta</span>
        </Button>
      )}
      
      <div className="mt-8 text-sm text-muted-foreground">
        <p>💡 Consejo: Puedes crear carpetas como "Documentos", "Imágenes", "Trabajo", etc.</p>
      </div>
    </div>
  );
}
