// hooks/useAllFolders.ts
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/lib/stores/auth';
import { useDriveStore } from '@/lib/stores/drive';

// Función para cargar todas las carpetas del usuario
const fetchAllFolders = async (userId: string) => {
  console.log('🔍 fetchAllFolders - Iniciando carga para usuario:', userId);
  
  if (!db) {
    throw new Error('Firestore no está disponible');
  }

  if (!navigator.onLine) {
    throw new Error('Sin conexión a internet. Las carpetas no están disponibles en modo offline.');
  }

  const items: any[] = [];

  try {
    console.log('🔍 fetchAllFolders - Ejecutando query en Firestore...');
    
    // Cargar todas las carpetas del usuario
    const foldersSnap = await getDocs(query(
      collection(db, 'files'),
      where('userId', '==', userId),
      where('type', '==', 'folder'),
      orderBy('createdAt', 'desc')
    ));

    console.log('🔍 fetchAllFolders - Query completada, documentos encontrados:', foldersSnap.size);

    foldersSnap.forEach((doc) => {
      const data = doc.data();
      const item = {
        ...data,
        id: doc.id,
        type: 'folder',
        createdAt: data.createdAt?.toDate?.() || new Date(),
        modifiedAt: data.modifiedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date(),
      };
      console.log('🔍 fetchAllFolders - Procesando carpeta:', data.name, 'source:', data.metadata?.source);
      items.push(item);
    });

    console.log('🔍 fetchAllFolders - Total carpetas cargadas:', items.length);
    return items;
  } catch (error: any) {
    console.error('🔍 fetchAllFolders - Error:', error);
    if (error.code === 'unavailable' || 
        error.message.includes('network') || 
        error.message.includes('offline')) {
      throw new Error('Sin conexión a internet. Las carpetas no están disponibles en modo offline.');
    }
    throw error;
  }
};

export function useAllFolders() {
  const { user } = useAuthStore();
  const { setItems } = useDriveStore();

  console.log('🔍 useAllFolders - Usuario:', user?.uid);

  const foldersQuery = useQuery({
    queryKey: ['all-folders', user?.uid],
    queryFn: () => fetchAllFolders(user!.uid),
    enabled: !!user,
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

  console.log('🔍 useAllFolders - Estado:', { 
    data: foldersQuery.data, 
    isLoading: foldersQuery.isLoading, 
    error: foldersQuery.error 
  });

  // Actualizar el store cuando se cargan las carpetas
  useEffect(() => {
    if (foldersQuery.data) {
      console.log('🔍 useAllFolders - Actualizando store con carpetas:', foldersQuery.data);
      setItems(foldersQuery.data);
    }
  }, [foldersQuery.data, setItems]);

  return {
    folders: foldersQuery.data || [],
    isLoading: foldersQuery.isLoading,
    error: foldersQuery.error,
    isError: foldersQuery.isError,
    refetch: foldersQuery.refetch,
  };
}
