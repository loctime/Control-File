/**
 * Módulo de archivos
 */

import { HttpClient } from '../utils/http';
import {
  validateFileId,
  validateFileName,
  validatePageSize,
  validateFile,
} from '../utils/validation';
import type {
  ListFilesParams,
  ListFilesResponse,
  GetDownloadUrlResponse,
  UploadParams,
  UploadResponse,
  ReplaceFileResponse,
  PresignUploadResponse,
  ConfirmUploadResponse,
  FileItem,
} from '../types';

export class FilesModule {
  constructor(private http: HttpClient) {}

  /**
   * Lista archivos y carpetas
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

    // Paso 2: Upload al storage (B2)
    const uploadUrl = presignResponse.presignedUrl;
    const formData = new FormData();

    // Si hay campos adicionales del presign (para multipart upload)
    if (presignResponse.fields) {
      Object.entries(presignResponse.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    formData.append('file', fileBlob);

    // Upload con tracking de progreso
    await this.uploadToStorage(uploadUrl, formData, params.onProgress);

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
   * Sube el archivo al storage (B2) con tracking de progreso
   */
  private async uploadToStorage(
    url: string,
    formData: FormData,
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

      xhr.open('POST', url);
      xhr.send(formData);
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
}
