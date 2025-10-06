// components/drive/lazy/DetailsPanelLazy.tsx
'use client';

import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load del panel de detalles
const DetailsPanel = lazy(() => import('../DetailsPanel').then(module => ({ default: module.DetailsPanel })));

export function DetailsPanelLazy() {
  return (
    <Suspense fallback={
      <div className="w-80 border-l bg-background p-4">
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    }>
      <DetailsPanel />
    </Suspense>
  );
}
