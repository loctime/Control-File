import { HttpClient } from '../utils/http';

export interface UserSettingsResponse {
  billingInterval: 'monthly' | 'yearly' | null;
}

export interface UpdateUserSettingsInput {
  billingInterval: 'monthly' | 'yearly';
}

export interface TaskbarItem {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type?: 'folder' | 'app';
  isCustom?: boolean;
  folderId?: string;
}

export interface UserPlanUpdateInput {
  planId: string;
  interval?: 'monthly' | 'yearly';
}

export class UsersModule {
  constructor(private http: HttpClient) {}

  async getProfile() {
    return this.http.call('/v1/users/profile', { method: 'GET' });
  }

  async updateProfile(body: Record<string, unknown>) {
    return this.http.call('/v1/users/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async initialize() {
    return this.http.call('/v1/users/initialize', { method: 'POST' });
  }

  async getSettings(): Promise<UserSettingsResponse> {
    return this.http.call<UserSettingsResponse>('/v1/users/settings', { method: 'GET' });
  }

  async updateSettings(input: UpdateUserSettingsInput) {
    return this.http.call('/v1/users/settings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getTaskbar(): Promise<{ items: TaskbarItem[] }> {
    return this.http.call<{ items: TaskbarItem[] }>('/v1/users/taskbar', { method: 'GET' });
  }

  async updateTaskbar(items: TaskbarItem[]) {
    return this.http.call('/v1/users/taskbar', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async updatePlan(input: UserPlanUpdateInput) {
    return this.http.call('/v1/users/plan', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
}
