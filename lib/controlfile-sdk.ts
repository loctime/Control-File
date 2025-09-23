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
    return this.call(`/api/files/list?${qs.toString()}`);
  }

  async presignUpload(body: { name: string; size: number; mime: string; parentId?: string | null }) {
    return this.call('/api/uploads/presign', { method: 'POST', body: JSON.stringify(body) });
  }

  async confirm(body: { uploadSessionId: string; parts?: Array<{ PartNumber: number; ETag: string }>; etag?: string }) {
    return this.call('/api/uploads/confirm', { method: 'POST', body: JSON.stringify(body) });
  }

  async presignGet(fileId: string) {
    return this.call('/api/files/presign-get', { method: 'POST', body: JSON.stringify({ fileId }) });
  }

  async delete(fileId: string) {
    return this.call('/api/files/delete', { method: 'POST', body: JSON.stringify({ fileId }) });
  }

  async rename(fileId: string, newName: string) {
    return this.call('/api/files/rename', { method: 'POST', body: JSON.stringify({ fileId, newName }) });
  }

  async replace(fileId: string, file: Blob) {
    const token = await this.getToken();
    const form = new FormData();
    form.set('fileId', fileId);
    form.set('file', file);
    const res = await fetch(`${this.baseUrl}/api/files/replace`, { method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      let err: unknown;
      try { err = await res.json(); } catch { err = { error: res.statusText }; }
      throw err;
    }
    return res.json();
  }
}


