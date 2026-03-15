/**
 * Modulo contractual de archivos para aplicaciones externas.
 */

import type { ConfirmUploadResponse, PresignUploadResponse } from '../../internal/api-types.js';
import { uploadToStorage as uploadFileToStorage } from '../../internal/uploader.js';
import type {
  AppEnsurePathParams,
  AppListFilesParams,
  AppUploadFileParams,
  ListFilesResponse,
  UploadResponse,
} from '../../types.js';
import { HttpClient } from '../../utils/http.js';
import { validateFile, validatePageSize } from '../../utils/validation.js';
import { getOrCreateAppRoot } from './appRoot.js';
import { ensurePathRelative, resolvePathRelative } from './ensurePathRelative.js';
import { normalizePath } from './pathUtils.js';

export class AppFilesModule {
  private appRootId: string | null = null;

  constructor(
    private http: HttpClient,
    private appId: string,
    private userId: string
  ) {}

  async initialize(): Promise<void> {
    if (!this.appRootId) {
      this.appRootId = await getOrCreateAppRoot(this.http, this.appId, this.userId);
    }
  }

  private async ensureInitialized(): Promise<string> {
    if (!this.userId || this.userId.trim().length === 0) {
      throw new Error('userId es requerido. Proporcione client.appFiles.forApp(appId, userId).');
    }

    if (!this.appRootId) {
      await this.initialize();
    }

    if (!this.appRootId) {
      throw new Error('No se pudo inicializar el app root');
    }

    return this.appRootId;
  }

  setUserId(userId: string): void {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('userId es requerido y debe ser una cadena no vacia');
    }

    this.userId = userId;
  }

  async listFiles(params: AppListFilesParams = {}): Promise<ListFilesResponse> {
    validatePageSize(params.pageSize);

    const appRootId = await this.ensureInitialized();
    let parentId = appRootId;

    const normalizedPath = normalizePath(params.path);
    if (normalizedPath.length > 0) {
      const resolvedId = await resolvePathRelative(
        this.http,
        appRootId,
        normalizedPath,
        this.userId
      );

      if (!resolvedId) {
        return {
          items: [],
          nextPage: null,
        };
      }

      parentId = resolvedId;
    }

    const qs = new URLSearchParams();
    qs.set('parentId', parentId);
    if (params.pageSize) {
      qs.set('pageSize', String(params.pageSize));
    }
    if (params.cursor) {
      qs.set('cursor', params.cursor);
    }

    const queryString = qs.toString();
    const path = `/api/files/list${queryString ? `?${queryString}` : ''}`;

    const response = await this.http.call<{
      items?: any[];
      data?: any[];
      nextPage?: string | null;
    }>(path);

    return {
      items: response.items || response.data || [],
      nextPage: response.nextPage || null,
    };
  }

  async ensurePath(pathOrParams: string | string[] | AppEnsurePathParams): Promise<string> {
    const path = typeof pathOrParams === 'string' || Array.isArray(pathOrParams)
      ? pathOrParams
      : pathOrParams.path;

    const normalizedPath = normalizePath(path);
    if (normalizedPath.length === 0) {
      throw new Error('El path no puede estar vacio');
    }

    const appRootId = await this.ensureInitialized();

    return ensurePathRelative(this.http, appRootId, normalizedPath, this.userId);
  }

  async uploadFile(params: AppUploadFileParams): Promise<UploadResponse> {
    validateFile(params.file);

    const appRootId = await this.ensureInitialized();
    const fileBlob: globalThis.File | Blob = params.file;
    const fileSize = fileBlob.size;
    const mime = fileBlob.type || 'application/octet-stream';
    const fileName = typeof (fileBlob as { name?: unknown }).name === 'string'
      ? (fileBlob as { name: string }).name
      : 'archivo';

    if (!fileName || fileName.trim() === '') {
      throw new Error('El archivo debe tener un nombre valido');
    }

    let parentId = appRootId;
    const normalizedPath = normalizePath(params.path);
    if (normalizedPath.length > 0) {
      parentId = await ensurePathRelative(this.http, appRootId, normalizedPath, this.userId);
    }

    if (params.onProgress) {
      params.onProgress(5);
    }

    const presignResponse = await this.http.call<PresignUploadResponse>(
      '/api/uploads/presign',
      {
        method: 'POST',
        body: JSON.stringify({
          name: fileName,
          size: fileSize,
          mime,
          parentId,
        }),
      }
    );

    if (params.onProgress) {
      params.onProgress(10);
    }

    await this.uploadToStorage(
      presignResponse.uploadUrl,
      fileBlob,
      presignResponse.method || 'PUT',
      presignResponse.headers || {},
      params.onProgress
    );

    if (params.onProgress) {
      params.onProgress(90);
    }

    const confirmResponse = await this.http.call<ConfirmUploadResponse>(
      '/api/uploads/confirm',
      {
        method: 'POST',
        body: JSON.stringify({
          uploadSessionId: presignResponse.uploadSessionId,
          key: presignResponse.fileKey,
          size: fileSize,
          mime,
          name: fileName,
          parentId,
        }),
      }
    );

    if (!confirmResponse.fileId) {
      throw new Error('La respuesta de confirmacion no incluye fileId');
    }

    if (params.onProgress) {
      params.onProgress(100);
    }

    return {
      fileId: confirmResponse.fileId,
      fileName,
      fileSize,
    };
  }

  private async uploadToStorage(
    url: string,
    fileBlob: globalThis.File | Blob,
    method: string = 'PUT',
    headers: Record<string, string> = {},
    onProgress?: (progress: number) => void
  ): Promise<void> {
    await uploadFileToStorage({
      url,
      file: fileBlob,
      method,
      headers,
      onProgress,
      progressStart: 10,
      progressEnd: 90,
    });
  }
}
