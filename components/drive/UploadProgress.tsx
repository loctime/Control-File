'use client';

import { X, CheckCircle, XCircle, Loader2, Upload, FileText, Image, Video, Music, Archive } from 'lucide-react';
import { useUIStore } from '@/lib/stores/ui';
import { formatFileSize } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

// Función para obtener el icono según el tipo de archivo
function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext || '')) {
    return <Image className="h-4 w-4" />;
  }
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext || '')) {
    return <Video className="h-4 w-4" />;
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(ext || '')) {
    return <Music className="h-4 w-4" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
    return <Archive className="h-4 w-4" />;
  }
  return <FileText className="h-4 w-4" />;
}

// Componente de animación de partículas para el loader
function ParticleLoader() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Círculo principal con gradiente */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary via-secondary to-primary animate-spin">
            <div className="w-6 h-6 rounded-full bg-background m-1"></div>
          </div>
          
          {/* Partículas orbitando */}
          <div className="absolute inset-0 animate-ping">
            <div className="w-2 h-2 bg-primary rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
          </div>
          <div className="absolute inset-0 animate-ping" style={{ animationDelay: '0.5s' }}>
            <div className="w-2 h-2 bg-secondary rounded-full absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2"></div>
          </div>
          <div className="absolute inset-0 animate-ping" style={{ animationDelay: '1s' }}>
            <div className="w-2 h-2 bg-primary rounded-full absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
          </div>
          <div className="absolute inset-0 animate-ping" style={{ animationDelay: '1.5s' }}>
            <div className="w-2 h-2 bg-secondary rounded-full absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente de barra de progreso animada
function AnimatedProgress({ value, status }: { value: number; status: string }) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative">
      <Progress 
        value={animatedValue} 
        className={cn(
          "h-2 transition-all duration-500 ease-out",
          status === 'complete' && "upload-progress"
        )}
        indicatorClassName={cn(
          "transition-all duration-500 ease-out",
          status === 'uploading' && "bg-gradient-to-r from-primary to-secondary",
          status === 'processing' && "bg-gradient-to-r from-yellow-500 to-orange-500",
          status === 'complete' && "bg-gradient-to-r from-green-500 to-emerald-500",
          status === 'error' && "bg-gradient-to-r from-red-500 to-pink-500"
        )}
      />
      
      {/* Efecto de brillo en la barra de progreso */}
      {status === 'uploading' && (
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div className="h-full w-8 bg-white/30 blur-sm animate-pulse transform -skew-x-12"></div>
        </div>
      )}
    </div>
  );
}

export function UploadProgress() {
  const { uploadProgress, removeUpload } = useUIStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (uploadProgress.length > 0) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [uploadProgress.length]);

  if (uploadProgress.length === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-[60] transition-all duration-300 ease-in-out",
      isVisible ? "translate-y-0" : "translate-y-full"
    )}>
      {/* Fondo con efecto glassmorphism */}
      <div className="bg-background/80 backdrop-blur-xl border-t border-border/50 shadow-2xl">
        <div className="p-4 space-y-3 max-h-64 overflow-auto custom-scrollbar">
          {uploadProgress.map((upload, index) => (
            <div 
              key={upload.sessionId} 
              className={cn(
                "group relative flex items-center gap-4 p-4 rounded-xl border bg-card/50 backdrop-blur-sm",
                "transition-all duration-300 ease-out hover:bg-card/70 hover:shadow-lg",
                "animate-in slide-in-from-bottom-2",
                upload.status === 'complete' && "border-green-500/30 bg-green-500/5",
                upload.status === 'error' && "border-red-500/30 bg-red-500/5"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Efecto de borde animado */}
              <div className={cn(
                "absolute inset-0 rounded-xl border-2 opacity-0 transition-opacity duration-300",
                upload.status === 'uploading' && "border-primary/50 animate-pulse",
                upload.status === 'processing' && "border-yellow-500/50 animate-pulse",
                upload.status === 'complete' && "border-green-500/50",
                upload.status === 'error' && "border-red-500/50"
              )}></div>

              {/* Icono de estado con animaciones */}
              <div className="relative shrink-0">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  "transition-all duration-300 ease-out",
                  upload.status === 'uploading' && "bg-gradient-to-br from-primary/20 to-secondary/20",
                  upload.status === 'processing' && "bg-gradient-to-br from-yellow-500/20 to-orange-500/20",
                  upload.status === 'complete' && "bg-gradient-to-br from-green-500/20 to-emerald-500/20",
                  upload.status === 'error' && "bg-gradient-to-br from-red-500/20 to-pink-500/20"
                )}>
                  {upload.status === 'uploading' && <ParticleLoader />}
                  {upload.status === 'processing' && (
                    <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                  )}
                  {upload.status === 'complete' && (
                    <CheckCircle className="h-5 w-5 text-green-500 animate-in zoom-in-50" />
                  )}
                  {upload.status === 'error' && (
                    <XCircle className="h-5 w-5 text-red-500 animate-in zoom-in-50" />
                  )}
                </div>
                
                {/* Icono del tipo de archivo */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full border-2 border-border flex items-center justify-center">
                  {getFileIcon(upload.filename)}
                </div>
              </div>

              {/* Información del archivo */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {upload.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {upload.fileSize ? formatFileSize(upload.fileSize) : 'Calculando...'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded-full",
                      upload.status === 'uploading' && "bg-primary/10 text-primary",
                      upload.status === 'processing' && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
                      upload.status === 'complete' && "bg-green-500/10 text-green-600 dark:text-green-400",
                      upload.status === 'error' && "bg-red-500/10 text-red-600 dark:text-red-400"
                    )}>
                      {upload.progress}%
                    </span>
                  </div>
                </div>
                
                {upload.status === 'error' ? (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-1 rounded-md">
                    {upload.error || 'Error al subir'}
                  </p>
                ) : (
                  <AnimatedProgress value={upload.progress} status={upload.status} />
                )}
              </div>

              {/* Botón de cerrar con hover effect */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200",
                  "hover:bg-destructive/10 hover:text-destructive"
                )}
                onClick={() => removeUpload(upload.sessionId)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        
        {/* Footer con estadísticas */}
        <div className="px-4 py-2 border-t border-border/30 bg-muted/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {uploadProgress.filter(u => u.status === 'complete').length} completados
            </span>
            <span>
              {uploadProgress.filter(u => u.status === 'uploading' || u.status === 'processing').length} en progreso
            </span>
            <span>
              {uploadProgress.filter(u => u.status === 'error').length} errores
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
