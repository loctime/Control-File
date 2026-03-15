import { useQuery } from '@tanstack/react-query';
import { createBrowserControlFileClient } from '@/lib/controlfile-client';
import { useAuthStore } from '@/lib/stores/auth';

export function useFileDownloadUrl(fileId: string | null, enabled: boolean = true) {
  const { user } = useAuthStore();

  const query = useQuery({
    queryKey: ['downloadUrl', user?.uid || 'no-user', fileId || 'no-file'],
    queryFn: async (): Promise<string> => {
      if (!fileId) throw new Error('Archivo invalido');

      const client = createBrowserControlFileClient();
      const data = await client.presignGet(fileId);
      if (!data.downloadUrl) {
        throw new Error('No se pudo generar la URL de descarga');
      }
      return data.downloadUrl as string;
    },
    enabled: !!user && !!fileId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    gcTime: 30 * 60 * 1000,
  });

  return {
    downloadUrl: (query.data as string) || null,
    loading: query.isLoading,
    error: (query.error as any)?.message || null,
  };
}
