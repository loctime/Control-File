// components/ui/EmergencyExit.tsx
'use client';

import { Button } from './button';
import { Home, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function EmergencyExit() {
  const router = useRouter();

  const handleGoHome = () => {
    // Limpiar cualquier estado problemático
    if (typeof window !== 'undefined') {
      // Limpiar localStorage si es necesario
      localStorage.removeItem('currentFolderId');
      localStorage.removeItem('mainFolderId');
      
      // Navegar a la página principal
      window.location.href = '/';
    }
  };

  const handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex flex-col space-y-2">
        <Button
          onClick={handleGoHome}
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white shadow-lg"
          title="Salir de cualquier situación problemática"
        >
          <Home className="h-4 w-4 mr-1" />
          Inicio
        </Button>
        
        <Button
          onClick={handleRefresh}
          size="sm"
          variant="outline"
          className="bg-white hover:bg-gray-50 shadow-lg"
          title="Recargar página"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Recargar
        </Button>
      </div>
    </div>
  );
}
