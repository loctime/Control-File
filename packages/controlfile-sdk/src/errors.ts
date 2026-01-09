/**
 * Errores tipados del SDK
 */

export class ControlFileError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, ControlFileError.prototype);
  }
}

export class AuthenticationError extends ControlFileError {
  constructor(message: string = 'No autorizado', originalError?: unknown) {
    super(message, 'AUTH_ERROR', 401, originalError);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class NotFoundError extends ControlFileError {
  constructor(message: string = 'Recurso no encontrado', originalError?: unknown) {
    super(message, 'NOT_FOUND', 404, originalError);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ForbiddenError extends ControlFileError {
  constructor(message: string = 'Acceso denegado', originalError?: unknown) {
    super(message, 'FORBIDDEN', 403, originalError);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class QuotaExceededError extends ControlFileError {
  constructor(
    message: string = 'Cuota de almacenamiento excedida',
    public usedBytes?: number,
    public pendingBytes?: number,
    public planQuotaBytes?: number,
    public requiredBytes?: number,
    originalError?: unknown
  ) {
    super(message, 'QUOTA_EXCEEDED', 413, originalError);
    Object.setPrototypeOf(this, QuotaExceededError.prototype);
  }
}

export class ValidationError extends ControlFileError {
  constructor(message: string = 'Parámetros inválidos', originalError?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, originalError);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NetworkError extends ControlFileError {
  constructor(message: string = 'Error de red', originalError?: unknown) {
    super(message, 'NETWORK_ERROR', undefined, originalError);
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class ServerError extends ControlFileError {
  constructor(message: string = 'Error interno del servidor', originalError?: unknown) {
    super(message, 'SERVER_ERROR', 500, originalError);
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}
