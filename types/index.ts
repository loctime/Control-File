// types/index.ts
  export interface User {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    username: string; // Para URLs amigables
    planQuotaBytes: number;
    usedBytes: number;
    pendingBytes: number;
    createdAt: Date;
    metadata?: {
      bio?: string;
      website?: string;
      location?: string;
      isPublic?: boolean;
      customFields?: Record<string, any>;
    };
  }
  
  export interface DriveFile {
  id: string;
  userId: string;
  bucketKey: string;
  name: string;
  size: number;
  mime: string;
  checksum: string;
  parentId: string | null;
  path: string;
  slug: string; // Para URLs amigables
  version: number;
  createdAt: Date;
  modifiedAt: Date;
  isShared: boolean;
  metadata?: {
    // Metadatos extendidos para archivos
    description?: string;
    tags?: string[];
    isPublic?: boolean;
    downloadCount?: number;
    lastAccessedAt?: Date;
    thumbnail?: string;
    exif?: Record<string, any>; // Metadatos de imagen
    customFields?: Record<string, any>;
    permissions?: {
      canEdit?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
      canDownload?: boolean;
    };
  };
  // Campos para papelera
  deletedAt?: Date;
  expiresAt?: Date;
  originalPath?: string;
}
  
  export interface DriveFolder {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  path: string;
  slug: string; // Para URLs amigables
  createdAt: Date;
  modifiedAt: Date;
  metadata?: {
    icon?: string;
    color?: string;
    isMainFolder?: boolean;
    isDefault?: boolean;
    // Metadatos extendidos
    description?: string;
    tags?: string[];
    isPublic?: boolean;
    viewCount?: number;
    lastAccessedAt?: Date;
    permissions?: {
      canEdit?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
      canDownload?: boolean;
    };
    thumbnail?: string;
    customFields?: Record<string, any>;
  };
  // Campos para papelera
  deletedAt?: Date;
  expiresAt?: Date;
  originalPath?: string;
}
  
  export interface Share {
    id: string;
    userId: string;
    fileId?: string;
    prefix?: string;
    role: 'viewer' | 'editor';
    isPublic: boolean;
    expiresAt: Date | null;
    revocationCounter: number;
    createdAt: Date;
  }
  
  export interface UploadSession {
    id: string;
    uid: string;
    size: number;
    parentId: string | null;
    name: string;
    mime: string;
    status: 'pending' | 'confirmed' | 'failed';
    expiresAt: Date;
    createdAt: Date;
    bucketKey?: string;
    uploadId?: string; // For multipart uploads
  }
  
  export interface BreadcrumbItem {
    id: string;
    name: string;
    path: string;
    slug: string; // Para URLs amigables
  }
  
  export type DriveItem = (DriveFile & { type: 'file' }) | (DriveFolder & { type: 'folder' });
  
  export interface ContextMenuItem {
    label: string;
    icon: string;
    action: string;
    shortcut?: string;
    disabled?: boolean;
    separator?: boolean;
  }
  
  export interface UploadProgress {
    sessionId: string;
    filename: string;
    fileSize?: number;
    progress: number;
    status: 'uploading' | 'processing' | 'complete' | 'error';
    error?: string;
  }
  
  export interface ViewMode {
    type: 'list' | 'grid';
    sortBy: 'name' | 'size' | 'type' | 'modified';
    sortOrder: 'asc' | 'desc';
  }
  
  export interface SearchFilters {
    query: string;
    type?: 'all' | 'files' | 'folders';
    mime?: string;
    sizeMin?: number;
    sizeMax?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }
  
  // API Response types
  export interface PresignResponse {
    uploadSessionId: string;
    key: string;
    url: string;
    multipart?: {
      uploadId: string;
      parts: Array<{
        partNumber: number;
        url: string;
      }>;
    };
  }
  
  export interface ShareResponse {
    shareId: string;
    publicUrl: string;
    expiresAt: Date | null;
  }
  
  // Error types
  export interface ApiError {
    code: string;
    message: string;
    details?: any;
  }
  
  // UI State types
  export interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    duration?: number;
    // Información del archivo para errores de subida
    fileInfo?: {
      name: string;
      size?: number;
      type?: string;
      file?: File; // Para poder abrir el archivo en caso de error
      fileId?: string; // ID del archivo recién creado
    };
  }