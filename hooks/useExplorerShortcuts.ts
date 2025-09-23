import { useEffect } from 'react';
import { isKeyboardShortcut } from '@/lib/utils';

interface UseExplorerShortcutsOptions {
  onToggleSidebar: () => void;
  onDeleteSelected: () => void;
  onSelectAll: () => void;
  onCopySelected: () => void;
  onPaste: () => void;
  onRenameSelected: () => void;
  onToggleDetails: () => void;
  hasSelection: boolean;
  selectedItemsCount: number;
}

export function useExplorerShortcuts(options: UseExplorerShortcutsOptions) {
  const {
    onToggleSidebar,
    onDeleteSelected,
    onSelectAll,
    onCopySelected,
    onPaste,
    onRenameSelected,
    onToggleDetails,
    hasSelection,
    selectedItemsCount,
  } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const target = (e.target as HTMLElement | null) || active;
      const isEditableTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        !!target.closest('input, textarea, [contenteditable=""], [contenteditable="true"], [role="textbox"]')
      );
      if (isEditableTarget) return;

      if (isKeyboardShortcut(e, { key: 'b' }) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onToggleSidebar();
      }

      if (isKeyboardShortcut(e, { key: 'Delete' })) {
        e.preventDefault();
        if (hasSelection) onDeleteSelected();
      }

      if (isKeyboardShortcut(e, { key: 'a', ctrl: true })) {
        e.preventDefault();
        onSelectAll();
      }

      if (isKeyboardShortcut(e, { key: 'c', ctrl: true })) {
        e.preventDefault();
        if (hasSelection) onCopySelected();
      }

      if (isKeyboardShortcut(e, { key: 'v', ctrl: true })) {
        e.preventDefault();
        onPaste();
      }

      if (isKeyboardShortcut(e, { key: 'F2' })) {
        e.preventDefault();
        if (selectedItemsCount === 1) onRenameSelected();
      }

      if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onToggleDetails();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    onToggleSidebar,
    onDeleteSelected,
    onSelectAll,
    onCopySelected,
    onPaste,
    onRenameSelected,
    onToggleDetails,
    hasSelection,
    selectedItemsCount,
  ]);
}


