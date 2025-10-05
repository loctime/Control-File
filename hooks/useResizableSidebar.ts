import { useCallback, useEffect, useState, useRef } from 'react';

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
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(initialWidth);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Guardar posición inicial y ancho inicial
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    
    console.log('Iniciando redimensionamiento:', {
      startX: startXRef.current,
      startWidth: startWidthRef.current,
      currentWidth: sidebarWidth
    });
    
    setIsResizing(true);
    
    // Prevenir selección de texto y cambiar cursor
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [sidebarWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    // Calcular la diferencia desde el punto de inicio
    const deltaX = e.clientX - startXRef.current;
    const newWidth = startWidthRef.current + deltaX;
    
    // Aplicar límites
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    
    console.log('Redimensionando:', {
      deltaX,
      newWidth,
      clampedWidth,
      minWidth,
      maxWidth
    });
    
    setSidebarWidth(clampedWidth);
    
    // Prevenir selección de texto durante el redimensionamiento
    e.preventDefault();
  }, [isResizing, minWidth, maxWidth]);

  const handleMouseUp = useCallback(() => {
    console.log('Finalizando redimensionamiento. Ancho final:', sidebarWidth);
    setIsResizing(false);
    
    // Restaurar estilos del body
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Actualizar el ancho inicial cuando cambie
  useEffect(() => {
    setSidebarWidth(initialWidth);
    startWidthRef.current = initialWidth;
  }, [initialWidth]);

  // Log del estado actual para debugging
  useEffect(() => {
    console.log('Estado del sidebar:', {
      sidebarWidth,
      isResizing,
      minWidth,
      maxWidth,
      initialWidth
    });
  }, [sidebarWidth, isResizing, minWidth, maxWidth, initialWidth]);

  return { sidebarWidth, isResizing, handleMouseDown };
}


