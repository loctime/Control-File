'use client';

import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '@/lib/stores/ui';

interface TaskbarItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'folder' | 'app';
  isCustom?: boolean;
}

export function useTaskbar() {
  const { addToast } = useUIStore();
  const [taskbarItems, setTaskbarItems] = useState<TaskbarItem[]>([]);
  const hasLoadedTaskbarRef = useRef(false);

  // Cargar items del taskbar desde el backend
  useEffect(() => {
    if (hasLoadedTaskbarRef.current) return;
    
    (async () => {
      try {
        const authHeader = await (async () => {
          try {
            const { auth } = await import('@/lib/firebase');
            const u = auth?.currentUser;
            if (!u) {
              console.log('🔐 No hay usuario autenticado, saltando carga del taskbar');
              return null;
            }
            const t = await u.getIdToken();
            return `Bearer ${t}`;
          } catch (e) { 
            console.log('🔐 Error obteniendo token de autenticación:', e);
            return null; 
          }
        })();
        
        if (!authHeader) {
          console.log('🔐 Sin token de autenticación, saltando carga del taskbar');
          hasLoadedTaskbarRef.current = true;
          return;
        }
        
        const res = await fetch('/api/user/taskbar', {
          method: 'GET',
          headers: { 'Authorization': authHeader },
        });
        
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data.items) ? data.items : [];
          const normalized = items.map((it: any) => ({
            id: it.id,
            name: it.name,
            icon: typeof it.icon === 'string' ? it.icon : 'Folder',
            color: it.color || 'text-purple-600',
            type: it.type === 'app' || it.type === 'folder' ? it.type : 'folder',
            isCustom: typeof it.isCustom === 'boolean' ? it.isCustom : true,
          }));

          setTaskbarItems(normalized);
          console.log('✅ Taskbar items cargados:', normalized.length);
        } else {
          console.log('❌ Error cargando taskbar items:', res.status, res.statusText);
        }
      } catch (error) {
        console.error('❌ Error loading taskbar items:', error);
      } finally {
        hasLoadedTaskbarRef.current = true;
      }
    })();
  }, []);

  // Guardar items del taskbar en el backend
  const saveTaskbarItems = async (items: TaskbarItem[]) => {
    try {
      const authHeader = await (async () => {
        try {
          const { auth } = await import('@/lib/firebase');
          const u = auth?.currentUser;
          if (!u) {
            console.log('🔐 No hay usuario autenticado, saltando guardado del taskbar');
            return null;
          }
          const t = await u.getIdToken();
          return `Bearer ${t}`;
        } catch (e) { 
          console.log('🔐 Error obteniendo token para guardar:', e);
          return null; 
        }
      })();

      if (!authHeader) {
        console.log('🔐 Sin token de autenticación, saltando guardado del taskbar');
        return;
      }

      const res = await fetch('/api/user/taskbar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({ items }),
      });

      if (res.ok) {
        console.log('✅ Taskbar items guardados correctamente');
      } else {
        console.log('❌ Error guardando taskbar items:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('❌ Error saving taskbar items:', error);
    }
  };

  return {
    taskbarItems,
    saveTaskbarItems
  };
}
