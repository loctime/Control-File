/**
 * Módulo de cuentas
 */

import { HttpClient } from '../utils/http';
import type { Account } from '../types';

export class AccountsModule {
  constructor(private http: HttpClient) {}

  /**
   * Asegura que exista la cuenta global del usuario autenticado
   * Si no existe, el backend la crea con plan FREE
   * Devuelve el objeto Account
   */
  async ensure(): Promise<Account> {
    const response = await this.http.call<Account>(
      '/api/accounts/ensure',
      {
        method: 'POST',
      }
    );

    return response;
  }

  /**
   * Obtiene el estado global de la cuenta del usuario autenticado
   * No modifica nada, solo lectura
   */
  async get(): Promise<Account> {
    const response = await this.http.call<Account>(
      '/api/accounts/me',
      {
        method: 'GET',
      }
    );

    return response;
  }
}