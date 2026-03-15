import { HttpClient } from '../../utils/http.js';
import { AppFilesModule } from './index.js';

export class AppFilesNamespace {
  constructor(private http: HttpClient) {}

  forApp(appId: string, userId?: string): AppFilesModule {
    if (!appId || typeof appId !== 'string' || appId.trim().length === 0) {
      throw new Error('appId es requerido y debe ser una cadena no vacia');
    }

    return new AppFilesModule(this.http, appId, userId || '');
  }
}
