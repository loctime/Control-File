'use client';

import { useEffect, useState, useRef } from 'react';
import { useUIStore } from '@/lib/stores/ui';
import { ImpactAnimation } from './impact-animation';
import { cn } from '@/lib/utils';

interface ToastPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function FloatingNotifications() {
  const { toasts } = useUIStore();
  const [visibleToasts, setVisibleToasts] = useState<Set<string>>(new Set());
  const [toastPositions, setToastPositions] = useState<Map<string, ToastPosition>>(new Map());
  const processedToasts = useRef<Set<string>>(new Set());

  // Función para obtener la posición del archivo en la pantalla
  const getFilePosition = (fileId: string): ToastPosition | null => {
    const fileElement = document.querySelector(`[data-item-id="${fileId}"]`);
    if (!fileElement) return null;

    const rect = fileElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2, // Centro horizontal
      y: rect.top + rect.height / 2, // Centro vertical
      width: rect.width,
      height: rect.height,
    };
  };

  useEffect(() => {
    // Mostrar toasts de subida con animación flotante
    const uploadToasts = toasts.filter(toast => 
      (toast.type === 'success' || toast.type === 'error') && 
      toast.title.includes('Archivo')
    );

    uploadToasts.forEach(toast => {
      if (!processedToasts.current.has(toast.id)) {
        processedToasts.current.add(toast.id);
        
        // Intentar obtener la posición del archivo
        const fileId = toast.fileInfo?.fileId;
        let position: ToastPosition | null = null;
        
        if (fileId) {
          // Esperar un poco para que el archivo aparezca en el DOM
          setTimeout(() => {
            position = getFilePosition(fileId);
            if (position) {
              setToastPositions(prev => new Map(prev).set(toast.id, position!));
            }
          }, 100);
        }
        
        setVisibleToasts(prev => new Set(prev).add(toast.id));
        
        // Remover después de 3 segundos
        setTimeout(() => {
          setVisibleToasts(prev => {
            const newSet = new Set(prev);
            newSet.delete(toast.id);
            return newSet;
          });
          setToastPositions(prev => {
            const newMap = new Map(prev);
            newMap.delete(toast.id);
            return newMap;
          });
          // También remover del ref después de que se oculte
          setTimeout(() => {
            processedToasts.current.delete(toast.id);
          }, 100);
        }, 3000);
      }
    });
  }, [toasts]);

  if (visibleToasts.size === 0) return null;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      {toasts
        .filter(toast => visibleToasts.has(toast.id))
        .map((toast) => {
          const position = toastPositions.get(toast.id);
          const fileId = toast.fileInfo?.fileId;
          
          // Si tenemos la posición del archivo, posicionar encima de él
          if (position && fileId) {
            return (
              <div
                key={toast.id}
                className={cn(
                  'absolute flex items-center justify-center p-4 rounded-xl shadow-2xl border backdrop-blur-md',
                  'animate-in zoom-in-50 duration-500',
                  toast.type === 'success' 
                    ? 'bg-green-50/95 border-green-200 dark:bg-green-900/60 dark:border-green-800'
                    : 'bg-red-50/95 border-red-200 dark:bg-red-900/60 dark:border-red-800'
                )}
                style={{
                  left: `${position.x - 20}px`, // Centrar horizontalmente
                  top: `${position.y - 20}px`,  // Centrar verticalmente
                  transform: 'translate(-50%, -50%)', // Centrar perfectamente
                }}
              >
                <ImpactAnimation 
                  type={toast.type === 'success' ? 'success' : 'error'} 
                  className="scale-75"
                />
              </div>
            );
          }
          
          // Fallback: mostrar en el centro de la pantalla si no se encuentra el archivo
          return (
            <div
              key={toast.id}
              className={cn(
                'absolute top-1/2 left-1/2 flex items-center justify-center p-6 rounded-2xl shadow-2xl border backdrop-blur-md',
                'animate-in zoom-in-50 duration-500',
                'transform -translate-x-1/2 -translate-y-1/2',
                toast.type === 'success' 
                  ? 'bg-green-50/95 border-green-200 dark:bg-green-900/60 dark:border-green-800'
                  : 'bg-red-50/95 border-red-200 dark:bg-red-900/60 dark:border-red-800'
              )}
            >
              <ImpactAnimation 
                type={toast.type === 'success' ? 'success' : 'error'} 
                className="scale-100"
              />
            </div>
          );
        })}
    </div>
  );
}
