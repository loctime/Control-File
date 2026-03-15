'use client';

import { useState, useEffect, useRef } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserControlFileClient } from '@/lib/controlfile-client';
import type { TaskbarItem } from '@/controlfile-sdk-other/src';

export function useTaskbar() {
  const { items } = useDriveStore();
  const { user } = useAuth();
  const [taskbarItems, setTaskbarItems] = useState<TaskbarItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasLoadedTaskbarRef = useRef(false);

  const loadTaskbar = async () => {
    setIsLoading(true);
    try {
      const client = createBrowserControlFileClient();
      const data = await client.getTaskbar();
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      const normalized = rawItems.map((it: any) => ({
        id: it.id,
        name: it.name,
        icon: typeof it.icon === 'string' ? it.icon : 'Folder',
        color: it.color || 'text-purple-600',
        type: it.type === 'app' || it.type === 'folder' ? it.type : 'folder',
        isCustom: typeof it.isCustom === 'boolean' ? it.isCustom : true,
        folderId: it.folderId,
      }));
      setTaskbarItems(normalized);
      hasLoadedTaskbarRef.current = true;
    } catch (error) {
      console.error('Error loading taskbar items:', error);
      hasLoadedTaskbarRef.current = true;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasLoadedTaskbarRef.current || isLoading) return;
    loadTaskbar();
  }, [isLoading]);

  const saveTaskbarItems = async (nextItems: TaskbarItem[]) => {
    try {
      const client = createBrowserControlFileClient();
      await client.saveTaskbar(nextItems as unknown as Array<Record<string, unknown>>);
    } catch (error) {
      console.error('Error saving taskbar items:', error);
    }
  };

  useEffect(() => {
    if (!user?.uid || !items.length || isLoading) return;

    const userId = user.uid;
    const taskbarFolders = items.filter(
      (item) =>
        item.type === 'folder' &&
        item.userId === userId &&
        !item.deletedAt &&
        item.parentId === null &&
        item.metadata?.source === 'taskbar'
    );

    if (taskbarFolders.length > 0) {
      const newTaskbarItems = taskbarFolders.map((folder) => ({
        id: `auto-${folder.id}`,
        name: folder.name,
        icon: folder.metadata?.icon || 'Folder',
        color: folder.metadata?.color || 'text-blue-600',
        type: 'folder' as const,
        isCustom: false,
        folderId: folder.id,
      }));

      const existingFolderIds = taskbarItems.filter((item) => item.folderId).map((item) => item.folderId);
      const itemsToAdd = newTaskbarItems.filter((item) => !existingFolderIds.includes(item.folderId));

      if (itemsToAdd.length > 0) {
        const updatedItems = [...taskbarItems, ...itemsToAdd];
        setTaskbarItems(updatedItems);
        saveTaskbarItems(updatedItems);
      }
    }
  }, [items, user, taskbarItems, isLoading]);

  return {
    taskbarItems,
    saveTaskbarItems,
    isLoading,
  };
}
