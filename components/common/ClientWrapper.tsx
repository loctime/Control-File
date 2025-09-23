'use client';

// components/common/ClientWrapper.tsx
import { ReactNode } from 'react';

interface ClientWrapperProps {
  children: ReactNode;
}

export function ClientWrapper({ children }: ClientWrapperProps) {
  return <>{children}</>;
}
