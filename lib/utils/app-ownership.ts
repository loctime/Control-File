// lib/utils/app-ownership.ts
// Utilidades para manejo de ownership por aplicación

import { Firestore } from 'firebase-admin/firestore';

/**
 * Whitelist de valores permitidos para metadata.source
 */
const ALLOWED_SOURCES = ['navbar', 'taskbar'] as const;

/**
 * Valida y normaliza el valor de source usando whitelist defensiva
 * Si el valor no está en la whitelist, retorna 'navbar' como default seguro
 */
export function validateAndNormalizeSource(source: string | undefined | null): string {
  if (!source || typeof source !== 'string') {
    return 'navbar';
  }
  
  const normalizedSource = source.trim().toLowerCase();
  
  if (ALLOWED_SOURCES.includes(normalizedSource as typeof ALLOWED_SOURCES[number])) {
    return normalizedSource;
  }
  
  // Si no está en la whitelist, retornar default seguro
  return 'navbar';
}

/**
 * Normaliza app.id como slug (lowercase, a-z, 0-9, guiones)
 */
export function normalizeAppId(appId: string): string {
  if (!appId || typeof appId !== 'string') {
    throw new Error('app.id must be a non-empty string');
  }
  
  return appId
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Obtiene o crea la carpeta raíz de una aplicación para un usuario
 * Una carpeta raíz tiene:
 * - parentId = null
 * - type = 'folder'
 * - appId = app.id normalizado
 * - isAppRoot = true (marca explícita de carpeta raíz)
 * - metadata.source = 'taskbar'
 * - name = app.name
 */
export async function getOrCreateAppRootFolder(
  adminDb: Firestore,
  userId: string,
  appId: string,
  appName: string
): Promise<string> {
  const normalizedAppId = normalizeAppId(appId);
  
  // Buscar carpeta raíz existente
  const rootQuery = await adminDb.collection('files')
    .where('userId', '==', userId)
    .where('parentId', '==', null)
    .where('type', '==', 'folder')
    .where('appId', '==', normalizedAppId)
    .limit(1)
    .get();
  
  if (!rootQuery.empty) {
    const rootDoc = rootQuery.docs[0];
    // Asegurar que tenga isAppRoot marcado (para carpetas creadas antes de este cambio)
    const rootData = rootDoc.data();
    if (!rootData.isAppRoot) {
      await adminDb.collection('files').doc(rootDoc.id).update({
        isAppRoot: true
      });
    }
    return rootDoc.id;
  }
  
  // Crear carpeta raíz si no existe
  const rootFolderId = `root-${normalizedAppId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const rootSlug = appName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  
  await adminDb.collection('files').doc(rootFolderId).set({
    id: rootFolderId,
    userId,
    name: appName,
    slug: rootSlug,
    parentId: null,
    path: [],
    type: 'folder',
    appId: normalizedAppId,
    isAppRoot: true, // Marca explícita de carpeta raíz
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    metadata: {
      icon: 'Folder',
      color: 'text-purple-600',
      isMainFolder: false, // Carpeta raíz de app NO es carpeta principal del usuario
      isDefault: true,
      description: '',
      tags: [],
      isPublic: false,
      viewCount: 0,
      lastAccessedAt: new Date(),
      source: validateAndNormalizeSource('taskbar'), // Validado con whitelist
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true,
        canDownload: true
      },
      customFields: {}
    }
  });
  
  return rootFolderId;
}

/**
 * Valida que un parentId pertenezca a la misma appId
 * Retorna el appId del parent si existe y es válido
 */
export async function validateParentAppId(
  adminDb: Firestore,
  userId: string,
  parentId: string,
  expectedAppId: string
): Promise<void> {
  const normalizedExpectedAppId = normalizeAppId(expectedAppId);
  
  const parentDoc = await adminDb.collection('files').doc(parentId).get();
  
  if (!parentDoc.exists) {
    throw new Error(`Parent folder not found: ${parentId}`);
  }
  
  const parentData = parentDoc.data()!;
  
  // Verificar que pertenece al usuario
  if (parentData.userId !== userId) {
    throw new Error(`Parent folder does not belong to user`);
  }
  
  // Verificar que es una carpeta
  if (parentData.type !== 'folder') {
    throw new Error(`Parent must be a folder, got type: ${parentData.type}`);
  }
  
  // Verificar appId (si el parent no tiene appId, es un documento antiguo, rechazar)
  if (!parentData.appId) {
    throw new Error(`Parent folder does not have appId. Legacy folders cannot be used as parents.`);
  }
  
  const normalizedParentAppId = normalizeAppId(parentData.appId);
  
  if (normalizedParentAppId !== normalizedExpectedAppId) {
    throw new Error(
      `App mismatch: parent belongs to app '${parentData.appId}', but requested app is '${expectedAppId}'`
    );
  }
}

