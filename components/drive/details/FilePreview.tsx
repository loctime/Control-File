'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import {
  File as FileIcon,
  Image as ImageIcon,
  FileText,
  FileVideo,
  FileAudio,
  Archive,
  Code,
  FileSpreadsheet,
  Presentation,
  RotateCcw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Crop,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import ImageCropModal from '@/components/drive/ImageCropModal';
import { useFileDownloadUrl } from '@/hooks/useFileDownloadUrl';
import { useProxyUpload } from '@/hooks/useProxyUpload';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { useQueryClient } from '@tanstack/react-query';
import { getAuth } from 'firebase/auth';
import { isImageFile, isPDFFile, isVideoFile, isAudioFile, isTextFile, isOfficeFile } from '@/lib/utils';

function ImagePreview({ file }: { file: any }) {
  const [imageError, setImageError] = useState(false);
  const [rotation, setRotation] = useState(0);
  const { downloadUrl, loading, error } = useFileDownloadUrl(file.id);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const { uploadFile } = useProxyUpload();
  const { currentFolderId, updateItem } = useDriveStore();
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();

  if (loading) {
    return (
      <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <span className="text-sm text-muted-foreground">Cargando imagen...</span>
        </div>
      </div>
    );
  }

  if (error || imageError) {
    return (
      <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <span className="text-sm text-muted-foreground">
            {error || 'Error al cargar imagen'}
          </span>
        </div>
      </div>
    );
  }

  if (!downloadUrl) {
    return (
      <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <span className="text-sm text-muted-foreground">No se pudo cargar la imagen</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className="aspect-video bg-muted/30 rounded-lg overflow-hidden">
        <img
          src={downloadUrl}
          alt={file.name}
          className="w-full h-full object-contain"
          style={{ transform: `rotate(${rotation}deg)` }}
          onError={() => setImageError(true)}
        />
      </div>
      
      {/* Controles de imagen */}
      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRotation((prev) => (prev + 90) % 360)}
          title="Girar 90°"
          className="h-8 w-8 p-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        {downloadUrl && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsCropOpen(true)}
            title="Recortar"
            className="h-8 w-8 p-0"
          >
            <Crop className="h-4 w-4" />
          </Button>
        )}
        {downloadUrl && (
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              if (!downloadUrl) return;
              try {
                // Descargar como blob para evitar tainted canvas
                // Usar proxy interno autenticado para descargar sin CORS
                const auth = getAuth();
                const currentUser = auth.currentUser;
                if (!currentUser) return;
                const token = await currentUser.getIdToken();
                const resp = await fetch('/api/files/proxy-download', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ fileId: file.id }),
                });
                const blob = await resp.blob();
                const objUrl = URL.createObjectURL(blob);
                const img = new Image();
                img.src = objUrl;
                await new Promise((resolve, reject) => {
                  img.onload = resolve as () => void;
                  img.onerror = reject as () => void;
                });
                const radians = (rotation % 360) * Math.PI / 180;
                const abs = Math.abs((rotation % 360 + 360) % 360);
                const swap = abs === 90 || abs === 270;
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                canvas.width = swap ? h : w;
                canvas.height = swap ? w : h;
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(radians);
                ctx.drawImage(img, -w / 2, -h / 2);
                canvas.toBlob(async (outBlob) => {
                  if (!outBlob) return;
                  try {
                    const auth = getAuth();
                    const currentUser = auth.currentUser;
                    if (!currentUser) throw new Error('No autenticado');
                    const token = await currentUser.getIdToken();
                    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
                    const form = new FormData();
                    const baseName = (file.name || 'imagen').replace(/\.[^.]+$/, '');
                    const fileName = `${baseName}.png`;
                    const filePart = new Blob([outBlob], { type: 'image/png' });
                    form.append('file', filePart, fileName);
                    form.append('fileId', file.id);
                    const respReplace = await fetch(`${backendUrl}/api/files/replace`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` },
                      body: form,
                    });
                    if (!respReplace.ok) {
                      const err = await respReplace.json().catch(() => ({}));
                      throw new Error(err.error || `Error ${respReplace.status}`);
                    }
                    useUIStore.getState().addToast({ type: 'success', title: 'Imagen actualizada', message: 'Se reemplazó la imagen original' });
                    useDriveStore.getState().updateItem(file.id, { modifiedAt: new Date(), mime: 'image/png' });
                    // Invalidar todas las URLs presignadas en caché para refrescar íconos y previews
                    queryClient.invalidateQueries({ queryKey: ['downloadUrl'] });
                  } catch (e: any) {
                    useUIStore.getState().addToast({ type: 'error', title: 'Error al reemplazar', message: e.message || 'Intenta de nuevo' });
                  } finally {
                    URL.revokeObjectURL(objUrl);
                  }
                }, 'image/png');
              } catch (_) {
                // Silenciar errores de CORS o carga
              }
            }}
            title="Reemplazar con imagen rotada"
            className="h-8 w-8 p-0"
          >
            <Save className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Modal de recorte */}
      {downloadUrl && (
        <ImageCropModal
          isOpen={isCropOpen}
          onClose={() => setIsCropOpen(false)}
          imageUrl={downloadUrl}
          fileId={file.id}
          originalFileName={file.name}
          onConfirm={(blob, suggestion) => {
            const simulatedFile = Object.assign(new Blob([blob], { type: 'image/png' }), {
              name: suggestion,
              lastModified: Date.now(),
            }) as unknown as File;
            uploadFile.mutate({ file: simulatedFile, parentId: currentFolderId });
            setIsCropOpen(false);
          }}
        />
      )}
    </div>
  );
}

function VideoPreview({ file }: { file: any }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { downloadUrl, loading, error } = useFileDownloadUrl(file.id);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    video.volume = isMuted ? 0 : Math.min(Math.max(volume / 100, 0), 1);
  }, [volume, isMuted]);

  if (loading) {
    return (
      <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <FileVideo className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <span className="text-sm text-muted-foreground">Cargando video...</span>
        </div>
      </div>
    );
  }

  if (error || !downloadUrl) {
    return (
      <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <FileVideo className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <span className="text-sm text-muted-foreground">
            {error || 'No se pudo cargar el video'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className="aspect-video bg-muted/30 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={downloadUrl}
          className="w-full h-full object-contain"
          controls={false}
          playsInline
          muted={isMuted}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>
      
      {/* Controles de video */}
      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-black/70 rounded-lg p-2 space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                if (video.paused) {
                  video.play();
                } else {
                  video.pause();
                }
              }}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            
            <div className="flex items-center gap-2 flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={(value) => {
                  setVolume(value[0]);
                  setIsMuted(value[0] === 0);
                }}
                max={100}
                step={1}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioPreview({ file }: { file: any }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const { downloadUrl, loading, error } = useFileDownloadUrl(file.id);

  if (loading) {
    return (
      <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <FileAudio className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <span className="text-sm text-muted-foreground">Cargando audio...</span>
        </div>
      </div>
    );
  }

  if (error || !downloadUrl) {
    return (
      <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <FileAudio className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <span className="text-sm text-muted-foreground">
            {error || 'No se pudo cargar el audio'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
      <div className="text-center space-y-4">
        <FileAudio className="h-16 w-16 text-blue-500 mx-auto" />
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={(value) => {
                  setVolume(value[0]);
                  setIsMuted(value[0] === 0);
                }}
                max={100}
                step={1}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextPreview({ file }: { file: any }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useMemo(() => {
    if (file.url || file.downloadUrl) {
      setLoading(true);
      setTimeout(() => {
        setContent(`Contenido del archivo ${file.name}...\n\nEste es un ejemplo de vista previa de texto. En una implementación real, aquí se mostraría el contenido real del archivo.`);
        setLoading(false);
      }, 500);
    }
  }, [file]);

  if (loading) {
    return (
      <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <span className="text-sm text-muted-foreground">Cargando contenido...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-muted/30 rounded-lg p-4 overflow-auto">
      <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
        {content}
      </pre>
    </div>
  );
}

function PdfPreview({ file }: { file: any }) {
  const { downloadUrl, loading, error } = useFileDownloadUrl(file.id);

  if (loading) {
    return (
      <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <span className="text-sm text-muted-foreground">Cargando PDF...</span>
        </div>
      </div>
    );
  }

  if (error || !downloadUrl) {
    return (
      <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <span className="text-sm text-muted-foreground">
            {error || 'No se pudo cargar el PDF'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-muted/30 rounded-lg overflow-hidden">
      <iframe
        src={downloadUrl}
        className="w-full h-full"
        title={file.name || 'Documento PDF'}
      />
    </div>
  );
}

function getFileIcon(file: any) {
  const mime = file.mime || '';
  
  if (isImageFile(mime)) return ImageIcon;
  if (isVideoFile(mime)) return FileVideo;
  if (isAudioFile(mime)) return FileAudio;
  if (isPDFFile(mime)) return FileText;
  if (isTextFile(mime)) return FileText;
  if (isOfficeFile(mime)) {
    if (mime.includes('word')) return FileText;
    if (mime.includes('excel') || mime.includes('spreadsheet')) return FileSpreadsheet;
    if (mime.includes('powerpoint') || mime.includes('presentation')) return Presentation;
    return FileText;
  }
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return Archive;
  if (mime.includes('code') || mime.includes('javascript') || mime.includes('python')) return Code;
  
  return FileIcon;
}

export function FilePreview({ file }: { file: any }) {
  const mime = file.mime || '';
  
  if (isImageFile(mime)) {
    return <ImagePreview file={file} />;
  }
  
  if (isVideoFile(mime)) {
    return <VideoPreview file={file} />;
  }
  
  if (isAudioFile(mime)) {
    return <AudioPreview file={file} />;
  }
  
  if (isPDFFile(mime)) {
    return <PdfPreview file={file} />;
  }
  
  if (isTextFile(mime)) {
    return <TextPreview file={file} />;
  }
  
  // Vista previa genérica para otros tipos de archivo
  const Icon = getFileIcon(file);
  
  return (
    <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
        <span className="text-sm text-muted-foreground">
          {file.mime ? file.mime.split('/')[1].toUpperCase() : 'Archivo'}
        </span>
      </div>
    </div>
  );
}


