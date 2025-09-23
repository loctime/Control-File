'use client';

// components/common/ConnectionStatus.tsx
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Verificar estado inicial
    setIsOnline(navigator.onLine);

    // Escuchar cambios de conectividad
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null; // No mostrar nada cuando está online
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <Badge variant="destructive" className="flex items-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span>Sin conexión</span>
      </Badge>
    </div>
  );
}
