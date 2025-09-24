'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores/ui';
import { ToastMessage } from '@/types';
import { ImpactAnimation } from './impact-animation';

const toastIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastColors = {
  success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/50 dark:border-green-800 dark:text-green-200',
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/50 dark:border-red-800 dark:text-red-200',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-800 dark:text-yellow-200',
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/50 dark:border-blue-800 dark:text-blue-200',
};

export function Toast({ id, type, title, message, duration = 5000, fileInfo }: ToastMessage) {
  const { removeToast } = useUIStore();
  const [showAnimation, setShowAnimation] = useState(true);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, removeToast]);

  const handleOpenFile = () => {
    if (fileInfo?.file) {
      // Crear URL temporal para el archivo
      const url = URL.createObjectURL(fileInfo.file);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileInfo.name;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const isUploadToast = type === 'success' || type === 'error';
  const showFileInfo = type === 'error' && fileInfo;

  return (
    <div
      className={cn(
        'relative flex w-full items-center space-x-4 overflow-hidden rounded-lg border p-4 shadow-lg transition-all',
        'animate-in slide-in-from-right-full',
        toastColors[type],
        isUploadToast && 'min-h-[80px]'
      )}
    >
      {/* Animación de impacto para toasts de subida */}
      {isUploadToast && showAnimation && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <ImpactAnimation 
            type={type} 
            onComplete={() => {
              setAnimationComplete(true);
              setShowAnimation(false);
            }}
          />
        </div>
      )}

      {/* Contenido principal */}
      <div className={cn(
        'flex-1 transition-all duration-300',
        isUploadToast && !animationComplete && 'ml-20',
        isUploadToast && animationComplete && 'ml-0'
      )}>
        <div className="grid gap-1">
          <div className="text-sm font-semibold">{title}</div>
          {message && <div className="text-sm opacity-90">{message}</div>}
          
          {/* Información del archivo para errores */}
          {showFileInfo && (
            <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
              <div className="text-xs text-red-700 dark:text-red-300">
                <div className="font-medium">Archivo: {fileInfo.name}</div>
                {fileInfo.size && (
                  <div>Tamaño: {(fileInfo.size / 1024 / 1024).toFixed(2)} MB</div>
                )}
                {fileInfo.type && (
                  <div>Tipo: {fileInfo.type}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex items-center gap-2">
        {/* Botón para abrir archivo en caso de error */}
        {showFileInfo && fileInfo.file && (
          <button
            className="rounded-md p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
            onClick={handleOpenFile}
            title="Abrir archivo"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
        
        {/* Botón de cerrar */}
        <button
          className="rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          onClick={() => removeToast(id)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
