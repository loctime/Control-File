// hooks/useFiles.ts
import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  useInfiniteQuery,
  useSuspenseQuery,
  keepPreviousData,
  useIsFetching,
  useIsMutating
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, updateDoc, limit, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DriveFile, DriveFolder, DriveItem } from '@/types';
import { useDriveStore } from '@/lib/stores/drive';
import { useAuthStore } from '@/lib/stores/auth';
import { apiCall } from '@/lib/utils';
import { toast } from 'sonner';

// Query keys centralizadas para mejor invalidación
export const fileQueryKeys = {
  all: ['files'] as const,
  lists: () => [...fileQueryKeys.all, 'list'] as const,
  list: (userId: string, folderId: string | null) => [...fileQueryKeys.lists(), userId, folderId] as const,
  details: () => [...fileQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...fileQueryKeys.details(), id] as const,
  infinite: (userId: string, folderId: string | null) => [...fileQueryKeys.all, 'infinite', userId, folderId] as const,
};

// Función para verificar si es carpeta personalizada
const isCustomFolder = (folderId: string | null) => {
  if (!folderId) return false;
  return folderId.startsWith('custom-');
};

// Función optimizada para fetch de archivos
const fetchFiles = async (userId: string, folderId: string | null): Promise<DriveItem[]> => {
  if (!db) {
    throw new Error('Firestore no está disponible');
  }

  if (!navigator.onLine) {
    throw new Error('Sin conexión a internet. Los archivos no están disponibles en modo offline.');
  }

  const items: DriveItem[] = [];

  try {
    // Fetch all items from files collection
    const allItemsSnap = await getDocs(query(
      collection(db, 'files'),
      where('userId', '==', userId),
      where('parentId', '==', folderId),
      orderBy('createdAt', 'desc')
    ));

    // Process all items
    allItemsSnap.forEach((doc) => {
      const data = doc.data();
      items.push({
        ...data,
        id: doc.id,
        type: data.type || 'file',
        createdAt: data.createdAt.toDate(),
        modifiedAt: data.modifiedAt?.toDate() || data.createdAt.toDate(),
      } as DriveItem);
    });

    return items;
  } catch (error: any) {
    if (error.code === 'unavailable' || 
        error.message.includes('network') || 
        error.message.includes('offline')) {
      throw new Error('Sin conexión a internet. Los archivos no están disponibles en modo offline.');
    }
    throw error;
  }
};

