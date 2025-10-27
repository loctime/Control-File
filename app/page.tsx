'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FileExplorer } from '@/components/drive/FileExplorer';
import { useUIStore } from '@/lib/stores/ui';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { EmergencyExit } from '@/components/ui/EmergencyExit';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { addToast } = useUIStore();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
    // Remover la redirección automática a /[username] para evitar bucle
    // El usuario puede navegar manualmente a su perfil si lo desea
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }


  return (
    <ErrorBoundary>
      <div className="relative">
        <FileExplorer />
        <EmergencyExit />
      </div>
    </ErrorBoundary>
  );
}