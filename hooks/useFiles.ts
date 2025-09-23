// hooks/useFiles.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DriveFile, DriveFolder, DriveItem } from '@/types';
import { useDriveStore } from '@/lib/stores/drive';
import { useAuthStore } from '@/lib/stores/auth';
import { apiCall } from '@/lib/utils';

export function useFiles(folderId: string | null = null) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Verificar si la carpeta es realmente "custom" (local/temporal)
  // Solo tratamos como personalizada a las que usan el prefijo 'custom-'
  // Todas las demás (incluyendo ids como 'main-*', 'sub-*', 'root_*', etc.)
  // se cargan desde Firestore/backend normalmente.
  const isCustomFolder = () => {
    if (!folderId) return false;
    return folderId.startsWith('custom-');
  };

  const filesQuery = useQuery({
    queryKey: ['files', user?.uid || 'no-user', folderId || 'root'],
    queryFn: async (): Promise<DriveItem[]> => {
      if (!user) return [];

      // Si es una carpeta personalizada que no existe en Firebase, no cargar
      if (isCustomFolder()) {
        console.log('📁 Carpeta personalizada detectada, no cargando desde Firebase');
        return [];
      }

      // Verificar conectividad
      if (!navigator.onLine) {
        console.log('📡 Modo offline: no se pueden cargar archivos');
        throw new Error('Sin conexión a internet. Los archivos no están disponibles en modo offline.');
      }

      if (!db) {
        throw new Error('Firestore no está disponible');
      }

      const items: DriveItem[] = [];

      try {
        // Get folders
        const foldersRef = collection(db, 'folders');
        const foldersQuery = query(
          foldersRef,
          where('userId', '==', user.uid),
          where('parentId', '==', folderId),
          // Ordenar por createdAt para evitar requerir índice por nombre; el orden final se maneja en UI
          orderBy('createdAt', 'desc')
        );
        const foldersSnap = await getDocs(foldersQuery);
      
      foldersSnap.forEach((doc) => {
        const data = doc.data();
        items.push({
          ...data,
          id: doc.id,
          type: 'folder',
          createdAt: data.createdAt.toDate(),
          modifiedAt: data.modifiedAt?.toDate() || data.createdAt.toDate(),
        } as DriveItem);
      });

      // Get files
      const filesRef = collection(db, 'files');
      const filesQuery = query(
        filesRef,
        where('userId', '==', user.uid),
        where('parentId', '==', folderId),
        orderBy('name', 'asc')
      );
      const filesSnap = await getDocs(filesQuery);
      
      filesSnap.forEach((doc) => {
        const data = doc.data();
        items.push({
          ...data,
          id: doc.id,
          type: 'file',
          createdAt: data.createdAt.toDate(),
          modifiedAt: data.modifiedAt?.toDate() || data.createdAt.toDate(),
        } as DriveItem);
      });

        return items;
      } catch (error: any) {
        console.error('Error loading files:', error);
        
        // Manejar errores específicos de conectividad
        if (error.code === 'unavailable' || 
            error.message.includes('network') || 
            error.message.includes('offline')) {
          throw new Error('Sin conexión a internet. Los archivos no están disponibles en modo offline.');
        }
        
        throw error;
      }
    },
    enabled: !!user && !isCustomFolder(), // No ejecutar query para carpetas personalizadas
    retry: (failureCount, error: any) => {
      // No reintentar si es error de conectividad
      if (error.message.includes('Sin conexión') || error.message.includes('offline')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      if (!navigator.onLine) {
        throw new Error('No hay conexión a internet. No se puede crear la carpeta.');
      }
      
      return apiCall('/folders/create', {
        method: 'POST',
        body: JSON.stringify({ name, parentId: folderId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', user?.uid, folderId] });
    },
    onError: (error: any) => {
      console.error('Error creating folder:', error);
    },
  });

  const deleteItems = useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (!navigator.onLine) {
        throw new Error('No hay conexión a internet. No se pueden eliminar los elementos.');
      }
      
      const promises = itemIds.map(id => 
        apiCall('/files/delete', {
          method: 'POST',
          body: JSON.stringify({ fileId: id }),
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error: any) => {
      console.error('Error deleting items:', error);
    },
  });

  const renameItem = useMutation({
    mutationFn: async ({ itemId, newName }: { itemId: string; newName: string }) => {
      if (!navigator.onLine) {
        throw new Error('No hay conexión a internet. No se puede renombrar el elemento.');
      }
      
      return apiCall('/files/rename', {
        method: 'POST',
        body: JSON.stringify({ fileId: itemId, newName }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error: any) => {
      console.error('Error renaming item:', error);
    },
  });

  const moveItems = useMutation({
    mutationFn: async ({ itemIds, targetFolderId }: { itemIds: string[]; targetFolderId: string | null }) => {
      if (!navigator.onLine) {
        throw new Error('No hay conexión a internet. No se pueden mover los elementos.');
      }
      
      const promises = itemIds.map(id => 
        apiCall('/files/move', {
          method: 'POST',
          body: JSON.stringify({ fileId: id, newParentId: targetFolderId }),
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error: any) => {
      console.error('Error moving items:', error);
    },
  });

  return {
    files: filesQuery.data || [],
    loading: filesQuery.isLoading,
    error: filesQuery.error,
    createFolder,
    deleteItems,
    renameItem,
    moveItems,
    refetch: filesQuery.refetch,
  };
}