export function useFiles(folderId: string | null = null) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const filesQuery = useQuery({
    queryKey: fileQueryKeys.list(user?.uid || 'no-user', folderId),
    queryFn: () => fetchFiles(user!.uid, folderId),
    enabled: !!user && !isCustomFolder(folderId),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    retry: (failureCount, error: any) => {
      if (error.message.includes('Sin conexión') || error.message.includes('offline')) {
        return false;
      }
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Optimistic updates para mejor UX
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
    onMutate: async (name: string) => {
      // Cancelar queries en progreso
      await queryClient.cancelQueries({ queryKey: fileQueryKeys.list(user?.uid || 'no-user', folderId) });
      
      // Snapshot del estado anterior
      const previousFiles = queryClient.getQueryData(fileQueryKeys.list(user?.uid || 'no-user', folderId));
      
      // Optimistic update
      const tempFolder: DriveItem = {
        id: `temp-${Date.now()}`,
        name,
        type: 'folder',
        parentId: folderId,
        userId: user?.uid || '',
        createdAt: new Date(),
        modifiedAt: new Date(),
        mimeType: 'folder',
        isTrashed: false,
        appCode: 'temp',
        path: `/${name}`,
        slug: name.toLowerCase().replace(/\s+/g, '-')
      } as DriveItem;
      
      queryClient.setQueryData(
        fileQueryKeys.list(user?.uid || 'no-user', folderId),
        (old: DriveItem[] = []) => [tempFolder, ...old]
      );
      
      return { previousFiles };
    },
    onError: (error, _variables, context) => {
      // Revertir en caso de error
      if (context?.previousFiles) {
        queryClient.setQueryData(
          fileQueryKeys.list(user?.uid || 'no-user', folderId),
          context.previousFiles
        );
      }
      toast.error('Error al crear la carpeta');
    },
    onSuccess: () => {
      toast.success('Carpeta creada exitosamente');
    },
    onSettled: () => {
      // Invalidar para obtener datos frescos
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.list(user?.uid || 'no-user', folderId) });
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
    onMutate: async (itemIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: fileQueryKeys.list(user?.uid || 'no-user', folderId) });
      
      const previousFiles = queryClient.getQueryData(fileQueryKeys.list(user?.uid || 'no-user', folderId));
      
      // Optimistic update - remover items
      queryClient.setQueryData(
        fileQueryKeys.list(user?.uid || 'no-user', folderId),
        (old: DriveItem[] = []) => old.filter(item => !itemIds.includes(item.id))
      );
      
      return { previousFiles };
    },
    onError: (error, _variables, context) => {
      if (context?.previousFiles) {
        queryClient.setQueryData(
          fileQueryKeys.list(user?.uid || 'no-user', folderId),
          context.previousFiles
        );
      }
      toast.error('Error al eliminar los elementos');
    },
    onSuccess: () => {
      toast.success('Elementos eliminados exitosamente');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.all });
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
    onMutate: async ({ itemId, newName }) => {
      await queryClient.cancelQueries({ queryKey: fileQueryKeys.list(user?.uid || 'no-user', folderId) });
      
      const previousFiles = queryClient.getQueryData(fileQueryKeys.list(user?.uid || 'no-user', folderId));
      
      // Optimistic update
      queryClient.setQueryData(
        fileQueryKeys.list(user?.uid || 'no-user', folderId),
        (old: DriveItem[] = []) => 
          old.map(item => 
            item.id === itemId 
              ? { ...item, name: newName, modifiedAt: new Date() }
              : item
          )
      );
      
      return { previousFiles };
    },
    onError: (error, _variables, context) => {
      if (context?.previousFiles) {
        queryClient.setQueryData(
          fileQueryKeys.list(user?.uid || 'no-user', folderId),
          context.previousFiles
        );
      }
      toast.error('Error al renombrar el elemento');
    },
    onSuccess: () => {
      toast.success('Elemento renombrado exitosamente');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.all });
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
      toast.success('Elementos movidos exitosamente');
    },
    onError: () => {
      toast.error('Error al mover los elementos');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fileQueryKeys.all });
    },
  });

  // Hooks adicionales para mejor control
  const isFetching = useIsFetching({ queryKey: fileQueryKeys.list(user?.uid || 'no-user', folderId) });
  const isMutating = useIsMutating({ mutationKey: ['files'] });

  // Estabilizar el array files para evitar re-renders innecesarios
  const files = useMemo(() => filesQuery.data || [], [filesQuery.data]);

  return {
    // Data
    files,
    isLoading: filesQuery.isLoading,
    isFetching: isFetching > 0,
    isMutating: isMutating > 0,
    error: filesQuery.error,
    isError: filesQuery.isError,
    isSuccess: filesQuery.isSuccess,
    
    // Mutations
    createFolder,
    deleteItems,
    renameItem,
    moveItems,
    
    // Query controls
    refetch: filesQuery.refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: fileQueryKeys.list(user?.uid || 'no-user', folderId) }),
    
    // Query info
    dataUpdatedAt: filesQuery.dataUpdatedAt,
    errorUpdatedAt: filesQuery.errorUpdatedAt,
    failureCount: filesQuery.failureCount,
    failureReason: filesQuery.failureReason,
  };
}

// Hook para infinite scroll (opcional)
export function useInfiniteFiles(folderId: string | null = null, pageSize: number = 50) {
  const { user } = useAuthStore();
  
  return useInfiniteQuery({
    queryKey: fileQueryKeys.infinite(user?.uid || 'no-user', folderId),
    queryFn: async ({ pageParam = 0 }) => {
      const files = await fetchFiles(user!.uid, folderId);
      const start = pageParam * pageSize;
      const end = start + pageSize;
      return files.slice(start, end);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === pageSize ? allPages.length : undefined;
    },
    enabled: !!user && !isCustomFolder(folderId),
    staleTime: 5 * 60 * 1000,
  });
}

// Hook para archivo individual
export function useFile(fileId: string) {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: fileQueryKeys.detail(fileId),
    queryFn: async () => {
      // Implementar fetch de archivo individual
      // Por ahora retornamos null, se puede implementar después
      return null;
    },
    enabled: !!user && !!fileId,
  });
}

// Hook para prefetch de archivos
export function usePrefetchFiles() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  const prefetchFiles = (folderId: string | null) => {
    if (!user) return;
    
    queryClient.prefetchQuery({
      queryKey: fileQueryKeys.list(user.uid, folderId),
      queryFn: () => fetchFiles(user.uid, folderId),
      staleTime: 5 * 60 * 1000,
    });
  };
  
  return { prefetchFiles };
}
