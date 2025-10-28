'use client';

import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '@/lib/stores/ui';
import { useDriveStore } from '@/lib/stores/drive';
import { useAuth } from '@/hooks/useAuth';

interface TaskbarItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'folder' | 'app';
  isCustom?: boolean;
  folderId?: string; // Referencia a la carpeta real
}

export function useTaskbar() {
  const { addToast } = useUIStore();
  const { items } = useDriveStore();
  const { user } = useAuth();
  const [taskbarItems, setTaskbarItems] = useState<TaskbarItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasLoadedTaskbarRef = useRef(false);

  // Cargar items del taskbar desde el backend
  useEffect(() => {
    if (hasLoadedTaskbarRef.current || isLoading) return;
    
    (async () => {
      setIsLoading(true);
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
          hasLoadedTaskbarRef.current = true;
        } else if (res.status === 429) {
          // Manejar específicamente el error de rate limiting
          console.warn('⚠️ Rate limit alcanzado para taskbar, reintentando en 30 segundos...');
          hasLoadedTaskbarRef.current = true;
          
          // Reintentar después de 30 segundos
          setTimeout(() => {
            hasLoadedTaskbarRef.current = false;
            // Forzar re-render para intentar cargar nuevamente
            setTaskbarItems(prev => [...prev]);
          }, 30000);
        } else {
          console.log('❌ Error cargando taskbar items:', res.status, res.statusText);
          hasLoadedTaskbarRef.current = true;
        }
      } catch (error) {
        console.error('❌ Error loading taskbar items:', error);
        hasLoadedTaskbarRef.current = true;
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isLoading]);

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
      } else if (res.status === 429) {
        console.warn('⚠️ Rate limit alcanzado al guardar taskbar, reintentando en 30 segundos...');
        // Reintentar después de 30 segundos
        setTimeout(async () => {
          try {
            await saveTaskbarItems(items);
          } catch (retryError) {
            console.error('❌ Error en reintento de guardado:', retryError);
          }
        }, 30000);
      } else {
        console.log('❌ Error guardando taskbar items:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('❌ Error saving taskbar items:', error);
    }
  };

  // Detectar carpetas con source: 'taskbar'
  useEffect(() => {
    if (!user?.uid || !items.length || isLoading) return;

    const userId = user.uid;
    
    // Solo detectar carpetas con source: 'taskbar'
    const taskbarFolders = items.filter(item => 
      item.type === 'folder' && 
      item.userId === userId &&
      !item.deletedAt &&
      item.metadata?.source === 'taskbar' // Solo carpetas marcadas para taskbar
    );

    if (taskbarFolders.length > 0) {
      console.log('🔍 Detectadas carpetas para taskbar:', taskbarFolders.length);
      
      // Crear items del taskbar para estas carpetas
      const newTaskbarItems = taskbarFolders.map(folder => ({
        id: `auto-${folder.id}`,
        name: folder.name,
        icon: folder.metadata?.icon || 'Folder',
        color: folder.metadata?.color || 'text-blue-600',
        type: 'folder' as const,
        isCustom: false,
        folderId: folder.id, // Guardar referencia a la carpeta real
      }));

      // Filtrar items que ya existen en el taskbar (por folderId para evitar duplicados)
      const existingFolderIds = taskbarItems
        .filter(item => item.folderId)
        .map(item => item.folderId);
      const itemsToAdd = newTaskbarItems.filter(item => 
        !existingFolderIds.includes(item.folderId)
      );

      if (itemsToAdd.length > 0) {
        console.log('➕ Agregando carpetas al taskbar:', itemsToAdd.length);
        const updatedItems = [...taskbarItems, ...itemsToAdd];
        setTaskbarItems(updatedItems);
        saveTaskbarItems(updatedItems);
      }
    }
  }, [items, user, taskbarItems, isLoading, saveTaskbarItems]);

  return {
    taskbarItems,
    saveTaskbarItems,
    isLoading
  };
}
