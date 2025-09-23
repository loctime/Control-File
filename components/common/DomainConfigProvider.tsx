'use client';

import { useEffect, useState } from 'react';
import { getCurrentDomainConfig, isDomainAuthorized } from '@/lib/domain-config';
import { useUIStore } from '@/lib/stores/ui';

interface DomainConfigProviderProps {
  children: React.ReactNode;
}

export function DomainConfigProvider({ children }: DomainConfigProviderProps) {
  const [isConfigReady, setIsConfigReady] = useState(false);
  const [domainInfo, setDomainInfo] = useState<{
    domain: string;
    isAuthorized: boolean;
    configFound: boolean;
  } | null>(null);
  const { addToast } = useUIStore();

  useEffect(() => {
    const initializeDomainConfig = () => {
      try {
        const currentDomain = window.location.hostname;
        const config = getCurrentDomainConfig();
        const authorized = isDomainAuthorized();

        const info = {
          domain: currentDomain,
          isAuthorized: authorized,
          configFound: config !== null,
        };

        setDomainInfo(info);
        setIsConfigReady(true);

        console.log('🌐 Configuración de dominio:', {
          domain: currentDomain,
          authorized,
          configFound: config !== null,
        });

        // Mostrar información sobre el dominio
        if (!authorized) {
          console.warn('⚠️ Dominio no autorizado:', currentDomain);
          addToast({
            type: 'warning',
            title: 'Dominio no autorizado',
            message: `El dominio ${currentDomain} no está en la lista de dominios autorizados. Algunas funciones pueden no funcionar correctamente.`,
          });
        }

        if (!config) {
          console.warn('⚠️ No se encontró configuración para:', currentDomain);
          addToast({
            type: 'warning',
            title: 'Configuración no encontrada',
            message: `No se encontró configuración específica para ${currentDomain}. Usando configuración por defecto.`,
          });
        }

      } catch (error) {
        console.error('❌ Error inicializando configuración de dominio:', error);
        setIsConfigReady(true);
      }
    };

    // Solo ejecutar en el cliente
    if (typeof window !== 'undefined') {
      initializeDomainConfig();
    } else {
      setIsConfigReady(true);
    }
  }, [addToast]);

  // Debug opcional (comentado para reducir ruido)
  // if (process.env.NODE_ENV === 'development' && domainInfo) {
  //   console.log('🔧 Debug - Información del dominio:', domainInfo);
  // }

  return <>{children}</>;
}

