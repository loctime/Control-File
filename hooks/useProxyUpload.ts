import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/lib/stores/ui';
import { useAuthStore } from '@/lib/stores/auth';
import { createBrowserControlFileClient } from '@/lib/controlfile-client';

export function useProxyUpload() {
  const { addUpload, updateUpload, removeUpload, addToast } = useUIStore();
  const { user, refreshUserQuota } = useAuthStore();
  const queryClient = useQueryClient();

  const uploadFile = useMutation({
    mutationFn: async ({
      file,
      parentId,
    }: {
      file: File;
      parentId: string | null;
    }) => {
      if (!user) throw new Error('Usuario no autenticado');

      const sessionId = Math.random().toString(36).slice(2, 11);
      addUpload({
        sessionId,
        filename: file.name,
        progress: 0,
        status: 'uploading',
      });

      try {
        const client = createBrowserControlFileClient();
        const response = await client.files.upload({
          file,
          name: file.name,
          parentId,
          onProgress: (progress) => {
            const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
            updateUpload(sessionId, {
              progress: safeProgress,
              status: safeProgress >= 90 ? 'processing' : 'uploading',
            });
          },
        });

        updateUpload(sessionId, { progress: 100, status: 'complete' });
        await refreshUserQuota();
        queryClient.invalidateQueries({ queryKey: ['files'] });
        if (parentId) {
          queryClient.invalidateQueries({ queryKey: ['files', user.uid, parentId] });
        }

        setTimeout(() => removeUpload(sessionId), 2000);

        addToast({
          type: 'success',
          title: 'Archivo subido',
          message: `${file.name} se subio correctamente`,
          fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type,
            fileId: response.fileId,
          },
        });

        return response;
      } catch (error: any) {
        updateUpload(sessionId, {
          status: 'error',
          error: error.message || 'Error al subir archivo',
        });

        addToast({
          type: 'error',
          title: 'Error al subir archivo',
          message: error.message || 'Error desconocido',
          fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type,
            file,
          },
        });

        throw error;
      }
    },
  });

  return {
    uploadFile,
    isUploading: uploadFile.isPending,
  };
}
