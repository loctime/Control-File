// components/ui/ErrorBoundary.tsx
'use client';

import React from 'react';
import { Button } from './button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} reset={this.reset} />;
      }

      return <DefaultErrorFallback error={this.state.error!} reset={this.reset} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex items-center justify-center mb-6">
          <AlertTriangle className="h-16 w-16 text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          ¡Ups! Algo salió mal
        </h1>
        
        <p className="text-gray-600 mb-6">
          Ha ocurrido un error inesperado. No te preocupes, puedes volver a intentar.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 mb-2">
              Detalles del error (desarrollo)
            </summary>
            <pre className="text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
        
        <div className="space-y-3">
          <Button 
            onClick={reset}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Intentar de nuevo
          </Button>
          
          <Button 
            onClick={handleGoHome}
            variant="outline"
            className="w-full"
          >
            <Home className="h-4 w-4 mr-2" />
            Volver al inicio
          </Button>
          
          <Button 
            onClick={handleRefresh}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recargar página
          </Button>
        </div>
      </div>
    </div>
  );
}

// Componente específico para errores de carpeta no encontrada
export function FolderNotFoundError({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex items-center justify-center mb-6">
          <AlertTriangle className="h-16 w-16 text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Carpeta no encontrada
        </h1>
        
        <p className="text-gray-600 mb-6">
          La carpeta que estás buscando no existe o no tienes permisos para acceder a ella.
        </p>
        
        <div className="space-y-3">
          <Button 
            onClick={onGoHome}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Home className="h-4 w-4 mr-2" />
            Volver al inicio
          </Button>
          
          <Button 
            onClick={() => window.history.back()}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Página anterior
          </Button>
        </div>
      </div>
    </div>
  );
}
