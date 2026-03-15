/**
 * Lógica para obtener/crear el app root
 * 
 * ⚠️ TRANSITIONAL: Esta implementación simula el app root usando una carpeta
 * con nombre especial `__app_${appId}` en la raíz global.
 * 
 * Cuando el backend implemente `POST /api/apps/:appId/root`, esta función
 * debe migrarse para usar ese endpoint en lugar de crear carpetas directamente.
 * 
 * @see CONTRACT-folders.md para más detalles sobre el contrato
 */

import { HttpClient } from '../../utils/http';
import type { Folder } from '../../types';

/**
 * Nombre de la carpeta que representa el app root
 * Prefijo especial para identificar carpetas de aplicación
 */
const APP_ROOT_PREFIX = '__app_';

/**
 * Genera el nombre de la carpeta app root para una aplicación
 */
export function getAppRootFolderName(appId: string): string {
  return `${APP_ROOT_PREFIX}${appId}`;
}

/**
 * Obtiene o crea el app root para una aplicación
 * 
 * ⚠️ TRANSITIONAL: Actualmente simula el app root creando una carpeta
 * con nombre especial en la raíz global. En el futuro, esto debe usar
 * `POST /api/apps/:appId/root`.
 * 
 * @param http Cliente HTTP
 * @param appId ID de la aplicación
 * @param userId ID del usuario
 * @returns ID de la carpeta app root
 */
export async function getOrCreateAppRoot(
  http: HttpClient,
  appId: string,
  userId: string
): Promise<string> {
  const appRootName = getAppRootFolderName(appId);

  // Buscar si ya existe el app root
  const existingRoot = await findAppRootFolder(http, appRootName, userId);

  if (existingRoot) {
    return existingRoot.id;
  }

  // Crear el app root si no existe
  // ⚠️ TRANSITIONAL: Esto crea una carpeta raíz (parentId = null)
  // En el futuro, esto debe usar POST /api/apps/:appId/root
  const newRoot = await createAppRootFolder(http, appRootName, userId);
  return newRoot.id;
}

/**
 * Busca la carpeta app root por nombre y userId
 * 
 * ⚠️ LEGACY: Usa GET /api/folders directamente.
 * En el futuro, esto debe usar la API contractual.
 */
async function findAppRootFolder(
  http: HttpClient,
  name: string,
  userId: string
): Promise<Folder | null> {
  const qs = new URLSearchParams();
  qs.set('name', name);
  qs.set('userId', userId);
  // No enviamos parentId para buscar en la raíz

  const response = await http.call<{
    items?: any[];
    data?: any[];
  }>(`/api/folders?${qs.toString()}`);

  const rawItems = response.items || response.data || [];
  
  // Buscar carpeta con parentId = null (raíz)
  const folder = rawItems.find(
    (item) =>
      item.type === 'folder' &&
      item.name === name &&
      item.userId === userId &&
      (item.parentId === null || item.parentId === undefined)
  );

  if (!folder) {
    return null;
  }

  const folderId = folder.id ?? folder.folderId;
  if (!folderId) {
    return null;
  }

  return {
    ...folder,
    id: folderId,
  } as Folder;
}

/**
 * Crea la carpeta app root
 * 
 * ⚠️ LEGACY: Usa POST /api/folders directamente con parentId = null.
 * En el futuro, esto debe usar POST /api/apps/:appId/root.
 */
async function createAppRootFolder(
  http: HttpClient,
  name: string,
  userId: string
): Promise<Folder> {
  const response = await http.call<any>('/api/folders', {
    method: 'POST',
    body: JSON.stringify({
      name,
      parentId: null, // ⚠️ TRANSITIONAL: Crear en raíz hasta que exista API contractual
      userId,
    }),
  });

  const folderId = response.id ?? response.folderId;
  if (!folderId) {
    throw new Error('Invalid /api/folders response: missing id');
  }

  return {
    ...response,
    id: folderId,
  } as Folder;
}
