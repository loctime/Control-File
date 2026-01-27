/**
 * Cliente HTTP interno del SDK
 * No expuesto públicamente
 */

import { ControlFileError, AuthenticationError, NotFoundError, ForbiddenError, QuotaExceededError, ValidationError, NetworkError, ServerError } from '../errors';

export interface HttpClientConfig {
  baseUrl: string;
  getAuthToken: () => Promise<string>;
  timeout?: number;
  retries?: number;
}

export class HttpClient {
  private baseUrl: string;
  private getAuthToken: () => Promise<string>;
  private timeout: number;
  private retries: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getAuthToken = config.getAuthToken;
    this.timeout = config.timeout ?? 30000;
    this.retries = config.retries ?? 3;
  }

  /**
   * Realiza una llamada HTTP autenticada
   */
  async call<T>(
    path: string,
    init: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<T> {
    const headers = new Headers(init.headers || {});

    if (requireAuth) {
      try {
        const token = await this.getAuthToken();
        headers.set('Authorization', `Bearer ${token}`);
      } catch (error) {
        throw new AuthenticationError('Error al obtener token de autenticación', error);
      }
    }

    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Headers del SDK (internos, no expuestos)
    headers.set('X-SDK-Version', '1.0.0');
    headers.set('X-SDK-Client', '@controlfile/sdk');

    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...init,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw await this.handleErrorResponse(response);
        }

        // Si la respuesta está vacía (status 204, etc.)
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return {} as T;
        }

        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ControlFileError) {
          throw error;
        }

        // Errores de red o timeout - reintentar si quedan intentos
        if (attempt < this.retries && this.isRetryableError(error)) {
          lastError = error as Error;
          await this.delay(1000 * (attempt + 1)); // Backoff exponencial
          continue;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          throw new NetworkError(`Timeout después de ${this.timeout}ms`, error);
        }

        if (error instanceof Error && error.message.includes('fetch')) {
          throw new NetworkError('Error de conexión con el servidor', error);
        }

        throw error;
      }
    }

    throw new NetworkError('Error después de múltiples intentos', lastError || undefined);
  }

  /**
   * Maneja errores de respuesta HTTP y los normaliza
   */
  private async handleErrorResponse(response: Response): Promise<ControlFileError> {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: response.statusText };
    }

    const message = errorData.error || errorData.message || 'Error desconocido';
    const code = errorData.code;

    switch (response.status) {
      case 401:
        return new AuthenticationError(message, errorData);
      case 403:
        return new ForbiddenError(message, errorData);
      case 404:
        return new NotFoundError(message, errorData);
      case 400:
        return new ValidationError(message, errorData);
      case 413:
        return new QuotaExceededError(
          message,
          errorData.usedBytes,
          errorData.pendingBytes,
          errorData.planQuotaBytes,
          errorData.requiredBytes,
          errorData
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServerError(message, errorData);
      default:
        return new ControlFileError(message, code, response.status, errorData);
    }
  }

  /**
   * Determina si un error es recuperable (se puede reintentar)
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof ControlFileError) {
      // Solo errores de red o servidor son recuperables
      return (
        error instanceof NetworkError ||
        error instanceof ServerError ||
        (error.statusCode !== undefined && error.statusCode >= 500)
      );
    }

    if (error instanceof Error) {
      // Errores de fetch (red, timeout, etc.)
      return (
        error.name === 'TypeError' ||
        error.name === 'AbortError' ||
        error.message.includes('fetch') ||
        error.message.includes('network')
      );
    }

    return false;
  }

  /**
   * Delay para reintentos
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
