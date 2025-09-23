'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Chrome } from 'lucide-react';

export default function TestGoogleAuthPage() {
  const [loading, setLoading] = useState(false);
  const { user, signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    console.log('🧪 Test: Iniciando autenticación con Google...');
    setLoading(true);
    
    try {
      await signInWithGoogle();
      console.log('🧪 Test: Autenticación exitosa');
      alert('¡Autenticación exitosa!');
    } catch (error: any) {
      console.error('🧪 Test: Error en autenticación:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">🧪 Prueba de Autenticación Google</h1>
          
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <h2 className="font-semibold mb-2">Estado actual:</h2>
            <p>Usuario: {user ? 'Autenticado' : 'No autenticado'}</p>
            <p>Email: {user?.email || 'N/A'}</p>
            <p>UID: {user?.uid || 'N/A'}</p>
          </div>

          <Button
            variant="outline"
            className="w-full mb-4"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <Chrome className="mr-2 h-4 w-4" />
            {loading ? 'Procesando...' : 'Probar Google Sign In'}
          </Button>

          <div className="text-sm text-gray-600">
            <p>Esta página es para probar la autenticación con Google usando popup.</p>
            <p>Abre la consola del navegador para ver los logs detallados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
