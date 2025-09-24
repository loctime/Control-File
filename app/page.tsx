'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FileExplorer } from '@/components/drive/FileExplorer';
import { useUIStore } from '@/lib/stores/ui';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { addToast } = useUIStore();

  console.log('🏠 HomePage render:', { 
    user: !!user, 
    loading, 
    userId: user?.uid,
    userEmail: user?.email,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    console.log('🔄 HomePage useEffect:', { 
      loading, 
      hasUser: !!user, 
      userId: user?.uid,
      username: user?.username
    });
    
    if (!loading && !user) {
      console.log('🔄 Redirecting to auth page - usuario no autenticado');
      router.push('/auth');
    } else if (!loading && user) {
      // Usar username si existe, o generar uno temporal para compatibilidad
      const username = user.username || (user.email ? user.email.split('@')[0].toLowerCase().replace(/[^\w]/g, '') : 'usuario');
      console.log('✅ Usuario autenticado, redirigiendo a perfil de usuario');
      router.push(`/${username}`);
    }
  }, [user, loading, router]);

  if (loading) {
    console.log('⏳ HomePage: Mostrando loading spinner');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    console.log('🚫 HomePage: No hay usuario, retornando null');
    return null; // Will redirect to auth
  }

  const testSuccessToast = () => {
    addToast({
      type: 'success',
      title: 'Archivo subido',
      message: 'Captura de pantalla 2025-01-15 123456.png se subió correctamente',
      fileInfo: {
        name: 'Captura de pantalla 2025-01-15 123456.png',
        size: 1024000,
        type: 'image/png',
      },
    });
  };

  const testErrorToast = () => {
    // Crear un archivo de prueba
    const testFile = new File(['contenido de prueba'], 'archivo-prueba.txt', { type: 'text/plain' });
    
    addToast({
      type: 'error',
      title: 'Error al subir archivo',
      message: 'Error de conexión al servidor',
      fileInfo: {
        name: 'archivo-prueba.txt',
        size: 1024,
        type: 'text/plain',
        file: testFile,
      },
    });
  };

  console.log('📁 HomePage: Renderizando FileExplorer');
  return (
    <div className="relative">
      {/* Botones de prueba - solo para desarrollo */}
      <div className="fixed top-4 left-4 z-50 flex gap-2">
        <Button onClick={testSuccessToast} size="sm" variant="outline">
          🎉 Probar Éxito
        </Button>
        <Button onClick={testErrorToast} size="sm" variant="outline">
          ❌ Probar Error
        </Button>
      </div>
      
      <FileExplorer />
    </div>
  );
}