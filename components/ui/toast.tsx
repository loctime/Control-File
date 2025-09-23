'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores/ui';
import { ToastMessage } from '@/types';

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

export function Toast({ id, type, title, message, duration = 5000 }: ToastMessage) {
  const { removeToast } = useUIStore();
  const Icon = toastIcons[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, removeToast]);

  return (
    <div
      className={cn(
        'relative flex w-full items-center space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all',
        'animate-in slide-in-from-right-full',
        toastColors[type]
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="grid gap-1">
        <div className="text-sm font-semibold">{title}</div>
        {message && <div className="text-sm opacity-90">{message}</div>}
      </div>
      <button
        className="absolute right-2 top-2 rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10"
        onClick={() => removeToast(id)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
