/**
 * Módulo de archivos
 * 
 * ⚠️ LEGACY: Este módulo expone APIs legacy que violan el contrato App ↔ ControlFile v1.
 * 
 * Las aplicaciones externas NO deben usar este módulo directamente para operaciones
 * que involucren carpetas o parentId.
 * 
 * Para operaciones contractuales, usar `client.forApp(appId, userId)` que devuelve
 * un módulo que cumple con el contrato v1.
 * 
 * Este módulo se mantiene por compatibilidad hacia atrás y será deprecado parcialmente
 * en el futuro (solo los métodos que exponen parentId).
 * 
 * @see CONTRACT-folders.md para más detalles sobre el contrato
 */

import { HttpClient } from '../utils/http';
import {
  validateFileId,
  validateFileName,
  validatePageSize,
  validateFile,
} from '../utils/validation';
import { ensurePath } from './folders/ensurePath';
import type {
  ListFilesParams,
  ListFilesResponse,
  GetDownloadUrlResponse,
  UploadParams,
  UploadResponse,
  UploadFileParams,
  FileResponse,
  ReplaceFileResponse,
  PresignUploadResponse,
  ConfirmUploadResponse,
  FileItem,
} from '../types';

export class FilesModule {
  constructor(private http: HttpClient) {}

  /**
   * Lista archivos y carpetas
   * 
   * ⚠️ LEGACY: Este método expone parentId, lo cual viola el contrato App ↔ ControlFile v1.
   * 
   * Las apps deben usar `client.forApp(appId, userId).listFiles({ path })` en su lugar,
   * que usa paths relativos al app root y no expone parentId.
   * 
   * @deprecated Para apps, usar `client.forApp(appId, userId).listFiles()` en su lugar
   */
  async list(params: ListFilesParams = {}): Promise<ListFilesResponse> {
    validatePageSize(params.pageSize);

    const qs = new URLSearchParams();
    if (params.parentId !== undefined) {
      qs.set('parentId', String(params.parentId));
    }
    if (params.pageSize) {
      qs.set('pageSize', String(params.pageSize));
    }
    if (params.cursor) {
      qs.set('cursor', params.cursor);
    }

    const queryString = qs.toString();
    const path = `/api/files/list${queryString ? `?${queryString}` : ''}`;

    const response = await this.http.call<{
      items?: FileItem[];
      data?: FileItem[];
      nextPage?: string | null;
    }>(path);

    // Manejar diferentes formatos de respuesta (con/sin cache)
    const items = response.items || response.data || [];
    return {
      items,
      nextPage: response.nextPage || null,
    };
  }

  /**
   * Obtiene URL de descarga presignada (expira en 5 minutos)
   */
  async getDownloadUrl(fileId: string): Promise<GetDownloadUrlResponse> {
    validateFileId(fileId);

    const response = await this.http.call<{
      success: boolean;
      downloadUrl: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
    }>('/api/files/presign-get', {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    });

    return {
      downloadUrl: response.downloadUrl,
      fileName: response.fileName,
      fileSize: response.fileSize,
      mimeType: response.mimeType,
    };
  }

