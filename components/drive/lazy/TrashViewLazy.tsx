// components/drive/lazy/TrashViewLazy.tsx
'use client';

import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load de la vista de papelera
const TrashView = lazy(() => import('../TrashView').then(module => ({ default: module.TrashView })));

interface TrashViewLazyProps {
  onOpenItem: (itemId: string) => void;
  onDownloadFile: (itemId: string) => void;
  onShareItem: (itemId: string) => void;
  onRenameItem: (itemId: string) => void;
  onCopyItem: (itemId: string) => void;
  onCutItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onShowProperties: (itemId: string) => void;
  onCreateFolder: () => void;
  onPasteItems: () => void;
  onSelectAll: () => void;
}

export function TrashViewLazy(props: TrashViewLazyProps) {
  return (
    <Suspense fallback={
      <div className="flex-1 p-4">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border">
                <Skeleton className="h-16 w-16 mx-auto mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <TrashView {...props} />
    </Suspense>
  );
}
