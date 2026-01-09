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
  presignedUrl: string;
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
