// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { ClientWrapper } from '@/components/common/ClientWrapper';
import { ConnectionStatus } from '@/components/common/ConnectionStatus';
import { TrashCleanupInitializer } from '@/components/common/TrashCleanupInitializer';
import { DomainConfigProvider } from '@/components/common/DomainConfigProvider';
import { FloatingNotifications } from '@/components/ui/floating-notifications';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mini OneDrive',
  description: 'Tu almacenamiento en la nube personal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          <DomainConfigProvider>
            <ClientWrapper>
              <ConnectionStatus />
              <TrashCleanupInitializer />
              <FloatingNotifications />
            </ClientWrapper>
            {children}
          </DomainConfigProvider>
        </Providers>
      </body>
    </html>
  );
}