export type GetToken = () => Promise<string>;

export class ControlFileClient {
  private baseUrl: string;
  private getToken: GetToken;

  constructor(baseUrl: string, getToken: GetToken) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getToken = getToken;
  }

  private async call(path: string, init: RequestInit = {}) {
    const token = await this.getToken();
    const headers = new Headers(init.headers || {});
    headers.set('x-request-id', typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    headers.set('x-sdk-version', 'controlfile-web-1.1.0');
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      let err: unknown;
      try { err = await res.json(); } catch { err = { error: res.statusText }; }
      throw err;
    }
    return res.json();
  }

  async list(params: { parentId?: string | null; pageSize?: number; cursor?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.parentId !== undefined) qs.set('parentId', String(params.parentId));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.cursor) qs.set('cursor', params.cursor);
    return this.call(`/v1/files?${qs.toString()}`);
  }

  async presignUpload(body: { name: string; size: number; mime: string; parentId?: string | null }) {
    return this.call('/v1/uploads/presign', { method: 'POST', body: JSON.stringify(body) });
  }

  async confirm(body: { uploadSessionId: string; parts?: Array<{ PartNumber: number; ETag: string }>; etag?: string }) {
    return this.call('/v1/uploads/confirm', { method: 'POST', body: JSON.stringify(body) });
  }

  async presignGet(fileId: string) {
    return this.call('/v1/files/presign-get', { method: 'POST', body: JSON.stringify({ fileId }) });
  }

  async delete(fileId: string) {
    return this.call('/v1/files/delete', { method: 'POST', body: JSON.stringify({ fileId }) });
  }

  async permanentDelete(fileId: string) {
    return this.call('/v1/files/permanent-delete', { method: 'POST', body: JSON.stringify({ fileId }) });
  }

  async emptyTrash(fileIds: string[]) {
    return this.call('/v1/files/empty-trash', { method: 'POST', body: JSON.stringify({ fileIds }) });
  }

  async rename(fileId: string, newName: string) {
    return this.call('/v1/files/rename', { method: 'POST', body: JSON.stringify({ fileId, newName }) });
  }

  async zip(fileIds: string[], zipName?: string) {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/v1/files/zip`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileIds, zipName }),
    });
    if (!res.ok) {
      let err: unknown;
      try { err = await res.json(); } catch { err = { error: res.statusText }; }
      throw err;
    }
    return res.blob();
  }

  async createShare(fileId: string, expiresIn = 24) {
    return this.call('/v1/shares/create', { method: 'POST', body: JSON.stringify({ fileId, expiresIn }) });
  }

  async revokeShare(shareToken: string) {
    return this.call('/v1/shares/revoke', { method: 'POST', body: JSON.stringify({ shareToken }) });
  }

  async deleteFolderPermanently(folderId: string) {
    return this.call('/v1/folders/permanent-delete', { method: 'POST', body: JSON.stringify({ folderId }) });
  }

  async getProfile() {
    return this.call('/v1/users/profile', { method: 'GET' });
  }

  async updateProfile(body: {
    displayName?: string;
    username?: string;
    bio?: string;
    website?: string;
    location?: string;
    isPublic?: boolean;
  }) {
    return this.call('/v1/users/profile', { method: 'PUT', body: JSON.stringify(body) });
  }

  async getUserSettings() {
    return this.call('/v1/users/settings', { method: 'GET' });
  }

  async saveUserSettings(billingInterval: 'monthly' | 'yearly') {
    return this.call('/v1/users/settings', {
      method: 'POST',
      body: JSON.stringify({ billingInterval }),
    });
  }

  async getTaskbar() {
    return this.call('/v1/users/taskbar', { method: 'GET' });
  }

  async saveTaskbar(items: Array<Record<string, unknown>>) {
    return this.call('/v1/users/taskbar', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async listPlatformAccounts(params: { status?: string; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.limit) qs.set('limit', String(params.limit));
    return this.call(`/v1/platform/accounts${qs.toString() ? `?${qs.toString()}` : ''}`, { method: 'GET' });
  }

  async listPlatformPlans() {
    return this.call('/v1/platform/plans', { method: 'GET' });
  }

  async listPlatformPayments(params: { uid?: string; status?: string; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.uid) qs.set('uid', params.uid);
    if (params.status) qs.set('status', params.status);
    if (params.limit) qs.set('limit', String(params.limit));
    return this.call(`/v1/platform/payments${qs.toString() ? `?${qs.toString()}` : ''}`, { method: 'GET' });
  }

  async createCheckout(planId: string, interval: 'monthly' | 'yearly') {
    return this.call('/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId, interval }),
    });
  }

  async updateUserPlan(planId: string, interval: 'monthly' | 'yearly') {
    return this.call('/v1/users/plan', {
      method: 'POST',
      body: JSON.stringify({ planId, interval }),
    });
  }

  async replace(fileId: string, file: Blob) {
    const token = await this.getToken();
    const form = new FormData();
    form.set('fileId', fileId);
    form.set('file', file);
    const res = await fetch(`${this.baseUrl}/v1/files/replace`, { method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      let err: unknown;
      try { err = await res.json(); } catch { err = { error: res.statusText }; }
      throw err;
    }
    return res.json();
  }
}
