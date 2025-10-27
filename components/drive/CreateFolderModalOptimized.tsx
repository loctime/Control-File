// components/drive/CreateFolderModalOptimized.tsx
'use client';

import { useEffect, useRef } from 'react';
import { FolderPlus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateFolderForm } from '@/hooks/useFileForm';

interface CreateFolderModalOptimizedProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolderId?: string | null;
}

export function CreateFolderModalOptimized({ 
  isOpen, 
  onClose, 
  currentFolderId 
}: CreateFolderModalOptimizedProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { form, isSubmitting } = useCreateFolderForm(currentFolderId || null, () => {
    onClose();
    form.reset();
  });

  useEffect(() => {
    if (isOpen) {
      form.reset();
      // Asegurar enfoque del input al abrir el modal
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isOpen, form]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Nueva Carpeta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="folderName" className="block text-sm font-medium text-gray-700">
            Nombre de la carpeta
          </label>
          <Input
            ref={inputRef}
            id="folderName"
            value={form.state.values.name || ''}
            onChange={(e) => form.setFieldValue('name', e.target.value)}
            placeholder="Ingresa el nombre de la carpeta"
            disabled={isSubmitting}
            className="w-full"
          />
          {form.state.errors && form.state.errors.length > 0 && (
            <p className="text-sm text-red-600">Error en el nombre</p>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !form.state.isValid}
            className="flex items-center space-x-2"
          >
            <FolderPlus className="h-4 w-4" />
            <span>{isSubmitting ? 'Creando...' : 'Crear Carpeta'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
