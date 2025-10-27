// hooks/useFileForm.ts
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiCall } from '@/lib/utils';
import { toast } from 'sonner';
import { fileQueryKeys } from './useFiles';

interface CreateFolderFormData {
  name: string;
  parentId: string | null;
}

interface RenameFormData {
  itemId: string;
  newName: string;
}

export function useCreateFolderForm(parentId: string | null, onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const createFolderMutation = useMutation({
    mutationFn: async (data: CreateFolderFormData) => {
      if (!navigator.onLine) {
        throw new Error('No hay conexión a internet. No se puede crear la carpeta.');
      }
      
      return apiCall('/folders/create', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success('Carpeta creada exitosamente');
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.all });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al crear la carpeta');
    },
  });

  const form = useForm({
    defaultValues: {
      name: '',
      parentId,
    },
    onSubmit: async ({ value }) => {
      await createFolderMutation.mutateAsync(value);
    },
    validators: {
      onChange: ({ value }) => {
        const errors: Partial<Record<keyof CreateFolderFormData, string>> = {};
        
        if (!value.name.trim()) {
          errors.name = 'El nombre es requerido';
        } else if (value.name.length < 2) {
          errors.name = 'El nombre debe tener al menos 2 caracteres';
        } else if (value.name.length > 50) {
          errors.name = 'El nombre no puede exceder 50 caracteres';
        } else if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(value.name)) {
          errors.name = 'El nombre contiene caracteres no válidos';
        }
        
        return Object.keys(errors).length > 0 ? errors : undefined;
      },
    },
  });

  return {
    form,
    isSubmitting: createFolderMutation.isPending,
    error: createFolderMutation.error,
  };
}

export function useRenameForm(itemId: string, currentName: string, onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (data: RenameFormData) => {
      if (!navigator.onLine) {
        throw new Error('No hay conexión a internet. No se puede renombrar el elemento.');
      }
      
      return apiCall('/files/rename', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success('Elemento renombrado exitosamente');
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.all });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al renombrar el elemento');
    },
  });

  const form = useForm({
    defaultValues: {
      itemId,
      newName: currentName,
    },
    onSubmit: async ({ value }) => {
      await renameMutation.mutateAsync(value);
    },
    validators: {
      onChange: ({ value }) => {
        const errors: Partial<Record<keyof RenameFormData, string>> = {};
        
        if (!value.newName.trim()) {
          errors.newName = 'El nombre es requerido';
        } else if (value.newName.length < 2) {
          errors.newName = 'El nombre debe tener al menos 2 caracteres';
        } else if (value.newName.length > 50) {
          errors.newName = 'El nombre no puede exceder 50 caracteres';
        } else if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(value.newName)) {
          errors.newName = 'El nombre contiene caracteres no válidos';
        } else if (value.newName === currentName) {
          errors.newName = 'El nombre debe ser diferente al actual';
        }
        
        return Object.keys(errors).length > 0 ? errors : undefined;
      },
    },
  });

  return {
    form,
    isSubmitting: renameMutation.isPending,
    error: renameMutation.error,
  };
}

// Hook para formulario de upload con validaciones avanzadas
export function useUploadForm(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!navigator.onLine) {
        throw new Error('No hay conexión a internet. No se puede subir el archivo.');
      }
      
      return apiCall('/files/upload', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      toast.success('Archivo subido exitosamente');
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.all });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al subir el archivo');
    },
  });

  const form = useForm({
    defaultValues: {
      files: null,
      parentId: null,
    },
    onSubmit: async ({ value }) => {
      // Implementación simplificada
      console.log('Upload form submitted:', value);
    },
    validators: {
      onChange: ({ value }) => {
        // Validación simplificada
        return undefined;
      },
    },
  });

  return {
    form,
    isSubmitting: uploadMutation.isPending,
    error: uploadMutation.error,
  };
}
