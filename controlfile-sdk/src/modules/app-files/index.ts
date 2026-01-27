/**
 * Módulo de archivos contractual para aplicaciones externas
 * 
 * ⚠️ CONTRACTUAL v1: Este módulo implementa el contrato App ↔ ControlFile v1.
 * 
 * Características:
 * - Encapsula la jerarquía (no expone parentId)
 * - Resuelve paths relativos al app root
 * - No permite crear carpetas raíz (parentId = null)
 * - No usa endpoints legacy directamente desde la API pública
 * 
 * Las apps deben usar este módulo en lugar de los módulos legacy (files, folders).
 * 
 * @see CONTRACT-folders.md para más detalles sobre el contrato
 */

import { HttpClient } from '../../utils/http';
import { validatePageSize, validateFileName, validateFile } from '../../utils/validation';
import { getOrCreateAppRoot } from './appRoot';
import { ensurePathRelative, resolvePathRelative } from './ensurePathRelative';
import { normalizePath } from './pathUtils';
import type {
  AppListFilesParams,
  AppEnsurePathParams,
  AppUploadFileParams,
  ListFilesResponse,
  UploadResponse,
  PresignUploadResponse,
  ConfirmUploadResponse,
} from '../../types';

export class AppFilesModule {
  private appRootId: string | null = null;

  constructor(
    private http: HttpClient,
    private appId: string,
    private userId: string
  ) {}

  /**
   * Inicializa el módulo obteniendo/creando el app root
   * 
   * Debe llamarse antes de usar otros métodos, o se llamará automáticamente
   * en la primera operación que lo requiera.
   */
  async initialize(): Promise<void> {
    if (!this.appRootId) {
      this.appRootId = await getOrCreateAppRoot(this.http, this.appId, this.userId);
    }
  }

  /**
   * Asegura que el app root esté inicializado
   */
  private async ensureInitialized(): Promise<string> {
    // Validar userId si no se proporcionó
    if (!this.userId || this.userId.trim().length === 0) {
      throw new Error('userId es requerido. Proporciónelo al llamar client.forApp(appId, userId) o configure el userId antes de usar el módulo.');
    }
    
    if (!this.appRootId) {
      await this.initialize();
    }
    if (!this.appRootId) {
      throw new Error('No se pudo inicializar el app root');
    }
    return this.appRootId;
  }
  
  /**
   * Establece el userId si no se proporcionó en el constructor
   * 
   * Útil cuando se crea el módulo sin userId y se quiere establecer después
   */
  setUserId(userId: string): void {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('userId es requerido y debe ser una cadena no vacía');
    }
    this.userId = userId;
  }

  /**
   * Lista archivos y carpetas en un path relativo al app root
   * 
   * ⚠️ CONTRACTUAL: No expone parentId. Usa paths relativos al app root.
   * ⚠️ No crea carpetas automáticamente. Si el path no existe, retorna lista vacía.
   * 
   * @example
   * ```typescript
   * // Listar contenido del app root
   * const root = await appFiles.listFiles({});
   * 
   * // Listar contenido de una subcarpeta (acepta string o array)
   * const docs = await appFiles.listFiles({ path: 'documentos' });
   * const docs2 = await appFiles.listFiles({ path: ['documentos', '2024'] });
   * ```
   */
  async listFiles(params: AppListFilesParams = {}): Promise<ListFilesResponse> {
    validatePageSize(params.pageSize);

    const appRootId = await this.ensureInitialized();
    
    // Resolver el parentId desde el path relativo (sin crear carpetas)
    let parentId: string = appRootId;
    
    const normalizedPath = normalizePath(params.path);
    if (normalizedPath.length > 0) {
      // Solo buscar, no crear (sin efectos secundarios)
      const resolvedId = await resolvePathRelative(
        this.http,
        appRootId,
        normalizedPath,
        this.userId
      );
      
      if (!resolvedId) {
        // Path no existe, retornar lista vacía
        return {
          items: [],
          nextPage: null,
        };
      }
      
      parentId = resolvedId;
    }

    // Listar archivos usando el parentId resuelto
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

    const items = response.items || response.data || [];
    return {
      items,
      nextPage: response.nextPage || null,
    };
  }

  /**
   * Asegura que un path relativo al app root exista, creándolo si es necesario
   * 
   * ⚠️ CONTRACTUAL: No permite crear carpetas raíz (parentId = null).
   * Todos los paths son relativos al app root.
   * 
   * @example
   * ```typescript
   * // Forma directa (caso común)
   * const folderId = await appFiles.ensurePath('documentos/aprobados');
   * const folderId2 = await appFiles.ensurePath(['documentos', 'aprobados']);
   * 
   * // Forma con objeto (para futuras opciones)
   * const folderId3 = await appFiles.ensurePath({ path: 'documentos/aprobados' });
   * ```
   */
  async ensurePath(pathOrParams: string | string[] | AppEnsurePathParams): Promise<string> {
    // Normalizar parámetros: aceptar tanto path directo como objeto
    let path: string | string[];
    
    if (typeof pathOrParams === 'string' || Array.isArray(pathOrParams)) {
      path = pathOrParams;
    } else {
      path = pathOrParams.path;
    }

    const normalizedPath = normalizePath(path);
    if (normalizedPath.length === 0) {
      throw new Error('El path no puede estar vacío');
    }

    const appRootId = await this.ensureInitialized();
    
    return ensurePathRelative(
      this.http,
      appRootId,
      normalizedPath,
      this.userId
    );
  }

  /**
   * Sube un archivo a un path relativo al app root
   * 
   * ⚠️ CONTRACTUAL: No expone parentId. Usa paths relativos al app root.
   * 
   * @example
   * ```typescript
   * const file = document.querySelector('input[type="file"]').files[0];
   * const result = await appFiles.uploadFile({
   *   file,
   *   path: ['documentos', '2024'] // Opcional, si no se especifica sube al app root
   * });
   * ```
   */
  async uploadFile(params: AppUploadFileParams): Promise<UploadResponse> {
    validateFile(params.file);
    
    const appRootId = await this.ensureInitialized();

    const fileBlob: globalThis.File | Blob = params.file;
    const fileSize = fileBlob.size;
    const mime = fileBlob.type || 'application/octet-stream';
    
    // Determinar el nombre del archivo
    const fileName = fileBlob instanceof File 
      ? fileBlob.name 
      : 'archivo';

    if (!fileName || fileName.trim() === '') {
      throw new Error('El archivo debe tener un nombre válido');
    }

    // Resolver el parentId desde el path relativo (si se especifica)
    let parentId: string = appRootId;
    
    const normalizedPath = normalizePath(params.path);
    if (normalizedPath.length > 0) {
      parentId = await ensurePathRelative(
        this.http,
        appRootId,
        normalizedPath,
        this.userId
      );
    }

    // Paso 1: Presign
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

    // Paso 2: Upload al storage
    const uploadUrl = presignResponse.uploadUrl;
    const method = presignResponse.method || 'PUT';
    const headers = presignResponse.headers || {};

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
          name: fileName,
          parentId,
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
      fileName,
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

      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.send(fileBlob);
    });
  }
}
