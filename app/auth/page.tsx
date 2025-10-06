'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Chrome } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/lib/stores/ui';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const { addToast } = useUIStore();


  // Efecto para redirigir cuando el usuario se autentique
  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmail(email, password);
        addToast({
          type: 'success',
          title: 'Inicio de sesión exitoso',
          message: 'Bienvenido de vuelta',
        });
      } else {
        await signUpWithEmail(email, password);
        addToast({
          type: 'success',
          title: 'Cuenta creada',
          message: 'Tu cuenta ha sido creada exitosamente',
        });
      }
      
      router.push('/');
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('🚀 handleGoogleSignIn iniciado');
    console.log('🔍 Estado antes de iniciar:', { 
      loading, 
      hasSignInWithGoogle: !!signInWithGoogle,
      isOnline: navigator.onLine,
      currentUrl: window.location.href
    });
    
    if (!navigator.onLine) {
      console.error('❌ Sin conexión a internet');
      addToast({
        type: 'error',
        title: 'Error de conexión',
        message: 'No hay conexión a internet. Verifica tu conexión e intenta nuevamente.',
      });
      return;
    }
    
    setLoading(true);
    try {
      console.log('📞 Llamando a signInWithGoogle (popup)...');
      await signInWithGoogle();
      console.log('✅ signInWithGoogle completado exitosamente');
      
      // No redirigir inmediatamente, dejar que onAuthStateChanged maneje la redirección
      console.log('🔄 Esperando que onAuthStateChanged maneje la autenticación...');
      
      // Mostrar toast de éxito
      addToast({
        type: 'success',
        title: 'Inicio de sesión exitoso',
        message: 'Bienvenido con Google',
      });
    } catch (error: any) {
      console.error('❌ Error en handleGoogleSignIn:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      let errorMessage = error.message;
      
      // Manejar errores específicos de popup
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Ventana de Google cerrada. Intenta nuevamente.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'El popup fue bloqueado. Permite popups para este sitio e intenta nuevamente.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'Dominio no autorizado. Contacta al administrador.';
      }
      
      addToast({
        type: 'error',
        title: 'Error de autenticación',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Mini OneDrive</h1>
            <p className="text-muted-foreground">
              {isLogin ? 'Inicia sesión en tu cuenta' : 'Crea una nueva cuenta'}
            </p>
          </div>

          {/* Google Sign In */}
          <Button
            variant="outline"
            className="w-full mb-6"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <Chrome className="mr-2 h-4 w-4" />
            Continuar con Google
          </Button>

          {/* Botón de debug temporal */}
          <Button
            variant="outline"
            className="w-full mb-4 bg-yellow-500 text-black"
            onClick={() => {
              console.log('🧪 Botón de debug clickeado');
              console.log('🔍 Estado actual:', {
                user: !!user,
                loading,
                isOnline: navigator.onLine,
                currentUrl: window.location.href,
                timestamp: new Date().toISOString()
              });
              alert(`Estado de autenticación:\nUsuario: ${!!user}\nLoading: ${loading}\nOnline: ${navigator.onLine}`);
            }}
          >
            🧪 Debug Estado
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                O continúa con email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Cargando...' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
            </Button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? 'Crear cuenta' : 'Iniciar sesión'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
