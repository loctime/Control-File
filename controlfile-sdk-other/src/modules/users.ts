import { HttpClient } from '../utils/http';
import type {
  TaskbarItem,
  UpdateUserProfileInput,
  UpdateUserSettingsInput,
  UserSettingsResponse,
} from '../types';

export class UsersModule {
  constructor(private http: HttpClient) {}

  async getProfile() {
    return this.http.call('/api/users/profile', { method: 'GET' });
  }

  async updateProfile(body: UpdateUserProfileInput) {
    return this.http.call('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async initialize() {
    return this.http.call('/api/users/initialize', { method: 'POST' });
  }

  async getSettings(): Promise<UserSettingsResponse> {
    return this.http.call<UserSettingsResponse>('/api/user/settings', { method: 'GET' });
  }

  async updateSettings(input: UpdateUserSettingsInput) {
    return this.http.call('/api/user/settings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getTaskbar(): Promise<{ items: TaskbarItem[] }> {
    return this.http.call<{ items: TaskbarItem[] }>('/api/user/taskbar', { method: 'GET' });
  }

  async updateTaskbar(items: TaskbarItem[]) {
    return this.http.call('/api/user/taskbar', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }
}
