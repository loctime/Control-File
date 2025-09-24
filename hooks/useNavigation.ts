// hooks/useNavigation.ts
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import { useDriveStore } from '@/lib/stores/drive';
import { buildFolderUrl, parseFolderUrl, getItemSlug, getUserUsername } from '@/lib/url-utils';
import { DriveFolder } from '@/types';

export function useNavigation() {
  const router = useRouter();
  const { user } = useAuth();
  const { setCurrentFolder, setBreadcrumb, items } = useDriveStore();

  // Verificación de seguridad para evitar errores durante la carga inicial
  if (!user) {
    return {
      navigateToFolder: () => {},
      navigateToFolderByPath: () => {},
      navigateToRoot: () => {},
      navigateToFolderBySlug: () => {},
      buildBreadcrumbFromFolder: () => [],
      getCurrentPathFromUrl: () => null,
      syncStateWithUrl: () => {},
      navigateToExternalUser: () => {}
    };
  }

  /**
   * Navega a una carpeta usando su ID
   */
  const navigateToFolder = (folderId: string) => {
    const username = getUserUsername(user || {});
    if (!username) return;

    const folder = items.find(item => item.id === folderId && item.type === 'folder') as DriveFolder;
    if (!folder) return;

    // Construir breadcrumb
    const breadcrumb = buildBreadcrumbFromFolder(folder);
    
    // Actualizar estado
    setCurrentFolder(folderId, breadcrumb);

    // Construir URL y navegar
    const pathSegments = breadcrumb.map(item => getItemSlug(item));
    const url = buildFolderUrl(username, pathSegments);
    
    // Solo navegar si no estamos ya en esa URL
    if (window.location.pathname !== url) {
      router.push(url);
    }
  };

  /**
   * Navega a una carpeta usando su slug y path
   */
  const navigateToFolderByPath = (pathSegments: string[]) => {
    const username = getUserUsername(user || {});
    if (!username) return;

    const url = buildFolderUrl(username, pathSegments);
    router.push(url);
  };

  /**
   * Navega a la carpeta raíz del usuario
   */
  const navigateToRoot = () => {
    const username = getUserUsername(user || {});
    if (!username) return;
    
    router.push(`/${username}`);
  };

  /**
   * Navega a una carpeta específica por su slug
   */
  const navigateToFolderBySlug = (slug: string, parentId?: string) => {
    const username = getUserUsername(user || {});
    if (!username) return;

    const folder = items.find(item => 
      item.type === 'folder' && 
      getItemSlug(item) === slug && 
      item.parentId === parentId
    ) as DriveFolder;

    if (folder) {
      navigateToFolder(folder.id);
    }
  };

  /**
   * Construye el breadcrumb desde una carpeta
   */
  const buildBreadcrumbFromFolder = (folder: DriveFolder) => {
    const breadcrumb = [];
    let currentFolder = folder;

    // Recorrer hacia arriba para construir el breadcrumb
    while (currentFolder) {
      breadcrumb.unshift({
        id: currentFolder.id,
        name: currentFolder.name,
        path: currentFolder.path,
        slug: getItemSlug(currentFolder)
      });

      if (currentFolder.parentId) {
        const parent = items.find(item => 
          item.id === currentFolder.parentId && item.type === 'folder'
        ) as DriveFolder;
        currentFolder = parent;
      } else {
        break;
      }
    }

    return breadcrumb;
  };

  /**
   * Obtiene la URL actual y la convierte a información de carpeta
   */
  const getCurrentPathFromUrl = () => {
    const username = getUserUsername(user || {});
    if (!username) return null;

    const currentPath = window.location.pathname;
    const parsed = parseFolderUrl(currentPath);
    
    if (parsed && parsed.username === username) {
      return parsed.path;
    }

    return null;
  };

  /**
   * Sincroniza el estado con la URL actual
   */
  const syncStateWithUrl = () => {
    const username = getUserUsername(user || {});
    if (!username) return;

    const pathSegments = getCurrentPathFromUrl();
    if (!pathSegments || pathSegments.length === 0) {
      // Estamos en la raíz
      setCurrentFolder(null, []);
      return;
    }

    // Buscar la carpeta por el path (usando slugs para compatibilidad)
    const targetPath = `/${pathSegments.join('/')}`;
    const folder = items.find(item => 
      item.type === 'folder' && 
      item.path === targetPath
    ) as DriveFolder;

    if (folder) {
      const breadcrumb = buildBreadcrumbFromFolder(folder);
      setCurrentFolder(folder.id, breadcrumb);
    }
  };

  /**
   * Navega a una URL externa (otro usuario)
   */
  const navigateToExternalUser = (username: string, pathSegments: string[] = []) => {
    const url = buildFolderUrl(username, pathSegments);
    router.push(url);
  };

  return {
    navigateToFolder,
    navigateToFolderByPath,
    navigateToRoot,
    navigateToFolderBySlug,
    buildBreadcrumbFromFolder,
    getCurrentPathFromUrl,
    syncStateWithUrl,
    navigateToExternalUser
  };
}
