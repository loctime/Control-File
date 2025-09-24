// lib/url-utils.ts
import { DriveFolder, DriveFile, User } from '@/types';

/**
 * Genera un slug único a partir de un nombre
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
    .replace(/[\s_-]+/g, '-') // Reemplazar espacios y guiones con un solo guión
    .replace(/^-+|-+$/g, ''); // Remover guiones al inicio y final
}

/**
 * Obtiene el slug de un item, generándolo si no existe (compatibilidad)
 */
export function getItemSlug(item: { slug?: string; name: string }): string {
  if (item.slug) {
    return item.slug;
  }
  // Generar slug para compatibilidad con datos existentes
  return generateSlug(item.name);
}

/**
 * Obtiene el username de un usuario, generándolo si no existe (compatibilidad)
 */
export function getUserUsername(user: { username?: string; email?: string }): string {
  if (user.username) {
    return user.username;
  }
  // Generar username para compatibilidad con datos existentes
  if (user.email) {
    return generateUsernameFromEmail(user.email);
  }
  return 'usuario';
}

/**
 * Genera un slug único para evitar duplicados
 */
export function generateUniqueSlug(baseName: string, existingSlugs: string[]): string {
  const baseSlug = generateSlug(baseName);
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Genera un username único a partir del email
 */
export function generateUsernameFromEmail(email: string): string {
  const baseUsername = email.split('@')[0];
  return generateSlug(baseUsername);
}

/**
 * Construye la URL completa de una carpeta
 */
export function buildFolderUrl(username: string, folderPath: string[]): string {
  const pathSegments = folderPath.filter(segment => segment && segment.trim() !== '');
  return `/${username}/${pathSegments.join('/')}`;
}

/**
 * Construye la URL completa de un archivo
 */
export function buildFileUrl(username: string, folderPath: string[], fileName: string): string {
  const pathSegments = folderPath.filter(segment => segment && segment.trim() !== '');
  const fileSlug = generateSlug(fileName);
  return `/${username}/${pathSegments.join('/')}/${fileSlug}`;
}

/**
 * Extrae información de una URL de carpeta
 */
export function parseFolderUrl(url: string): { username: string; path: string[] } | null {
  const match = url.match(/^\/([^\/]+)\/(.*)$/);
  if (!match) return null;

  const [, username, pathString] = match;
  const path = pathString ? pathString.split('/').filter(segment => segment.trim() !== '') : [];
  
  return { username, path };
}

/**
 * Extrae información de una URL de archivo
 */
export function parseFileUrl(url: string): { username: string; path: string[]; fileName: string } | null {
  const match = url.match(/^\/([^\/]+)\/(.*)\/([^\/]+)$/);
  if (!match) return null;

  const [, username, pathString, fileName] = match;
  const path = pathString ? pathString.split('/').filter(segment => segment.trim() !== '') : [];
  
  return { username, path, fileName };
}

/**
 * Valida si un username es válido
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  return usernameRegex.test(username) && username.length >= 3 && username.length <= 30;
}

/**
 * Valida si un slug es válido
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  return slugRegex.test(slug) && slug.length >= 1 && slug.length <= 50;
}

/**
 * Convierte una ruta de breadcrumb a URL
 */
export function breadcrumbToUrl(username: string, breadcrumb: Array<{ slug: string }>): string {
  const path = breadcrumb.map(item => item.slug);
  return buildFolderUrl(username, path);
}

/**
 * Convierte una URL a breadcrumb
 */
export function urlToBreadcrumb(url: string, items: Array<{ slug: string; name: string; id: string }>): Array<{ id: string; name: string; path: string; slug: string }> {
  const parsed = parseFolderUrl(url);
  if (!parsed) return [];

  const breadcrumb: Array<{ id: string; name: string; path: string; slug: string }> = [];
  let currentPath = '';

  for (const slug of parsed.path) {
    const item = items.find(i => i.slug === slug);
    if (item) {
      currentPath += `/${slug}`;
      breadcrumb.push({
        id: item.id,
        name: item.name,
        path: currentPath,
        slug: item.slug
      });
    }
  }

  return breadcrumb;
}

/**
 * Genera metadatos por defecto para una carpeta
 */
export function generateDefaultFolderMetadata(): DriveFolder['metadata'] {
  return {
    icon: 'Folder',
    color: 'text-purple-600',
    isMainFolder: false,
    isDefault: false,
    isPublic: false,
    viewCount: 0,
    permissions: {
      canEdit: true,
      canDelete: true,
      canShare: true,
      canDownload: true
    }
  };
}

/**
 * Genera metadatos por defecto para un archivo
 */
export function generateDefaultFileMetadata(): DriveFile['metadata'] {
  return {
    isPublic: false,
    downloadCount: 0,
    permissions: {
      canEdit: true,
      canDelete: true,
      canShare: true,
      canDownload: true
    }
  };
}

/**
 * Genera metadatos por defecto para un usuario
 */
export function generateDefaultUserMetadata(): User['metadata'] {
  return {
    isPublic: false
  };
}
