// hooks/useConnectionStatus.ts
import { useState, useEffect } from 'react';

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [lastOnline, setLastOnline] = useState<Date | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnline(new Date());
      setConnectionAttempts(0);
      console.log('🌐 Conexión a internet restaurada');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📡 Sin conexión a internet');
    };

    // Verificar estado inicial
    const checkInitialStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) {
        setLastOnline(new Date());
      }
    };

    checkInitialStatus();

    // Escuchar cambios de conectividad
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar conectividad periódicamente
    const interval = setInterval(() => {
      if (!navigator.onLine && isOnline) {
        setIsOnline(false);
        console.log('📡 Conexión perdida detectada');
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline]);

  const testConnection = async (): Promise<boolean> => {
    try {
      setConnectionAttempts(prev => prev + 1);
      
      // Intentar hacer una petición simple
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        setIsOnline(true);
        setLastOnline(new Date());
        setConnectionAttempts(0);
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('❌ Error al verificar conectividad:', error);
      return false;
    }
  };

  const getConnectionStatus = () => {
    if (isOnline) {
      return {
        status: 'online' as const,
        message: 'Conectado',
        icon: '🌐'
      };
    }

    if (connectionAttempts > 0) {
      return {
        status: 'retrying' as const,
        message: `Reintentando conexión (${connectionAttempts})`,
        icon: '🔄'
      };
    }

    return {
      status: 'offline' as const,
      message: 'Sin conexión',
      icon: '📡'
    };
  };

  return {
    isOnline,
    lastOnline,
    connectionAttempts,
    testConnection,
    getConnectionStatus
  };
}
