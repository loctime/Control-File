import { ControlFileClient } from '@/controlfile-sdk-other/src';
import type { TaskbarItem, UpdateUserProfileInput } from '@/controlfile-sdk-other/src';

function getBackendBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/$/, '');
  }
  return 'http://localhost:3001';
}

async function getAuthToken(): Promise<string> {
  const { auth } = await import('@/lib/firebase');
  const user = auth?.currentUser;
  if (!user) {
    throw new Error('No hay usuario autenticado');
  }
  return user.getIdToken();
}

type RequestMode = 'json' | 'blob';

class AppControlFileClient {
  public readonly sdk: ControlFileClient;
  public readonly files: ControlFileClient['files'];
  public readonly folders: ControlFileClient['folders'];
  public readonly shares: ControlFileClient['shares'];
  public readonly users: ControlFileClient['users'];

  constructor() {
    this.sdk = new ControlFileClient({
      baseUrl: getBackendBaseUrl(),
      getAuthToken,
    });
    this.files = this.sdk.files;
    this.folders = this.sdk.folders;
    this.shares = this.sdk.shares;
    this.users = this.sdk.users;
  }

  private async request<T>(path: string, init: RequestInit = {}, mode: RequestMode = 'json'): Promise<T> {
    const token = await getAuthToken();
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set(
      'x-request-id',
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    const hasBody = init.body !== undefined && init.body !== null;
    if (hasBody && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }
      throw new Error(errorData?.error || errorData?.message || `Error ${response.status}`);
    }

    if (mode === 'blob') {
      return (await response.blob()) as T;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {} as T;
    }

    return response.json();
  }

  async presignGet(fileId: string) {
    const data = await this.sdk.files.getDownloadUrl(fileId);
    return {
      ...data,
      presignedUrl: data.downloadUrl,
    };
  }

  async createShare(fileId: string, expiresIn = 24) {
    const data = await this.sdk.shares.create({ fileId, expiresIn });
    return {
      ...data,
      shareId: data.shareToken,
    };
  }

  async getTaskbar(): Promise<{ items: TaskbarItem[] }> {
    return this.sdk.users.getTaskbar();
  }

  async saveTaskbar(items: TaskbarItem[] | Array<Record<string, unknown>>) {
    const normalized: TaskbarItem[] = items.map((item) => ({
      id: String(item.id || ''),
      name: String(item.name || ''),
      icon: typeof item.icon === 'string' ? item.icon : undefined,
      color: typeof item.color === 'string' ? item.color : undefined,
      type: item.type === 'app' ? 'app' : 'folder',
      isCustom: typeof item.isCustom === 'boolean' ? item.isCustom : undefined,
      folderId: typeof item.folderId === 'string' ? item.folderId : undefined,
    }));
    return this.sdk.users.updateTaskbar(normalized);
  }

  async getUserSettings() {
    return this.sdk.users.getSettings();
  }

  async saveUserSettings(billingInterval: 'monthly' | 'yearly') {
    return this.sdk.users.updateSettings({ billingInterval });
  }

  async updateProfile(body: UpdateUserProfileInput) {
    return this.sdk.users.updateProfile(body);
  }

  async permanentDelete(fileId: string) {
    return this.sdk.files.permanentDelete(fileId);
  }

  async emptyTrash(fileIds: string[]) {
    return this.sdk.files.emptyTrash(fileIds);
  }

  async deleteFolderPermanently(folderId: string) {
    return this.sdk.folders.permanentDelete(folderId);
  }

  async zip(fileIds: string[], zipName?: string) {
    return this.request<Blob>('/api/files/zip', {
      method: 'POST',
      body: JSON.stringify({ fileIds, zipName }),
    }, 'blob');
  }

  async updateUserPlan(planId: string, interval: 'monthly' | 'yearly') {
    return this.request('/api/user/plan', {
      method: 'POST',
      body: JSON.stringify({ planId, interval }),
    });
  }

  async createCheckout(planId: string, interval: 'monthly' | 'yearly') {
    return this.request<{ url: string }>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId, interval }),
    });
  }

  async listPlatformAccounts(params: { status?: string; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{ accounts?: unknown[] }>(`/api/platform/accounts${suffix}`, { method: 'GET' });
  }

  async listPlatformPlans() {
    return this.request<{ plans?: unknown[] }>('/api/platform/plans', { method: 'GET' });
  }

  async listPlatformPayments(params: { uid?: string; status?: string; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.uid) qs.set('uid', params.uid);
    if (params.status) qs.set('status', params.status);
    if (params.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{ payments?: unknown[] }>(`/api/platform/payments${suffix}`, { method: 'GET' });
  }
}

export function createBrowserControlFileClient(): AppControlFileClient {
  return new AppControlFileClient();
}

export type BrowserControlFileClient = ReturnType<typeof createBrowserControlFileClient>;
