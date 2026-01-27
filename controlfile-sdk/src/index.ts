/**
 * Export principal del SDK @controlfile/sdk
 */

// Cliente principal
export { ControlFileClient } from './client';

// Módulo contractual (para uso interno, normalmente se accede vía client.forApp())
export { AppFilesModule } from './modules/app-files';

// Tipos públicos
export type {
  // Tipos de dominio
  File,
  Folder,
  FileItem,
  Share,
  ShareInfo,
  Account,
  AccountStatus,
  
  // Tipos de parámetros
  ListFilesParams,
  UploadParams,
  EnsurePathParams,
  UploadFileParams,
  CreateShareParams,
  
  // Tipos de respuesta
  ListFilesResponse,
  GetDownloadUrlResponse,
  UploadResponse,
  FileResponse,
  ReplaceFileResponse,
  CreateShareResponse,
  ShareDownloadResponse,
  
  // Configuración
  ControlFileClientConfig,
  ControlFileClientOptions,
  
  // API Contractual v1
  AppFilesContext,
  AppListFilesParams,
  AppEnsurePathParams,
  AppUploadFileParams,
} from './types';

// Errores tipados
export {
  ControlFileError,
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
  QuotaExceededError,
  ValidationError,
  NetworkError,
  ServerError,
} from './errors';
