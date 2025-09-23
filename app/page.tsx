'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FileExplorer } from '@/components/drive/FileExplorer';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
      userId: user?.uid 
    });
    
    if (!loading && !user) {
      console.log('🔄 Redirecting to auth page - usuario no autenticado');
      router.push('/auth');
    } else if (!loading && user) {
      console.log('✅ Usuario autenticado, mostrando FileExplorer');
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

  console.log('📁 HomePage: Renderizando FileExplorer');
  return <FileExplorer />;
}