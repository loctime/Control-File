// hooks/useUpload.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/lib/stores/ui';
import { useAuthStore } from '@/lib/stores/auth';
import { backendApiCall, chunkFile } from '@/lib/utils';
import { PresignResponse } from '@/types';
import { auth } from '@/lib/firebase';

export function useUpload() {
  const { addUpload, updateUpload, removeUpload, addToast } = useUIStore();
  const { user, refreshUserQuota } = useAuthStore();
  const queryClient = useQueryClient();

  const uploadFile = useMutation({
    mutationFn: async ({ 
      file, 
      parentId 
    }: { 
      file: File; 
      parentId: string | null; 
    }) => {
      if (!user) throw new Error('Usuario no autenticado');

      // Get current Firebase user
      if (!auth) throw new Error('Firebase auth no inicializado');
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Usuario de Firebase no autenticado');

      const sessionId = Math.random().toString(36).substr(2, 9);
      
      // Add to upload progress
      addUpload({
        sessionId,
        filename: file.name,
        fileSize: file.size,
        progress: 0,
        status: 'uploading',
      });

      try {
        // 1. Request presigned URL
        const token = await firebaseUser.getIdToken();
        const requestBody = {
          name: file.name,
          size: file.size,
          mime: file.type,
          parentId,
        };
        
        // Solicitar URL prefirmada
        
        const presignData: PresignResponse = await backendApiCall('/uploads/presign', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        updateUpload(sessionId, { progress: 10 });

        // 2. Upload file
        if (presignData.multipart) {
          // Multipart upload
          await uploadMultipart(file, presignData, sessionId);
        } else {
          // Single upload
          await uploadSingle(file, presignData.url, sessionId);
        }

        updateUpload(sessionId, { progress: 90, status: 'processing' });

        // 3. Confirm upload
        const confirmResponse = await backendApiCall('/uploads/confirm', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            uploadSessionId: presignData.uploadSessionId,
            key: presignData.key,
            size: file.size,
            mime: file.type,
            name: file.name,
            parentId,
          }),
        });

        updateUpload(sessionId, { progress: 100, status: 'complete' });
        
        // Refresh quota and file list
        await refreshUserQuota();
        queryClient.invalidateQueries({ queryKey: ['files'] });
        
        // Remove from uploads after success
        setTimeout(() => removeUpload(sessionId), 2000);

        addToast({
          type: 'success',
          title: 'Archivo subido',
          message: `${file.name} se subió correctamente`,
          fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type,
            fileId: (confirmResponse as any).fileId,
          },
        });

      } catch (error: any) {
        updateUpload(sessionId, { 
          status: 'error', 
          error: error.message || 'Error al subir archivo' 
        });
        
        addToast({
          type: 'error',
          title: 'Error al subir archivo',
          message: error.message || 'Error desconocido',
          fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type,
            file: file,
          },
        });
        
        throw error;
      }
    },
  });

  const uploadSingle = async (file: File, url: string, sessionId: string) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 80) + 10; // 10-90%
          updateUpload(sessionId, { progress });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  };

  const uploadMultipart = async (file: File, presignData: PresignResponse, sessionId: string) => {
    if (!presignData.multipart) throw new Error('Multipart data missing');

    const chunkSize = Math.ceil(file.size / presignData.multipart.parts.length);
    const chunks = chunkFile(file, chunkSize);
    const uploadedParts: Array<{ PartNumber: number; ETag: string }> = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const partNumber = i + 1;
      const partUrl = presignData.multipart.parts[i]?.url;
      
      if (!partUrl) throw new Error(`Missing URL for part ${partNumber}`);

      const response = await fetch(partUrl, {
        method: 'PUT',
        body: chunk,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload part ${partNumber}`);
      }

      const etag = response.headers.get('ETag');
      if (!etag) throw new Error(`Missing ETag for part ${partNumber}`);

      uploadedParts.push({
        PartNumber: partNumber,
        ETag: etag.replace(/"/g, ''),
      });

      // Update progress
      const progress = Math.round(((i + 1) / chunks.length) * 80) + 10; // 10-90%
      updateUpload(sessionId, { progress });
    }

    return uploadedParts;
  };

  return {
    uploadFile,
    isUploading: uploadFile.isPending,
  };
}
