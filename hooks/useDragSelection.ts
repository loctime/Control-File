import { useState, useCallback, useRef, useEffect } from 'react';

interface DragSelectionState {
  isSelecting: boolean;
  startPoint: { x: number; y: number } | null;
  endPoint: { x: number; y: number } | null;
  selectionRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
}

interface UseDragSelectionOptions {
  onSelectionChange: (selectedIds: string[]) => void;
  containerRef: React.RefObject<HTMLElement>;
  itemRefs: React.RefObject<Map<string, HTMLElement>>;
  selectedItems: string[];
  multiSelect?: boolean;
}

export function useDragSelection({
  onSelectionChange,
  containerRef,
  itemRefs,
  selectedItems,
  multiSelect = true
}: UseDragSelectionOptions) {
  const [dragState, setDragState] = useState<DragSelectionState>({
    isSelecting: false,
    startPoint: null,
    endPoint: null,
    selectionRect: null
  });

  const isDraggingRef = useRef(false);

  // Función para detectar si un elemento está dentro del rectángulo de selección
  const isElementInSelection = useCallback((element: HTMLElement, rect: DOMRect) => {
    const elementRect = element.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    
    if (!containerRect) return false;

    // Convertir coordenadas relativas al contenedor
    const relativeElementRect = {
      left: elementRect.left - containerRect.left,
      top: elementRect.top - containerRect.top,
      right: elementRect.right - containerRect.left,
      bottom: elementRect.bottom - containerRect.top
    };

    // Verificar si hay intersección
    return !(
      relativeElementRect.right < rect.left ||
      relativeElementRect.left > rect.right ||
      relativeElementRect.bottom < rect.top ||
      relativeElementRect.top > rect.bottom
    );
  }, [containerRef]);

  // Función para obtener los elementos dentro del rectángulo de selección
  const getElementsInSelection = useCallback((rect: DOMRect) => {
    const selectedIds: string[] = [];
    
    if (!itemRefs.current) {
      console.log('❌ No hay referencias de elementos');
      return selectedIds;
    }

    console.log('🔍 Buscando elementos en rectángulo:', rect);
    console.log('📋 Referencias disponibles:', Array.from(itemRefs.current.keys()));

    itemRefs.current.forEach((element, itemId) => {
      const isInSelection = isElementInSelection(element, rect);
      console.log(`🔍 Elemento ${itemId}:`, isInSelection ? '✅ DENTRO' : '❌ FUERA');
      if (isInSelection) {
        selectedIds.push(itemId);
      }
    });

    return selectedIds;
  }, [itemRefs, isElementInSelection]);

  // Función para calcular el rectángulo de selección
  const calculateSelectionRect = useCallback((start: { x: number; y: number }, end: { x: number; y: number }) => {
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    return { left, top, width, height };
  }, []);

  // Manejar inicio de selección
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    console.log('🖱️ Mouse down event:', e.target, e.button);
    
    // Solo iniciar selección si se hace clic en el área de contenido (no en elementos)
    if ((e.target as HTMLElement).closest('[data-item-id]')) {
      console.log('❌ Click en elemento, no iniciar selección');
      return;
    }

    // Solo iniciar selección con botón izquierdo
    if (e.button !== 0) {
      console.log('❌ No es botón izquierdo, no iniciar selección');
      return;
    }

    // Verificar que no sea un botón o elemento interactivo
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) {
      console.log('❌ Click en elemento interactivo, no iniciar selección');
      return;
    }

    console.log('✅ Iniciando selección por arrastre');
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      console.log('❌ No se pudo obtener rect del contenedor');
      return;
    }

    const startPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    console.log('📍 Punto de inicio:', startPoint);

    setDragState({
      isSelecting: true,
      startPoint,
      endPoint: startPoint,
      selectionRect: { left: startPoint.x, top: startPoint.y, width: 0, height: 0 }
    });

    isDraggingRef.current = false;
  }, [containerRef]);

  // Manejar movimiento del mouse durante la selección
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isSelecting || !dragState.startPoint) return;

    console.log('🖱️ Mouse move durante selección');

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const endPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    const selectionRect = calculateSelectionRect(dragState.startPoint, endPoint);

    setDragState(prev => ({
      ...prev,
      endPoint,
      selectionRect
    }));

    isDraggingRef.current = true;

    // Actualizar selección en tiempo real
    const selectedIds = getElementsInSelection({
      left: selectionRect.left,
      top: selectionRect.top,
      right: selectionRect.left + selectionRect.width,
      bottom: selectionRect.top + selectionRect.height,
      width: selectionRect.width,
      height: selectionRect.height
    } as DOMRect);

    console.log('🎯 Elementos seleccionados:', selectedIds);

    // Para selección por arrastre, siempre reemplazar la selección actual
    // con los elementos dentro del rectángulo
    onSelectionChange(selectedIds);
  }, [dragState.isSelecting, dragState.startPoint, containerRef, calculateSelectionRect, getElementsInSelection, selectedItems, onSelectionChange, multiSelect]);

  // Manejar fin de selección
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!dragState.isSelecting) return;

    setDragState({
      isSelecting: false,
      startPoint: null,
      endPoint: null,
      selectionRect: null
    });

    isDraggingRef.current = false;
  }, [dragState.isSelecting]);

  // Agregar event listeners globales
  useEffect(() => {
    if (dragState.isSelecting) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isSelecting, handleMouseMove, handleMouseUp]);

  // Prevenir selección de texto durante el arrastre
  useEffect(() => {
    if (dragState.isSelecting) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'crosshair';
      
      return () => {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [dragState.isSelecting]);

  return {
    dragState,
    isDragging: isDraggingRef.current,
    handleMouseDown
  };
}
