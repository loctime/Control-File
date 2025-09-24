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
            if (!u) return null;
            const t = await u.getIdToken();
            return `Bearer ${t}`;
          } catch (e) { return null; }
        })();
        
        const res = await fetch('/api/user/taskbar', {
          method: 'GET',
          headers: authHeader ? { 'Authorization': authHeader } : {},
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
        }
      } catch (error) {
        console.error('Error loading taskbar items:', error);
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
          if (!u) return null;
          const t = await u.getIdToken();
          return `Bearer ${t}`;
        } catch (e) { return null; }
      })();

      await fetch('/api/user/taskbar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { 'Authorization': authHeader } : {}),
        },
        body: JSON.stringify({ items }),
      });
    } catch (error) {
      console.error('Error saving taskbar items:', error);
    }
  };

  // Anclar una carpeta al taskbar
  const pinFolder = (folderId: string, folderName: string) => {
    // Verificar si ya está en el taskbar
    const exists = taskbarItems.some(item => item.id === folderId);
    if (exists) {
      addToast({
        title: 'Ya está en el Taskbar',
        description: 'Esta carpeta ya está anclada en el taskbar.',
        type: 'warning'
      });
      return;
    }

    const newItem: TaskbarItem = {
      id: folderId,
      name: folderName,
      icon: 'Folder',
      color: 'text-purple-600',
      type: 'folder',
      isCustom: false, // Es una carpeta real, no personalizada
    };
    
    const updatedItems = [...taskbarItems, newItem];
    setTaskbarItems(updatedItems);
    saveTaskbarItems(updatedItems);
    
    addToast({
      title: 'Carpeta Anclada',
      description: `${folderName} ha sido añadida al taskbar.`,
      type: 'success'
    });
  };

  // Desanclar una carpeta del taskbar
  const unpinFolder = (folderId: string) => {
    const updatedItems = taskbarItems.filter(item => item.id !== folderId);
    setTaskbarItems(updatedItems);
    saveTaskbarItems(updatedItems);
    
    addToast({
      title: 'Carpeta Desanclada',
      description: 'La carpeta ha sido removida del taskbar.',
      type: 'success'
    });
  };

  // Verificar si una carpeta está en el taskbar
  const isFolderPinned = (folderId: string) => {
    return taskbarItems.some(item => item.id === folderId);
  };

  return {
    taskbarItems,
    pinFolder,
    unpinFolder,
    isFolderPinned,
    saveTaskbarItems
  };
}
