// hooks/useProxyUpload.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/lib/stores/ui';
import { useAuthStore } from '@/lib/stores/auth';
import { backendApiCall } from '@/lib/utils';
import { PresignResponse } from '@/types';
import { auth } from '@/lib/firebase';

export function useProxyUpload() {
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
      console.log('📤 Inicio de subida', {
        sessionId,
        name: file.name,
        size: file.size,
        type: file.type,
        parentId,
      });
      
      // Add to upload progress
      addUpload({
        sessionId,
        filename: file.name,
        progress: 0,
        status: 'uploading',
      });

      try {
        // 1. Request upload session from backend
        const token = await firebaseUser.getIdToken();
        console.log('🔑 Token Firebase obtenido (no se imprime por seguridad)');
        const requestBody = {
          name: file.name,
          size: file.size,
          mime: file.type,
          parentId,
        };
        
        console.log('📬 Presign (solicitud de sesión de subida):', requestBody);
        
        const sessionData = await backendApiCall<PresignResponse>('/uploads/presign', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        updateUpload(sessionId, { progress: 10 });
        console.log('✅ Presign ok', {
          uploadSessionId: sessionData.uploadSessionId,
          key: sessionData.key,
          uploadType: (sessionData as any)?.uploadType,
        });

        // 2. Upload file through backend proxy
        await uploadThroughProxy(file, sessionData.uploadSessionId, sessionId);

        updateUpload(sessionId, { progress: 90, status: 'processing' });
        console.log('🔁 Confirmación de subida...');

        // 3. Confirm upload
        await backendApiCall('/uploads/confirm', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            uploadSessionId: sessionData.uploadSessionId,
            key: sessionData.key,
            size: file.size,
            mime: file.type,
            name: file.name,
            parentId,
          }),
        });

        updateUpload(sessionId, { progress: 100, status: 'complete' });
        console.log('🎉 Subida confirmada y completada', { sessionId, name: file.name });
        
        // Refresh quota and file list
        await refreshUserQuota();
        console.log('♻️ Invalidando caché de archivos');
        queryClient.invalidateQueries({ queryKey: ['files'] });
        // También invalidar la query específica de la carpeta actual si existe
        if (parentId) {
          queryClient.invalidateQueries({ queryKey: ['files', auth?.currentUser?.uid, parentId] });
        }
        
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
            file: file, // Incluir el archivo para poder abrirlo
          },
        });
        
        throw error;
      }
    },
  });

  const uploadThroughProxy = async (file: File, uploadSessionId: string, sessionId: string) => {
    return new Promise<void>((resolve, reject) => {
      if (!auth) {
        reject(new Error('Firebase auth no inicializado'));
        return;
      }

      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        reject(new Error('Usuario no autenticado'));
        return;
      }

      firebaseUser.getIdToken().then(token => {
        const xhr = new XMLHttpRequest();
        console.log('🚚 Iniciando subida vía proxy', { uploadSessionId, name: file.name, size: file.size });
        let lastLoggedProgress = -10; // para loguear cada 10%
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 80) + 10; // 10-90%
            updateUpload(sessionId, { progress });
            if (progress - lastLoggedProgress >= 10 || progress === 90 || progress === 10) {
              console.log('📈 Progreso de subida', { sessionId, progress: `${progress}%` });
              lastLoggedProgress = progress;
            }
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('✅ Proxy respondió OK', { status: xhr.status });
            resolve();
          } else {
            console.error('❌ Error del proxy', { status: xhr.status, response: xhr.responseText });
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          console.error('❌ Error de red en subida vía proxy');
          reject(new Error('Upload failed'));
        });

        // Enviar directamente al backend para evitar límites del runtime de Next
        const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
        xhr.open('POST', `${backendUrl}/api/uploads/proxy-upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        
        // Enviar el archivo como FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', uploadSessionId);
        console.log('📦 Enviando FormData al proxy');
        
        xhr.send(formData);
      }).catch(reject);
    });
  };

  return {
    uploadFile,
    isUploading: uploadFile.isPending,
  };
}
