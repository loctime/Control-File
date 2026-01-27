/**
 * Tipos de dominio del SDK
 */

export interface File {
  id: string;
  userId: string;
  name: string;
  size: number;
  mime: string;
  type: 'file';
  parentId: string | null;
  appId?: string;
  bucketKey?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
}

/**
 * Carpeta en el sistema de archivos
 * 
 * Nota: Las carpetas y archivos comparten la misma colección (files) diferenciados por el campo 'type'.
 * Esto permite:
 * - Árbol unificado de archivos y carpetas
 * - UI tipo Explorer
 * - Permisos por nodo
 * 
 * El backend debe tener un índice único (userId, parentId, name) para garantizar idempotencia.
 */
export interface Folder {
  id: string;
  userId: string;
  name: string;
  type: 'folder';
  parentId: string | null;
  appId?: string;
  icon?: string;
  color?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
}

/**
 * Unión de archivo o carpeta
 * Permite trabajar con ambos tipos de forma unificada en el árbol de archivos
 */
export type FileItem = File | Folder;

export interface Share {
  token: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mime: string;
  expiresAt: Date | string | null;
  createdAt: Date | string;
  downloadCount: number;
  shareUrl: string;
}

export interface ShareInfo {
  fileName: string;
  fileSize: number;
  mime: string;
  expiresAt: Date | string | null;
  downloadCount: number;
}

/**
 * Tipos de cuenta
 */

export type AccountStatus = 'active' | 'trial' | 'expired' | 'suspended';

export interface Account {
  uid: string;
  email: string;
  status: AccountStatus;
  planId: string;
  limits: {
    storageBytes: number;
  };
  enabledApps: Record<string, boolean>;
  paidUntil: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tipos de parámetros para métodos del SDK
 */

export interface ListFilesParams {
  parentId?: string | null;
  pageSize?: number;
  cursor?: string;
}

export interface ListFilesResponse {
  items: FileItem[];
  nextPage: string | null;
}

export interface GetDownloadUrlResponse {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadParams {
  file: globalThis.File | Blob;
  name: string;
  parentId: string | null;
  onProgress?: (progress: number) => void;
}

export interface UploadResponse {
  fileId: string;
  fileName: string;
  fileSize: number;
}

export interface ReplaceFileResponse {
  fileId: string;
  size: number;
  mime: string;
}

export type FileInput = globalThis.File | Blob;

export interface CreateShareParams {
  fileId: string;
  expiresIn?: number; // horas, default: 24
}

export interface CreateShareResponse {
  shareToken: string;
  shareUrl: string;
  expiresAt: Date | string;
  fileName: string;
}

export interface ShareDownloadResponse {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
}

export interface EnsurePathParams {
  path: string[];
  userId: string;
}

export interface UploadFileParams {
  file: globalThis.File | Blob;
  path: string[];
  userId: string;
  onProgress?: (progress: number) => void;
}

export type FileResponse = UploadResponse;

/**
 * Configuración del cliente
 */

export interface ControlFileClientOptions {
  timeout?: number;
  retries?: number;
}

export interface ControlFileClientConfig {
  baseUrl: string;
  getAuthToken: () => Promise<string>;
  options?: ControlFileClientOptions;
}

/**
 * Respuestas internas de la API (antes de normalización)
 */

export interface PresignUploadResponse {
  success: boolean;
  uploadSessionId: string;
  uploadUrl: string;
  method?: string;
  headers?: Record<string, string>;
  fields?: Record<string, string>;
  fileKey: string;
}

export interface ConfirmUploadResponse {
  success: boolean;
  fileId: string;
  message: string;
}

export interface ShareCreateApiResponse {
  shareToken: string;
  shareUrl: string;
  expiresAt: Date | string;
  fileName: string;
}

export interface ShareInfoApiResponse {
  fileName: string;
  fileSize: number;
  mime: string;
  expiresAt: Date | string | null;
  downloadCount: number;
}

/**
 * ============================================================================
 * API CONTRACTUAL v1 - Tipos para aplicaciones externas
 * ============================================================================
 * 
 * Estos tipos implementan el contrato App ↔ ControlFile v1.
 * Las apps deben usar estos tipos en lugar de los tipos legacy que exponen parentId.
 * 
 * @see CONTRACT-folders.md para más detalles sobre el contrato
 */

/**
 * Parámetros para listar archivos usando paths relativos al app root
 * 
 * ⚠️ CONTRACTUAL: No expone parentId. Usa paths relativos al app root.
 */
export interface AppListFilesParams {
  /**
   * Path relativo al app root (ej: 'documentos/2024' o ['documentos', '2024'])
   * Si es vacío o undefined, lista el contenido del app root
   */
  path?: string | string[];
  pageSize?: number;
  cursor?: string;
}

/**
 * Parámetros para asegurar un path relativo al app root
 * 
 * ⚠️ CONTRACTUAL: No permite crear carpetas raíz (parentId = null).
 * Todos los paths son relativos al app root.
 */
export interface AppEnsurePathParams {
  /**
   * Path relativo al app root (ej: 'documentos/aprobados' o ['documentos', 'aprobados'])
   * No puede estar vacío
   */
  path: string | string[];
}

/**
 * Parámetros para subir un archivo usando path relativo al app root
 * 
 * ⚠️ CONTRACTUAL: No expone parentId. Usa paths relativos al app root.
 */
export interface AppUploadFileParams {
  file: globalThis.File | Blob;
  /**
   * Path relativo al app root donde se subirá el archivo
   * (ej: 'documentos/2024' o ['documentos', '2024'])
   */
  path?: string | string[];
  onProgress?: (progress: number) => void;
}

/**
 * Contexto de aplicación para operaciones contractuales
 * 
 * Este contexto encapsula el appId y userId, permitiendo operaciones
 * que son relativas al app root sin exponer parentId.
 */
export interface AppFilesContext {
  /**
   * ID de la aplicación (ej: 'controldoc', 'controlaudit')
   */
  appId: string;
  /**
   * ID del usuario autenticado
   */
  userId: string;
}