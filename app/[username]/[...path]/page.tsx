'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FileExplorer } from '@/components/drive/FileExplorer';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { parseFolderUrl, buildFolderUrl } from '@/lib/url-utils';

export default function FolderPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { setCurrentFolder, items } = useDriveStore();
  const { addToast } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const username = params.username as string;
  const pathSegments = params.path as string[];

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/auth');
      return;
    }

    // Construir la URL completa
    const fullPath = `/${username}/${pathSegments.join('/')}`;
    loadFolderByPath(fullPath);
  }, [user, authLoading, username, pathSegments, router]);

  const loadFolderByPath = async (path: string) => {
    try {
      setLoading(true);
      setError(null);

      const parsed = parseFolderUrl(path);
      if (!parsed) {
        setError('URL inválida');
        return;
      }

      // Si es el usuario actual, usar la lógica normal
      if (user && user.username === parsed.username) {
        // Buscar la carpeta por path en los items actuales
        const targetFolder = items.find(item => 
          item.type === 'folder' && 
          item.path === `/${parsed.path.join('/')}`
        );

        if (targetFolder) {
          // Construir breadcrumb
          const breadcrumb = buildBreadcrumbFromPath(parsed.path);
          setCurrentFolder(targetFolder.id, breadcrumb);
        } else {
          setError('Carpeta no encontrada');
        }
      } else {
        // TODO: Implementar acceso a carpetas públicas de otros usuarios
        setError('Acceso a carpetas de otros usuarios no implementado aún');
      }
    } catch (err) {
      console.error('Error loading folder:', err);
      setError('Error al cargar la carpeta');
    } finally {
      setLoading(false);
    }
  };

  const buildBreadcrumbFromPath = (pathSegments: string[]) => {
    const breadcrumb = [];
    let currentPath = '';

    for (const slug of pathSegments) {
      const folder = items.find(item => 
        item.type === 'folder' && 
        item.slug === slug &&
        item.path === currentPath + `/${slug}`
      );

      if (folder) {
        currentPath += `/${slug}`;
        breadcrumb.push({
          id: folder.id,
          name: folder.name,
          path: currentPath,
          slug: folder.slug
        });
      }
    }

    return breadcrumb;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <FileExplorer />
    </div>
  );
}
