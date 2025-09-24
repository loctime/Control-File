import { useAuthStore } from '@/lib/stores/auth';
import { getAuth } from 'firebase/auth';
import { useQuery } from '@tanstack/react-query';

// Cacheamos la URL presignada por un tiempo para reutilizarla entre aperturas del panel
// Esto permite que el navegador también aproveche su propia caché de imagen
export function useFileDownloadUrl(fileId: string | null, enabled: boolean = true) {
  const { user } = useAuthStore();

  const query = useQuery({
    queryKey: ['downloadUrl', user?.uid || 'no-user', fileId || 'no-file'],
    queryFn: async (): Promise<string> => {
      if (!fileId) throw new Error('Archivo inválido');

      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      const token = await currentUser.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

      const response = await fetch(`${backendUrl}/api/files/presign-get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ fileId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      const data = await response.json();
      if (!data.downloadUrl) {
        throw new Error('No se pudo generar la URL de descarga');
      }
      return data.downloadUrl as string;
    },
    enabled: !!user && !!fileId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos: no refetch al reabrir rápidamente el panel
    refetchOnWindowFocus: false,
    retry: 1,
    gcTime: 30 * 60 * 1000, // v5 usa gcTime en lugar de cacheTime
  });

  return { downloadUrl: (query.data as string) || null, loading: query.isLoading, error: (query.error as any)?.message || null };
}
