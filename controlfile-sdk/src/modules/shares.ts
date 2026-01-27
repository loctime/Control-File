/**
 * Módulo de shares (enlaces públicos)
 */

import { HttpClient } from '../utils/http';
import {
  validateFileId,
  validateToken,
  validateExpiresIn,
} from '../utils/validation';
import { buildShareUrl, buildImageUrl } from '../helpers/url-builder';
import type {
  CreateShareParams,
  CreateShareResponse,
  ShareInfo,
  ShareDownloadResponse,
  Share,
  ShareCreateApiResponse,
  ShareInfoApiResponse,
} from '../types';

export class SharesModule {
  private baseUrl: string;

  constructor(
    private http: HttpClient,
    baseUrl: string
  ) {
    this.baseUrl = baseUrl;
  }

  /**
   * Crea un share link con expiración configurable (requiere auth)
   */
  async create(params: CreateShareParams): Promise<CreateShareResponse> {
    validateFileId(params.fileId);
    validateExpiresIn(params.expiresIn);

    const expiresIn = params.expiresIn ?? 24; // default: 24 horas

    const response = await this.http.call<ShareCreateApiResponse>(
      '/api/shares/create',
      {
        method: 'POST',
        body: JSON.stringify({
          fileId: params.fileId,
          expiresIn,
        }),
      }
    );

    return {
      shareToken: response.shareToken,
      shareUrl: response.shareUrl || buildShareUrl(response.shareToken, this.baseUrl),
      expiresAt: new Date(response.expiresAt),
      fileName: response.fileName,
    };
  }

  /**
   * Obtiene información de un share (público, sin auth)
   */
  async getInfo(token: string): Promise<ShareInfo> {
    validateToken(token);

    const response = await this.http.call<ShareInfoApiResponse>(
      `/api/shares/${token}`,
      {
        method: 'GET',
      },
      false // no requiere auth
    );

    return {
      fileName: response.fileName,
      fileSize: response.fileSize,
      mime: response.mime,
      expiresAt: response.expiresAt ? new Date(response.expiresAt) : null,
      downloadCount: response.downloadCount,
    };
  }

  /**
   * Obtiene URL de descarga desde share token (público, sin auth)
   */
  async getDownloadUrl(token: string): Promise<ShareDownloadResponse> {
    validateToken(token);

    return this.http.call<ShareDownloadResponse>(
      `/api/shares/${token}/download`,
      {
        method: 'POST',
      },
      false // no requiere auth
    );
  }

  /**
   * Genera URL de imagen directa para usar en <img> tags (helper)
   */
  getImageUrl(token: string, baseUrl?: string): string {
    validateToken(token);
    return buildImageUrl(token, baseUrl || this.baseUrl);
  }

  /**
   * Revoca un share link (requiere auth)
   */
  async revoke(token: string): Promise<void> {
    validateToken(token);

    await this.http.call('/api/shares/revoke', {
      method: 'POST',
      body: JSON.stringify({ shareToken: token }),
    });
  }

  /**
   * Lista los shares del usuario autenticado (requiere auth)
   */
  async list(): Promise<Share[]> {
    const response = await this.http.call<{
      shares: Array<{
        token: string;
        fileName: string;
        fileSize: number;
        expiresAt: Date | string | null;
        createdAt: Date | string;
        downloadCount: number;
        shareUrl?: string;
      }>;
    }>('/api/shares/', {
      method: 'GET',
    });

    return response.shares.map((share) => ({
      token: share.token,
      fileId: '', // No viene en la respuesta del listado
      fileName: share.fileName,
      fileSize: share.fileSize,
      mime: '', // No viene en la respuesta del listado
      expiresAt: share.expiresAt ? new Date(share.expiresAt) : null,
      createdAt: new Date(share.createdAt),
      downloadCount: share.downloadCount,
      shareUrl: share.shareUrl || buildShareUrl(share.token, this.baseUrl),
    }));
  }

  /**
   * Construye URL pública de share (helper)
   */
  buildShareUrl(token: string): string {
    validateToken(token);
    return buildShareUrl(token, this.baseUrl);
  }

  /**
   * Construye URL de imagen de share (helper)
   */
  buildImageUrl(token: string): string {
    validateToken(token);
    return buildImageUrl(token, this.baseUrl);
  }
}
