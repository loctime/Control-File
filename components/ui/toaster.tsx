'use client';

import { useUIStore } from '@/lib/stores/ui';
import { Toast } from '@/components/ui/toast';

export function Toaster() {
  const { toasts } = useUIStore();

  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}
