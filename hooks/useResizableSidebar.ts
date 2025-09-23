import { useCallback, useEffect, useState } from 'react';

interface UseResizableSidebarOptions {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

interface UseResizableSidebarResult {
  sidebarWidth: number;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
}

export function useResizableSidebar(
  options: UseResizableSidebarOptions = {}
): UseResizableSidebarResult {
  const {
    initialWidth = 320,
    minWidth = 200,
    maxWidth = 600,
  } = options;

  const [sidebarWidth, setSidebarWidth] = useState<number>(initialWidth);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setSidebarWidth(newWidth);
    }
  }, [isResizing, minWidth, maxWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return { sidebarWidth, isResizing, handleMouseDown };
}


