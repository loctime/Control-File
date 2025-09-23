'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  fileId?: string;
  onConfirm: (blob: Blob, fileNameSuggestion: string) => void;
  originalFileName?: string;
}

// Modal de recorte con recuadro libre (rectangular), movable y redimensionable
export function ImageCropModal({ isOpen, onClose, imageUrl, fileId, onConfirm, originalFileName }: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [mode, setMode] = useState<'idle' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'>('idle');
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startRect: { x: number; y: number; w: number; h: number } } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setImgLoaded(false);
      setMode('idle');
      setSelectionRect(null);
      setContainerSize(null);
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
        setLocalUrl(null);
      }
    }
  }, [isOpen, localUrl]);

  // Cargar la imagen como blob local para evitar canvas tainted
  useEffect(() => {
    let revoked = false;
    async function loadAsBlob() {
      if (!isOpen) return;
      try {
        if (fileId) {
          // Usar proxy interno autenticado
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          const currentUser = auth.currentUser;
          if (!currentUser) throw new Error('No autenticado');
          const token = await currentUser.getIdToken();
          const resp = await fetch('/api/files/proxy-download', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileId }),
          });
          if (!resp.ok) throw new Error('No se pudo descargar');
          const blob = await resp.blob();
          const objUrl = URL.createObjectURL(blob);
          if (!revoked) setLocalUrl(objUrl);
        } else if (imageUrl) {
          const response = await fetch(imageUrl, { cache: 'no-store' });
          const blob = await response.blob();
          const objUrl = URL.createObjectURL(blob);
          if (!revoked) setLocalUrl(objUrl);
        }
      } catch (_) {
        setLocalUrl(null);
      }
    }
    loadAsBlob();
    return () => {
      revoked = true;
    };
  }, [isOpen, imageUrl, fileId]);

  // Inicializar contenedor y recuadro por defecto al cargar la imagen
  useEffect(() => {
    if (!imgLoaded || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    setContainerSize({ width, height });

    // Si no hay selección, crear un rectángulo centrado
    setSelectionRect((prev) => {
      if (prev) return prev;
      const w = Math.floor(width * 0.8);
      const h = Math.floor(height * 0.6);
      const x = Math.floor((width - w) / 2);
      const y = Math.floor((height - h) / 2);
      return { x, y, w, h };
    });
  }, [imgLoaded]);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const getPointerInOverlay = (e: MouseEvent | React.MouseEvent) => {
    const overlay = overlayRef.current;
    if (!overlay) return { px: 0, py: 0 };
    const rect = overlay.getBoundingClientRect();
    const px = (e as MouseEvent).clientX - rect.left;
    const py = (e as MouseEvent).clientY - rect.top;
    return { px, py };
  };

  const startMove = (e: React.MouseEvent) => {
    if (!selectionRect) return;
    setMode('move');
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startRect: { ...selectionRect },
    };
  };

  const startResize = (corner: 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se') => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectionRect) return;
    setMode(corner);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startRect: { ...selectionRect },
    };
  };

  useEffect(() => {
    if (mode === 'idle') return;
    const handleMove = (e: MouseEvent) => {
      if (!containerSize || !selectionRect || !dragStartRef.current) return;
      const { startRect } = dragStartRef.current;
      const minWidth = 20;
      const minHeight = 20;

      if (mode === 'move') {
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;
        const newX = clamp(startRect.x + dx, 0, containerSize.width - startRect.w);
        const newY = clamp(startRect.y + dy, 0, containerSize.height - startRect.h);
        setSelectionRect({ x: newX, y: newY, w: startRect.w, h: startRect.h });
        return;
      }

      const { px, py } = getPointerInOverlay(e);
      // Anclas por esquina según modo
      if (mode === 'resize-se') {
        const anchorX = startRect.x;
        const anchorY = startRect.y;
        const maxW = containerSize.width - anchorX;
        const maxH = containerSize.height - anchorY;
        const w = clamp(px - anchorX, minWidth, maxW);
        const h = clamp(py - anchorY, minHeight, maxH);
        setSelectionRect({ x: anchorX, y: anchorY, w, h });
        return;
      }
      if (mode === 'resize-nw') {
        const anchorX = startRect.x + startRect.w;
        const anchorY = startRect.y + startRect.h;
        const maxW = anchorX;
        const maxH = anchorY;
        const w = clamp(anchorX - px, minWidth, maxW);
        const h = clamp(anchorY - py, minHeight, maxH);
        const x = anchorX - w;
        const y = anchorY - h;
        setSelectionRect({ x, y, w, h });
        return;
      }
      if (mode === 'resize-ne') {
        const anchorX = startRect.x;
        const anchorY = startRect.y + startRect.h;
        const maxW = containerSize.width - anchorX;
        const maxH = anchorY;
        const w = clamp(px - anchorX, minWidth, maxW);
        const h = clamp(anchorY - py, minHeight, maxH);
        const x = anchorX;
        const y = anchorY - h;
        setSelectionRect({ x, y, w, h });
        return;
      }
      if (mode === 'resize-sw') {
        const anchorX = startRect.x + startRect.w;
        const anchorY = startRect.y;
        const maxW = anchorX;
        const maxH = containerSize.height - anchorY;
        const w = clamp(anchorX - px, minWidth, maxW);
        const h = clamp(py - anchorY, minHeight, maxH);
        const x = anchorX - w;
        const y = anchorY;
        setSelectionRect({ x, y, w, h });
        return;
      }
    };
    const handleUp = () => {
      setMode('idle');
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [mode, containerSize, selectionRect]);

  const handleConfirm = async () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !img || !overlay || !selectionRect) return;

    // Mapear selección (en pixeles del overlay) a coordenadas de la imagen real
    const overlayRect = overlay.getBoundingClientRect();
    const scaleX = img.naturalWidth / overlayRect.width;
    const scaleY = img.naturalHeight / overlayRect.height;

    const sx = Math.round(selectionRect.x * scaleX);
    const sy = Math.round(selectionRect.y * scaleY);
    const sw = Math.round(selectionRect.w * scaleX);
    const sh = Math.round(selectionRect.h * scaleY);

    canvas.width = Math.max(1, sw);
    canvas.height = Math.max(1, sh);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const base = originalFileName?.replace(/\.[^.]+$/, '') || 'recorte';
      const suggestion = `${base}_crop.png`;
      onConfirm(blob, suggestion);
    }, 'image/png');
  };

  const selection = selectionRect;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recortar imagen"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selection}>Guardar recorte</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative w-full">
          <img
            ref={imgRef}
            src={localUrl || imageUrl || ''}
            alt="Imagen a recortar"
            className="w-full h-auto select-none"
            draggable={false}
            onLoad={() => setImgLoaded(true)}
          />
          {/* Overlay con recuadro rectangular movable/redimensionable */}
          {imgLoaded && (
            <div ref={overlayRef} className="absolute inset-0">
              {/* sombreado */}
              {selection && (
                <div className="absolute inset-0 pointer-events-none">
                  <div
                    className="absolute bg-black/40"
                    style={{ left: 0, top: 0, width: selection.x, height: '100%' }}
                  />
                  <div
                    className="absolute bg-black/40"
                    style={{ left: selection.x + selection.w, top: 0, right: 0, bottom: 0 }}
                  />
                  <div
                    className="absolute bg-black/40"
                    style={{ left: selection.x, top: 0, width: selection.w, height: selection.y }}
                  />
                  <div
                    className="absolute bg-black/40"
                    style={{ left: selection.x, top: selection.y + selection.h, width: selection.w, bottom: 0 }}
                  />
                </div>
              )}
              {selection && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move"
                  style={{ left: selection.x, top: selection.y, width: selection.w, height: selection.h }}
                  onMouseDown={startMove}
                >
                  {/* asas de redimensionado en esquinas */}
                  <div
                    className="absolute w-3 h-3 bg-white border border-blue-500 rounded-sm cursor-nw-resize"
                    style={{ left: -6, top: -6 }}
                    onMouseDown={startResize('resize-nw')}
                  />
                  <div
                    className="absolute w-3 h-3 bg-white border border-blue-500 rounded-sm cursor-ne-resize"
                    style={{ right: -6, top: -6 }}
                    onMouseDown={startResize('resize-ne')}
                  />
                  <div
                    className="absolute w-3 h-3 bg-white border border-blue-500 rounded-sm cursor-sw-resize"
                    style={{ left: -6, bottom: -6 }}
                    onMouseDown={startResize('resize-sw')}
                  />
                  <div
                    className="absolute w-3 h-3 bg-white border border-blue-500 rounded-sm cursor-se-resize"
                    style={{ right: -6, bottom: -6 }}
                    onMouseDown={startResize('resize-se')}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <p className="text-xs text-muted-foreground">Mueve o redimensiona el recuadro para definir el recorte (rectangular).</p>
      </div>
    </Modal>
  );
}

export default ImageCropModal;


