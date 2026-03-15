/**
 * Modulo de shares (enlaces publicos)
 */

import type { ShareCreateApiResponse, ShareInfoApiResponse } from '../internal/api-types.js';
import { buildImageUrl, buildShareUrl } from '../helpers/url-builder.js';
import type {
  CreateShareParams,
  CreateShareResponse,
  Share,
  ShareDownloadResponse,
  ShareInfo,
} from '../types.js';
import { HttpClient } from '../utils/http.js';
import { validateExpiresIn, validateFileId, validateToken } from '../utils/validation.js';

export class SharesModule {
  private baseUrl: string;

  constructor(
    private http: HttpClient,
    baseUrl: string
  ) {
    this.baseUrl = baseUrl;
  }

  async create(params: CreateShareParams): Promise<CreateShareResponse> {
    validateFileId(params.fileId);
    validateExpiresIn(params.expiresIn);

    const expiresIn = params.expiresIn ?? 24;
    const response = await this.http.call<ShareCreateApiResponse>('/api/shares/create', {
      method: 'POST',
      body: JSON.stringify({
        fileId: params.fileId,
        expiresIn,
      }),
    });

    return {
      shareToken: response.shareToken,
      shareUrl: response.shareUrl || buildShareUrl(response.shareToken, this.baseUrl),
      expiresAt: new Date(response.expiresAt),
      fileName: response.fileName,
    };
  }

  async getInfo(token: string): Promise<ShareInfo> {
    validateToken(token);

    const response = await this.http.call<ShareInfoApiResponse>(
      `/api/shares/${token}`,
      { method: 'GET' },
      false
    );

    return {
      fileName: response.fileName,
      fileSize: response.fileSize,
      mime: response.mime,
      expiresAt: response.expiresAt ? new Date(response.expiresAt) : null,
      downloadCount: response.downloadCount,
    };
  }

  async get(token: string): Promise<ShareInfo> {
    return this.getInfo(token);
  }

  async getDownloadUrl(token: string): Promise<ShareDownloadResponse> {
    validateToken(token);

    return this.http.call<ShareDownloadResponse>(
      `/api/shares/${token}/download`,
      { method: 'POST' },
      false
    );
  }

  async download(token: string): Promise<ShareDownloadResponse> {
    return this.getDownloadUrl(token);
  }

  getImageUrl(token: string, baseUrl?: string): string {
    validateToken(token);
    return buildImageUrl(token, baseUrl || this.baseUrl);
  }

  async revoke(token: string): Promise<void> {
    validateToken(token);

    await this.http.call('/api/shares/revoke', {
      method: 'POST',
      body: JSON.stringify({ shareToken: token }),
    });
  }

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
    }>('/api/shares/', { method: 'GET' });

    return response.shares.map((share) => ({
      token: share.token,
      fileId: '',
      fileName: share.fileName,
      fileSize: share.fileSize,
      mime: '',
      expiresAt: share.expiresAt ? new Date(share.expiresAt) : null,
      createdAt: new Date(share.createdAt),
      downloadCount: share.downloadCount,
      shareUrl: share.shareUrl || buildShareUrl(share.token, this.baseUrl),
    }));
  }

  buildShareUrl(token: string): string {
    validateToken(token);
    return buildShareUrl(token, this.baseUrl);
  }

  buildImageUrl(token: string): string {
    validateToken(token);
    return buildImageUrl(token, this.baseUrl);
  }
}
