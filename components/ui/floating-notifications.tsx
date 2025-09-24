'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/lib/stores/ui';
import { ImpactAnimation } from './impact-animation';
import { cn } from '@/lib/utils';

export function FloatingNotifications() {
  const { toasts } = useUIStore();
  const [visibleToasts, setVisibleToasts] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Mostrar toasts de subida con animación flotante
    const uploadToasts = toasts.filter(toast => 
      (toast.type === 'success' || toast.type === 'error') && 
      toast.title.includes('Archivo')
    );

    uploadToasts.forEach(toast => {
      if (!visibleToasts.has(toast.id)) {
        setVisibleToasts(prev => new Set(prev).add(toast.id));
        
        // Remover después de 3 segundos
        setTimeout(() => {
          setVisibleToasts(prev => {
            const newSet = new Set(prev);
            newSet.delete(toast.id);
            return newSet;
          });
        }, 3000);
      }
    });
  }, [toasts, visibleToasts]);

  if (visibleToasts.size === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[70] space-y-2 pointer-events-none">
      {toasts
        .filter(toast => visibleToasts.has(toast.id))
        .map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'relative flex items-center space-x-3 p-3 rounded-lg shadow-lg border backdrop-blur-sm',
              'animate-in slide-in-from-right-full duration-300',
              toast.type === 'success' 
                ? 'bg-green-50/90 border-green-200 text-green-800 dark:bg-green-900/50 dark:border-green-800 dark:text-green-200'
                : 'bg-red-50/90 border-red-200 text-red-800 dark:bg-red-900/50 dark:border-red-800 dark:text-red-200'
            )}
          >
            {/* Animación de impacto */}
            <ImpactAnimation 
              type={toast.type} 
              className="scale-75"
            />
            
            {/* Contenido */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {toast.title}
              </div>
              {toast.message && (
                <div className="text-xs opacity-80 truncate">
                  {toast.message}
                </div>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
