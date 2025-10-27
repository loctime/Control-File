// hooks/useOptimizedUpload.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiCall } from '@/lib/utils';
import { toast } from 'sonner';
import { fileQueryKeys } from './useFiles';

interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface UploadOptions {
  parentId?: string | null;
  onProgress?: (progress: UploadProgress[]) => void;
  onComplete?: (results: any[]) => void;
  onError?: (error: Error) => void;
}

export function useOptimizedUpload() {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ files, options }: { files: File[]; options: UploadOptions }) => {
      if (!navigator.onLine) {
        throw new Error('No hay conexión a internet. No se pueden subir los archivos.');
      }

      const uploadPromises = files.map(async (file, index) => {
        try {
          // 1. Obtener presigned URL
          const presignResponse = await apiCall('/files/presign-upload', {
            method: 'POST',
            body: JSON.stringify({
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              parentId: options.parentId,
            }),
          });

          if (!(presignResponse as any).uploadUrl) {
            throw new Error('No se pudo obtener la URL de subida');
          }

          // 2. Subir archivo directamente a B2
          const uploadResponse = await fetch((presignResponse as any).uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type,
            },
          });

          if (!uploadResponse.ok) {
            throw new Error(`Error al subir archivo: ${uploadResponse.statusText}`);
          }

          // 3. Confirmar upload en el backend
          const confirmResponse = await apiCall('/files/confirm-upload', {
            method: 'POST',
            body: JSON.stringify({
              fileId: (presignResponse as any).fileId,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              parentId: options.parentId,
            }),
          });

          return {
            fileId: (presignResponse as any).fileId,
            fileName: file.name,
            success: true,
            data: confirmResponse,
          };
        } catch (error: any) {
          return {
            fileId: `error-${index}`,
            fileName: file.name,
            success: false,
            error: error.message,
          };
        }
      });

      // Ejecutar uploads en paralelo con límite de concurrencia
      const results = await Promise.allSettled(uploadPromises);
      
      const successful = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(result => result.success);

      const failed = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(result => !result.success);

      if (failed.length > 0) {
        console.warn('Algunos archivos fallaron al subir:', failed);
      }

      return {
        successful,
        failed,
        total: files.length,
      };
    },
    onMutate: ({ files, options }) => {
      // Optimistic update - mostrar archivos como "subiendo"
      const tempFiles = files.map((file, index) => ({
        id: `temp-upload-${Date.now()}-${index}`,
        name: file.name,
        type: 'file' as const,
        size: file.size,
        mimeType: file.type,
        parentId: options.parentId,
        userId: '', // Se llenará cuando se confirme
        createdAt: new Date(),
        modifiedAt: new Date(),
        isTrashed: false,
        // appCode eliminado
      }));

      // Agregar a la cache actual
      const currentData = queryClient.getQueryData(
        fileQueryKeys.list('', options.parentId || null)
      );
      
      if (currentData) {
        queryClient.setQueryData(
          fileQueryKeys.list('', options.parentId || null),
          [...tempFiles, ...(currentData as any[])]
        );
      }
    },
    onSuccess: (data, { options }) => {
      const successCount = data.successful.length;
      const failCount = data.failed.length;

      if (successCount > 0) {
        toast.success(`${successCount} archivo(s) subido(s) exitosamente`);
      }
      
      if (failCount > 0) {
        toast.error(`${failCount} archivo(s) fallaron al subir`);
      }

      // Invalidar queries para obtener datos frescos
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.all });
      
      options.onComplete?.(data.successful);
    },
    onError: (error: any, { options }) => {
      toast.error(error.message || 'Error al subir archivos');
      options.onError?.(error);
    },
  });

  const uploadFiles = (files: File[], options: UploadOptions = {}) => {
    return uploadMutation.mutateAsync({ files, options });
  };

  return {
    uploadFiles,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
    uploadProgress: uploadMutation.data,
  };
}

// Hook para upload con drag & drop
export function useDragDropUpload(parentId: string | null = null) {
  const { uploadFiles, isUploading } = useOptimizedUpload();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    uploadFiles(files, {
      parentId,
      onComplete: (results) => {
        console.log('Upload completado:', results);
      },
      onError: (error) => {
        console.error('Error en upload:', error);
      },
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    isUploading,
  };
}
