'use client';

import { useUIStore } from '@/lib/stores/ui';
import { Toast } from '@/components/ui/toast';

export function Toaster() {
  const { toasts } = useUIStore();

  // Filtrar toasts de subida de archivos para evitar duplicación con FloatingNotifications
  const nonUploadToasts = toasts.filter(toast => 
    !((toast.type === 'success' || toast.type === 'error') && 
      toast.title.includes('Archivo'))
  );

  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {nonUploadToasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}
