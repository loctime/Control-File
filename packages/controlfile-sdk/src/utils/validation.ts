/**
 * Validaciones de parámetros de entrada
 * No expuestas públicamente
 */

import { ValidationError } from '../errors';

export function validateFileId(fileId: string): void {
  if (!fileId || typeof fileId !== 'string' || fileId.trim().length === 0) {
    throw new ValidationError('fileId es requerido y debe ser una cadena no vacía');
  }
}

export function validateToken(token: string): void {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new ValidationError('token es requerido y debe ser una cadena no vacía');
  }
}

export function validateFileName(name: string): void {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('name es requerido y debe ser una cadena no vacía');
  }
}

export function validatePageSize(pageSize?: number): void {
  if (pageSize !== undefined) {
    if (typeof pageSize !== 'number' || pageSize < 1 || pageSize > 200) {
      throw new ValidationError('pageSize debe ser un número entre 1 y 200');
    }
  }
}

export function validateExpiresIn(expiresIn?: number): void {
  if (expiresIn !== undefined) {
    if (typeof expiresIn !== 'number' || expiresIn < 1) {
      throw new ValidationError('expiresIn debe ser un número mayor a 0');
    }
  }
}

export function validateFile(file: globalThis.File | Blob): void {
  if (!file) {
    throw new ValidationError('file es requerido');
  }
  if (!(file instanceof globalThis.File) && !(file instanceof Blob)) {
    throw new ValidationError('file debe ser una instancia de File o Blob');
  }
}
