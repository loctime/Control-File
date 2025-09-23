'use client';

import { useEffect } from 'react';
import { useDriveStore } from '@/lib/stores/drive';

export function TrashCleanupInitializer() {
  const { cleanupExpiredTrash } = useDriveStore();

  useEffect(() => {
    // Limpiar elementos expirados al cargar la aplicación
    cleanupExpiredTrash();

    // Configurar limpieza automática cada hora
    const cleanupInterval = setInterval(() => {
      const cleanedCount = cleanupExpiredTrash();
      if (cleanedCount > 0) {
        console.log(`✅ Limpieza automática completada: ${cleanedCount} elementos eliminados`);
      }
    }, 60 * 60 * 1000); // 1 hora

    return () => clearInterval(cleanupInterval);
  }, [cleanupExpiredTrash]);

  return null; // Este componente no renderiza nada
}
