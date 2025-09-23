// lib/trash-cleanup.ts
import { useDriveStore } from './stores/drive';

// Función para limpiar elementos expirados de la papelera
export function cleanupExpiredTrash() {
  const store = useDriveStore.getState();
  const now = new Date();
  
  // Obtener todos los elementos con fecha de expiración
  const expiredItems = store.items.filter(item => 
    item.deletedAt && 
    item.expiresAt && 
    new Date(item.expiresAt) <= now
  );
  
  if (expiredItems.length > 0) {
    console.log(`🗑️ Limpiando ${expiredItems.length} elementos expirados de la papelera`);
    
    // Eliminar elementos expirados
    expiredItems.forEach(item => {
      store.permanentlyDelete(item.id);
    });
    
    return expiredItems.length;
  }
  
  return 0;
}

// Función para obtener estadísticas de la papelera
export function getTrashStats() {
  const store = useDriveStore.getState();
  const trashItems = store.getTrashItems();
  const now = new Date();
  
  const stats = {
    total: trashItems.length,
    expiringToday: 0,
    expiringThisWeek: 0,
    expired: 0
  };
  
  trashItems.forEach(item => {
    if (item.expiresAt) {
      const expiresDate = new Date(item.expiresAt);
      const daysUntilExpiry = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= 0) {
        stats.expired++;
      } else if (daysUntilExpiry <= 1) {
        stats.expiringToday++;
      } else if (daysUntilExpiry <= 7) {
        stats.expiringThisWeek++;
      }
    }
  });
  
  return stats;
}

// Función para configurar la limpieza automática
export function setupAutoCleanup() {
  // Limpiar cada hora
  const cleanupInterval = setInterval(() => {
    const cleanedCount = cleanupExpiredTrash();
    if (cleanedCount > 0) {
      console.log(`✅ Limpieza automática completada: ${cleanedCount} elementos eliminados`);
    }
  }, 60 * 60 * 1000); // 1 hora
  
  return cleanupInterval;
}
