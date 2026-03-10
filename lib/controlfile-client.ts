import { ControlFileClient } from '@/lib/controlfile-sdk';

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

export function createBrowserControlFileClient(): ControlFileClient {
  return new ControlFileClient(getBackendBaseUrl(), getAuthToken);
}
