// examples/taskbar-folder-usage.tsx
// Ejemplos prácticos de uso del helper ensureTaskbarAppFolder

'use client';

import { useEffect, useState } from 'react';
import { ensureTaskbarAppFolder } from '@/lib/utils/taskbar-folder';
import { useAuth } from '@/hooks/useAuth';

/**
 * Ejemplo 1: Uso básico en componente
 */
export function ControlAuditInitializer() {
  const { user } = useAuth();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) return;

    const initializeFolder = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // ✅ Asegurar carpeta en taskbar (idempotente)
        const id = await ensureTaskbarAppFolder({
          appId: "controlaudit",
          appName: "ControlAudit",
          userId: user.uid,
          icon: "ClipboardList",
          color: "text-blue-600"
        });
        
        setFolderId(id);
        console.log('✅ Carpeta ControlAudit asegurada:', id);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error desconocido');
        setError(error);
        console.error('❌ Error asegurando carpeta:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeFolder();
  }, [user]);

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!folderId) return null;

  return <div>Carpeta ID: {folderId}</div>;
}

/**
 * Ejemplo 2: Hook personalizado reutilizable
 */
export function useAppTaskbarFolder(
  appId: string,
  appName: string,
  icon: string = "Folder",
  color: string = "text-blue-600"
) {
  const { user } = useAuth();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const ensureFolder = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const id = await ensureTaskbarAppFolder({
          appId,
          appName,
          userId: user.uid,
          icon,
          color,
        });
        
        setFolderId(id);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Error desconocido'));
      } finally {
        setIsLoading(false);
      }
    };

    ensureFolder();
  }, [user, appId, appName, icon, color]);

  return { folderId, isLoading, error };
}

/**
 * Ejemplo 3: Uso del hook personalizado
 */
export function ControlDocComponent() {
  const { folderId, isLoading, error } = useAppTaskbarFolder(
    "controldoc",
    "ControlDoc",
    "FileText",
    "text-purple-600"
  );

  if (isLoading) return <div>Cargando ControlDoc...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!folderId) return null;

  return (
    <div>
      <h2>ControlDoc</h2>
      <p>Carpeta ID: {folderId}</p>
    </div>
  );
}

/**
 * Ejemplo 4: Inicialización múltiple de apps
 */
export function MultiAppInitializer() {
  const { user } = useAuth();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!user) return;

    const initializeAllApps = async () => {
      try {
        // ✅ Inicializar todas las apps en paralelo (idempotente)
        await Promise.all([
          ensureTaskbarAppFolder({
            appId: "controlaudit",
            appName: "ControlAudit",
            userId: user.uid,
            icon: "ClipboardList",
            color: "text-blue-600"
          }),
          ensureTaskbarAppFolder({
            appId: "controldoc",
            appName: "ControlDoc",
            userId: user.uid,
            icon: "FileText",
            color: "text-purple-600"
          }),
          ensureTaskbarAppFolder({
            appId: "controlgastos",
            appName: "ControlGastos",
            userId: user.uid,
            icon: "DollarSign",
            color: "text-green-600"
          }),
        ]);
        
        setInitialized(true);
        console.log('✅ Todas las apps inicializadas');
      } catch (error) {
        console.error('❌ Error inicializando apps:', error);
      }
    };

    initializeAllApps();
  }, [user]);

  return initialized ? <div>Apps inicializadas</div> : <div>Inicializando...</div>;
}

/**
 * Ejemplo 5: Uso con manejo de errores robusto
 */
export function RobustInitializer() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const initializeApp = async () => {
    if (!user) {
      setStatus('error');
      setMessage('Usuario no autenticado');
      return;
    }

    try {
      setStatus('loading');
      setMessage('Inicializando...');

      const folderId = await ensureTaskbarAppFolder({
        appId: "controlaudit",
        appName: "ControlAudit",
        userId: user.uid,
        icon: "ClipboardList",
        color: "text-blue-600"
      });

      setStatus('success');
      setMessage(`Carpeta creada: ${folderId}`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Error desconocido');
    }
  };

  return (
    <div>
      <button onClick={initializeApp} disabled={status === 'loading'}>
        Inicializar App
      </button>
      {status === 'loading' && <div>Cargando...</div>}
      {status === 'success' && <div className="text-green-600">{message}</div>}
      {status === 'error' && <div className="text-red-600">{message}</div>}
    </div>
  );
}

