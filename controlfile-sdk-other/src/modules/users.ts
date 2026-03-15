import { NotFoundError } from '../errors.js';
import type {
  InitializeUserResponse,
  SuccessResponse,
  TaskbarItem,
  UpdateTaskbarResponse,
  UpdateUserProfileInput,
  UpdateUserProfileResponse,
  UpdateUserSettingsInput,
  UserProfileResponse,
  UserSettingsResponse,
} from '../types.js';
import { HttpClient } from '../utils/http.js';

const USERS_BASE_PATH = '/api/users';

export class UsersModule {
  constructor(private http: HttpClient) {}

  async getProfile(): Promise<UserProfileResponse> {
    return this.http.call<UserProfileResponse>(`${USERS_BASE_PATH}/profile`, { method: 'GET' });
  }

  async updateProfile(body: UpdateUserProfileInput): Promise<UpdateUserProfileResponse> {
    return this.http.call<UpdateUserProfileResponse>(`${USERS_BASE_PATH}/profile`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async initialize(): Promise<InitializeUserResponse> {
    return this.http.call<InitializeUserResponse>(`${USERS_BASE_PATH}/initialize`, {
      method: 'POST',
    });
  }

  async getSettings(): Promise<UserSettingsResponse> {
    return this.callUsersRoute<UserSettingsResponse>('/settings', { method: 'GET' }, '/api/user/settings');
  }

  async updateSettings(input: UpdateUserSettingsInput): Promise<SuccessResponse> {
    return this.callUsersRoute<SuccessResponse>(
      '/settings',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      '/api/user/settings'
    );
  }

  async getTaskbar(): Promise<{ items: TaskbarItem[] }> {
    return this.callUsersRoute<{ items: TaskbarItem[] }>('/taskbar', { method: 'GET' }, '/api/user/taskbar');
  }

  async updateTaskbar(items: TaskbarItem[]): Promise<UpdateTaskbarResponse> {
    return this.callUsersRoute<UpdateTaskbarResponse>(
      '/taskbar',
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
      '/api/user/taskbar'
    );
  }

  private async callUsersRoute<T>(
    path: string,
    init: RequestInit,
    legacyPath?: string
  ): Promise<T> {
    try {
      return await this.http.call<T>(`${USERS_BASE_PATH}${path}`, init);
    } catch (error) {
      if (legacyPath && error instanceof NotFoundError) {
        return this.http.call<T>(legacyPath, init);
      }

      throw error;
    }
  }
}