  /**
   * Sube un archivo (flujo completo: presign → upload → confirm)
   * 
   * ⚠️ LEGACY: Este método expone parentId, lo cual viola el contrato App ↔ ControlFile v1.
   * 
   * Las apps deben usar `client.forApp(appId, userId).uploadFile({ file, path })` en su lugar,
   * que usa paths relativos al app root y no expone parentId.
   * 
   * @deprecated Para apps, usar `client.forApp(appId, userId).uploadFile()` en su lugar
   */
  async upload(params: UploadParams): Promise<UploadResponse> {
    validateFile(params.file);
    validateFileName(params.name);

    const fileBlob: globalThis.File | Blob = params.file;
    const fileSize = fileBlob.size;
    const mime = fileBlob.type || 'application/octet-stream';

    // Paso 1: Presign
    if (params.onProgress) {
      params.onProgress(5);
    }

    const presignResponse = await this.http.call<PresignUploadResponse>(
      '/api/uploads/presign',
      {
        method: 'POST',
        body: JSON.stringify({
          name: params.name,
          size: fileSize,
          mime,
          parentId: params.parentId,
        }),
      }
    );

    if (params.onProgress) {
      params.onProgress(10);
    }

    // Paso 2: Upload al storage usando uploadUrl, method y headers del backend
    const uploadUrl = presignResponse.uploadUrl;
    const method = presignResponse.method || 'PUT';
    const headers = presignResponse.headers || {};

    // Upload con tracking de progreso
    await this.uploadToStorage(
      uploadUrl,
      fileBlob,
      method,
      headers,
      params.onProgress
    );

    if (params.onProgress) {
      params.onProgress(90);
    }

    // Paso 3: Confirmar upload
    const confirmResponse = await this.http.call<ConfirmUploadResponse>(
      '/api/uploads/confirm',
      {
        method: 'POST',
        body: JSON.stringify({
          uploadSessionId: presignResponse.uploadSessionId,
          key: presignResponse.fileKey,
          size: fileSize,
          mime,
          name: params.name,
          parentId: params.parentId,
        }),
      }
    );

    if (!confirmResponse.fileId) {
      throw new Error('La respuesta de confirmación no incluye fileId');
    }

    if (params.onProgress) {
      params.onProgress(100);
    }

    return {
      fileId: confirmResponse.fileId,
      fileName: params.name,
      fileSize,
    };
  }

  /**
   * Sube el archivo al storage usando uploadUrl, method y headers del backend
   */
  private async uploadToStorage(
    url: string,
    fileBlob: globalThis.File | Blob,
    method: string = 'PUT',
    headers: Record<string, string> = {},
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          // Progreso del 10% al 90% (el resto es para presign y confirm)
          const uploadProgress = (event.loaded / event.total) * 80 + 10;
          onProgress(Math.min(uploadProgress, 90));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was aborted'));
      });

      xhr.open(method, url);

      // Aplicar headers del backend
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Enviar el archivo directamente como Blob/File
      xhr.send(fileBlob);
    });
  }

  /**
   * Elimina un archivo (soft delete)
   */
  async delete(fileId: string): Promise<void> {
    validateFileId(fileId);

    await this.http.call('/api/files/delete', {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    });
  }

  /**
   * Renombra un archivo
   */
  async rename(fileId: string, newName: string): Promise<void> {
    validateFileId(fileId);
    validateFileName(newName);

    await this.http.call('/api/files/rename', {
      method: 'POST',
      body: JSON.stringify({ fileId, newName }),
    });
  }

  /**
   * Reemplaza el contenido de un archivo existente
   */
  async replace(fileId: string, file: globalThis.File | Blob): Promise<ReplaceFileResponse> {
    validateFileId(fileId);
    validateFile(file);

    const formData = new FormData();
    formData.append('fileId', fileId);
    formData.append('file', file);

    const response = await this.http.call<{
      success: boolean;
      message: string;
      size: number;
      mime: string;
    }>('/api/files/replace', {
      method: 'POST',
      body: formData,
    }, true); // requireAuth

    return {
      fileId,
      size: response.size,
      mime: response.mime,
    };
  }

  /**
   * Sube un archivo asegurando primero que la ruta de carpetas exista
   * 
   * ⚠️ LEGACY: Este método usa ensurePath legacy que puede crear carpetas raíz,
   * lo cual viola el contrato App ↔ ControlFile v1.
   * 
   * Las apps deben usar `client.forApp(appId, userId).uploadFile({ file, path })` en su lugar,
   * que resuelve paths relativos al app root y cumple con el contrato v1.
   * 
   * @deprecated Para apps, usar `client.forApp(appId, userId).uploadFile()` en su lugar
   */
  async uploadFile(params: UploadFileParams): Promise<FileResponse> {
    const { file, path, userId, onProgress } = params;

    if (!file || !(file instanceof File || file instanceof Blob)) {
      throw new Error('El parámetro file debe ser un File o Blob válido');
    }

    const fileName = file instanceof File ? file.name : 'archivo';

    if (!fileName || fileName.trim() === '') {
      throw new Error('El archivo debe tener un nombre válido');
    }

    const folderId = await ensurePath(this.http, { path, userId });

    if (!folderId) {
      throw new Error('No se pudo obtener el folderId de la ruta');
    }

    return this.upload({
      file,
      name: fileName,
      parentId: folderId,
      onProgress,
    });
  }
}
