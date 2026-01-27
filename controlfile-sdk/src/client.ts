/**
 * Cliente principal del SDK
 */

import { HttpClient } from './utils/http';
import { FilesModule } from './modules/files';
import { SharesModule } from './modules/shares';
import { AccountsModule } from './modules/accounts';
import { FoldersModule } from './modules/folders';
import { AppFilesModule } from './modules/app-files';
import type {
  ControlFileClientConfig,
  ControlFileClientOptions,
  AppFilesContext,
} from './types';

export class ControlFileClient {
  private http: HttpClient;
  public readonly files: FilesModule;
  public readonly shares: SharesModule;
  public readonly accounts: AccountsModule;
  public readonly folders: FoldersModule;

  constructor(config: ControlFileClientConfig) {
    // Configurar opciones por defecto
    const options: Required<ControlFileClientOptions> = {
      timeout: config.options?.timeout ?? 30000,
      retries: config.options?.retries ?? 3,
    };

    // Crear cliente HTTP interno
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      getAuthToken: config.getAuthToken,
      timeout: options.timeout,
      retries: options.retries,
    });

    // Crear módulos
    this.files = new FilesModule(this.http);
    this.shares = new SharesModule(this.http, config.baseUrl);
    this.accounts = new AccountsModule(this.http);
    this.folders = new FoldersModule(this.http);
  }

  /**
   * Crea un contexto de aplicación para operaciones contractuales
   * 
   * ⚠️ CONTRACTUAL v1: Este método devuelve un módulo que implementa
   * el contrato App ↔ ControlFile v1.
   * 
   * Las apps deben usar este método en lugar de los módulos legacy
   * (files, folders) para operaciones de archivos y carpetas.
   * 
   * @example
   * ```typescript
   * // Con userId explícito (recomendado)
   * const appFiles = client.forApp('controldoc', 'user_123');
   * 
   * // userId opcional (se requerirá en la primera operación)
   * const appFiles2 = client.forApp('controldoc');
   * ```
   * 
   * @param appId ID de la aplicación (ej: 'controldoc', 'controlaudit')
   * @param userId ID del usuario autenticado (opcional, se puede proporcionar después)
   * @returns Módulo de archivos contractual para la aplicación
   * 
   * @see CONTRACT-folders.md para más detalles sobre el contrato
   */
  forApp(appId: string, userId?: string): AppFilesModule {
    if (!appId || typeof appId !== 'string' || appId.trim().length === 0) {
      throw new Error('appId es requerido y debe ser una cadena no vacía');
    }
    
    // userId es opcional, pero se validará cuando se use
    const finalUserId = userId || '';
    
    return new AppFilesModule(this.http, appId, finalUserId);
  }
}
