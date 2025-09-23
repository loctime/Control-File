// types/index.ts
export interface User {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    planQuotaBytes: number;
    usedBytes: number;
    pendingBytes: number;
    createdAt: Date;
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
  version: number;
  createdAt: Date;
  modifiedAt: Date;
  isShared: boolean;
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
  createdAt: Date;
  modifiedAt: Date;
  metadata?: {
    icon?: string;
    color?: string;
    isMainFolder?: boolean;
    isDefault?: boolean;
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
  }