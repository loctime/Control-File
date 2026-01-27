/**
 * Módulo de carpetas
 * 
 * ⚠️ LEGACY: Este módulo expone APIs legacy que violan el contrato App ↔ ControlFile v1.
 * 
 * Las aplicaciones externas NO deben usar este módulo directamente.
 * En su lugar, deben usar `client.forApp(appId, userId)` que devuelve un módulo contractual.
 * 
 * Este módulo se mantiene por compatibilidad hacia atrás y será deprecado en el futuro.
 * 
 * @deprecated Usar `client.forApp(appId, userId).ensurePath()` en su lugar
 * @see CONTRACT-folders.md para más detalles sobre el contrato
 */

import { HttpClient } from '../../utils/http';
import { ensurePath as ensurePathFn } from './ensurePath';
import type { EnsurePathParams } from '../../types';

export class FoldersModule {
  constructor(private http: HttpClient) {}

  /**
   * Asegura que una ruta de carpetas exista, creándola si es necesario
   * Función idempotente: si la ruta ya existe, la reutiliza
   * 
   * ⚠️ LEGACY: Este método permite crear carpetas raíz (parentId = null),
   * lo cual viola el contrato App ↔ ControlFile v1.
   * 
   * Las apps deben usar `client.forApp(appId, userId).ensurePath()` en su lugar,
   * que resuelve paths relativos al app root y no permite crear carpetas raíz.
   * 
   * @deprecated Usar `client.forApp(appId, userId).ensurePath()` en su lugar
   */
  async ensurePath(params: EnsurePathParams): Promise<string> {
    return ensurePathFn(this.http, params);
  }
}
