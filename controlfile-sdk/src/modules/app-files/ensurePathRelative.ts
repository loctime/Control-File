/**
 * Asegura que un path relativo al app root exista
 * 
 * ⚠️ CONTRACTUAL: Esta función NO permite crear carpetas raíz (parentId = null).
 * Todos los paths son relativos al appRootId proporcionado.
 * 
 * @see CONTRACT-folders.md para más detalles sobre el contrato
 */

import { HttpClient } from '../../utils/http';
import type { Folder } from '../../types';

/**
 * Normaliza una respuesta de carpeta del backend para usar siempre 'id'
 */
function normalizeFolderResponse(response: any): Folder {
  const folderId = response.id ?? response.folderId;
  
  if (!folderId) {
    throw new Error('Invalid /api/folders response: missing id');
  }

  return {
    ...response,
    id: folderId,
  } as Folder;
}

/**
 * Asegura que un path relativo al app root exista, creándolo si es necesario
 * 
 * ⚠️ CONTRACTUAL: Esta función garantiza que:
 * - NUNCA crea carpetas con parentId = null
 * - Todos los paths son relativos al appRootId
 * - Es idempotente: si el path ya existe, lo reutiliza
 * 
 * @param http Cliente HTTP
 * @param appRootId ID de la carpeta app root (nunca null)
 * @param path Path relativo al app root (ej: ['documentos', '2024'])
 * @param userId ID del usuario
 * @returns ID de la carpeta final del path
 */
export async function ensurePathRelative(
  http: HttpClient,
  appRootId: string,
  path: string[],
  userId: string
): Promise<string> {
  if (path.length === 0) {
    throw new Error('El path no puede estar vacío');
  }

  // Empezar desde el app root (nunca null)
  let currentParentId: string = appRootId;

  for (const segmentName of path) {
    if (!segmentName || segmentName.trim() === '') {
      throw new Error('Los segmentos del path no pueden estar vacíos');
    }

    const existingFolder = await findFolderByName(
      http,
      segmentName,
      currentParentId, // ⚠️ CONTRACTUAL: Nunca null
      userId
    );

    if (existingFolder) {
      currentParentId = existingFolder.id;
    } else {
      const newFolder = await createFolder(
        http,
        segmentName,
        currentParentId, // ⚠️ CONTRACTUAL: Nunca null
        userId
      );
      currentParentId = newFolder.id;
    }
  }

  return currentParentId;
}

/**
 * Resuelve un path relativo al app root sin crearlo
 * 
 * ⚠️ CONTRACTUAL: Esta función solo busca, no crea carpetas.
 * Retorna null si el path no existe.
 * 
 * @param http Cliente HTTP
 * @param appRootId ID de la carpeta app root (nunca null)
 * @param path Path relativo al app root (ej: ['documentos', '2024'])
 * @param userId ID del usuario
 * @returns ID de la carpeta final del path, o null si no existe
 */
export async function resolvePathRelative(
  http: HttpClient,
  appRootId: string,
  path: string[],
  userId: string
): Promise<string | null> {
  if (path.length === 0) {
    return appRootId;
  }

  let currentParentId: string = appRootId;

  for (const segmentName of path) {
    if (!segmentName || segmentName.trim() === '') {
      return null;
    }

    const existingFolder = await findFolderByName(
      http,
      segmentName,
      currentParentId,
      userId
    );

    if (!existingFolder) {
      return null; // Path no existe
    }

    currentParentId = existingFolder.id;
  }

  return currentParentId;
}

/**
 * Busca una carpeta por nombre, parentId y userId
 * 
 * ⚠️ LEGACY: Usa GET /api/folders directamente.
 * En el futuro, esto debe usar la API contractual.
 */
async function findFolderByName(
  http: HttpClient,
  name: string,
  parentId: string, // ⚠️ CONTRACTUAL: Nunca null en este contexto
  userId: string
): Promise<Folder | null> {
  const qs = new URLSearchParams();
  qs.set('name', name);
  qs.set('userId', userId);
  qs.set('parentId', parentId); // Siempre presente (nunca null)

  const response = await http.call<{
    items?: any[];
    data?: any[];
  }>(`/api/folders?${qs.toString()}`);

  const rawItems = response.items || response.data || [];
  const items = rawItems.map(normalizeFolderResponse);
  
  const folder = items.find(
    (item) =>
      item.type === 'folder' &&
      item.name === name &&
      item.userId === userId &&
      item.parentId === parentId
  );

  return folder || null;
}

/**
 * Crea una nueva carpeta
 * 
 * ⚠️ LEGACY: Usa POST /api/folders directamente.
 * En el futuro, esto debe usar la API contractual.
 * 
 * ⚠️ CONTRACTUAL: Esta función garantiza que parentId nunca es null.
 */
async function createFolder(
  http: HttpClient,
  name: string,
  parentId: string, // ⚠️ CONTRACTUAL: Nunca null
  userId: string
): Promise<Folder> {
  const response = await http.call<any>('/api/folders', {
    method: 'POST',
    body: JSON.stringify({
      name,
      parentId, // ⚠️ CONTRACTUAL: Siempre presente (nunca null)
      userId,
    }),
  });

  return normalizeFolderResponse(response);
}
