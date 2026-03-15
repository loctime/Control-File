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

export interface EmptyTrashResponse {
  success: boolean;
  deletedIds: string[];
  notFound?: string[];
  unauthorized?: string[];
}

export type FileInput = globalThis.File | Blob;

export interface CreateShareParams {
  fileId: string;
  expiresIn?: number;
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

export interface CreateFolderParams {
  name: string;
  parentId?: string | null;
  id?: string;
  icon?: string;
  color?: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  customFields?: Record<string, unknown>;
  source?: string;
}

export interface CreateFolderResponse {
  success: boolean;
  folderId: string;
  slug?: string;
  path?: string;
  message?: string;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

export interface UserSettingsResponse {
  billingInterval: 'monthly' | 'yearly' | null;
}

export interface UpdateUserSettingsInput {
  billingInterval: 'monthly' | 'yearly';
}

export interface TaskbarItem {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type?: 'folder' | 'app';
  isCustom?: boolean;
  folderId?: string;
}

export interface UpdateUserProfileInput {
  displayName?: string;
  username?: string;
  bio?: string;
  website?: string;
  location?: string;
  isPublic?: boolean;
  customFields?: Record<string, unknown>;
}

export interface UserProfileMetadata {
  bio?: string;
  website?: string;
  location?: string;
  isPublic?: boolean;
  customFields?: Record<string, unknown>;
}

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  username?: string;
  planQuotaBytes?: number;
  usedBytes?: number;
  pendingBytes?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  metadata?: UserProfileMetadata;
}

export interface UserProfileResponse extends SuccessResponse {
  user: UserProfile;
}

export interface UpdateUserProfileResponse extends SuccessResponse {}

export interface InitializeUserResponse extends SuccessResponse {
  user: UserProfile;
}

export interface UpdateTaskbarResponse extends SuccessResponse {
  items: TaskbarItem[];
}

export interface ControlFileClientOptions {
  timeout?: number;
  retries?: number;
}

export interface ControlFileClientConfig {
  baseUrl: string;
  getAuthToken: () => Promise<string>;
  options?: ControlFileClientOptions;
}

export interface AppListFilesParams {
  path?: string | string[];
  pageSize?: number;
  cursor?: string;
}

export interface AppEnsurePathParams {
  path: string | string[];
}

export interface AppUploadFileParams {
  file: globalThis.File | Blob;
  path?: string | string[];
  onProgress?: (progress: number) => void;
}

export interface AppFilesContext {
  appId: string;
  userId: string;
}
