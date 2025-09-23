'use client';

import { useState, useEffect, useRef } from 'react';
import { FolderPlus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (name: string) => void;
  currentFolderId?: string | null;
}

export function CreateFolderModal({ 
  isOpen, 
  onClose, 
  onCreateFolder, 
  currentFolderId 
}: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setError('');
      // Asegurar enfoque del input al abrir el modal
      // Se usa setTimeout para esperar al montaje del contenido
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = folderName.trim();
    
    if (!trimmedName) {
      setError('El nombre de la carpeta no puede estar vacío');
      return;
    }
    
    if (trimmedName.length > 50) {
      setError('El nombre de la carpeta no puede tener más de 50 caracteres');
      return;
    }
    
    // Validar caracteres no permitidos
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmedName)) {
      setError('El nombre no puede contener caracteres especiales: < > : " / \\ | ? *');
      return;
    }
    
    onCreateFolder(trimmedName);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear nueva carpeta"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre de la carpeta
            </label>
            <Input
              id="folderName"
              type="text"
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ingresa el nombre de la carpeta"
              className="w-full"
              autoFocus
              ref={inputRef}
            />
            {error && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <FolderPlus className="inline mr-1 h-4 w-4" />
            La carpeta se creará dentro de la carpeta actual
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!folderName.trim()}
          >
            Crear carpeta
          </Button>
        </div>
      </form>
    </Modal>
  );
}
