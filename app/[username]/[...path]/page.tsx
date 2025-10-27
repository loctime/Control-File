'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FileExplorer } from '@/components/drive/FileExplorer';
import { FolderNotFoundError } from '@/components/ui/ErrorBoundary';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useNavigation } from '@/hooks/useNavigation';
import { parseFolderUrl, buildFolderUrl } from '@/lib/url-utils';
import { DriveFolder } from '@/types';

export default function FolderPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { setCurrentFolder, items } = useDriveStore();
  const { addToast } = useUIStore();
  const { navigateToFolder } = useNavigation();
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
        // Usar la misma lógica que useNavigation para encontrar la carpeta
        const targetPath = `/${parsed.path.join('/')}`;
        
        // Buscar la carpeta usando la lógica de buildBreadcrumbFromPath
        let currentFolderId: string | null = null;
        let targetFolder: DriveFolder | null = null;
        
        for (const slug of parsed.path) {
          const folder = items.find(item => 
            item.type === 'folder' && 
            item.slug === slug &&
            item.parentId === currentFolderId
          );
          
          if (folder) {
            currentFolderId = folder.id;
            targetFolder = folder;
          } else {
            targetFolder = null;
            break;
          }
        }

        if (targetFolder) {
          // Usar el mismo sistema de navegación que useNavigation para construir el breadcrumb correctamente
          navigateToFolder(targetFolder.id);
        } else {
          // Si no se encuentra la carpeta, navegar a la raíz del usuario
          console.log('Carpeta no encontrada, navegando a la raíz');
          router.push(`/${username}`);
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
      <FolderNotFoundError 
        onGoHome={() => router.push('/')} 
      />
    );
  }

  return (
    <div className="relative">
      <FileExplorer />
    </div>
  );
}
