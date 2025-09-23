'use client';

import { Upload, Cloud, FileText, Image, Video, Music, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface DragDropLoaderProps {
  isDragOver: boolean;
  files?: File[];
}

export function DragDropLoader({ isDragOver, files = [] }: DragDropLoaderProps) {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (isDragOver) {
      setShowLoader(true);
    } else {
      const timer = setTimeout(() => setShowLoader(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isDragOver]);

  if (!showLoader) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
      {/* Backdrop con efecto glassmorphism */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      
      {/* Contenido del loader */}
      <div className="relative z-10 bg-card/90 backdrop-blur-xl border-2 border-dashed border-primary/50 rounded-2xl p-8 shadow-2xl">
        <div className="text-center space-y-6">
          {/* Icono principal animado */}
          <div className="relative">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-primary via-secondary to-primary animate-spin">
              <div className="w-16 h-16 rounded-full bg-background m-2 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary animate-bounce" />
              </div>
            </div>
            
            {/* Partículas orbitando */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 bg-primary rounded-full animate-ping"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateY(-50px)`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>

          {/* Texto principal */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground gradient-text">
              Soltar archivos para subir
            </h3>
            <p className="text-sm text-muted-foreground">
              Arrastra y suelta tus archivos aquí
            </p>
          </div>

          {/* Información de archivos */}
          {files.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                {files.length} archivo{files.length !== 1 ? 's' : ''} seleccionado{files.length !== 1 ? 's' : ''}
              </p>
              
              <div className="max-h-32 overflow-auto space-y-2">
                {files.slice(0, 5).map((file, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 backdrop-blur-sm"
                  >
                    <div className="shrink-0">
                      {getFileIcon(file.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                ))}
                {files.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    ... y {files.length - 5} más
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Iconos de nube flotantes */}
          <div className="relative">
            <div className="absolute -top-4 -left-4">
              <Cloud className="w-6 h-6 text-secondary animate-pulse" />
            </div>
            <div className="absolute -top-4 -right-4">
              <Cloud className="w-6 h-6 text-primary animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
            <div className="absolute -bottom-4 -left-4">
              <Cloud className="w-6 h-6 text-secondary animate-pulse" style={{ animationDelay: '1s' }} />
            </div>
            <div className="absolute -bottom-4 -right-4">
              <Cloud className="w-6 h-6 text-primary animate-pulse" style={{ animationDelay: '1.5s' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Función para obtener el icono según el tipo de archivo
function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext || '')) {
    return <Image className="h-4 w-4 text-blue-500" />;
  }
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext || '')) {
    return <Video className="h-4 w-4 text-purple-500" />;
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(ext || '')) {
    return <Music className="h-4 w-4 text-green-500" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
    return <Archive className="h-4 w-4 text-orange-500" />;
  }
  return <FileText className="h-4 w-4 text-gray-500" />;
}

// Función para formatear el tamaño del archivo
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
