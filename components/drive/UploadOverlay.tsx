'use client';

import { Upload, Cloud, CheckCircle, XCircle } from 'lucide-react';
import { useUIStore } from '@/lib/stores/ui';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface UploadOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

export function UploadOverlay({ isVisible, onClose }: UploadOverlayProps) {
  const { uploadProgress } = useUIStore();
  const [showSuccess, setShowSuccess] = useState(false);

  const activeUploads = uploadProgress.filter(u => 
    u.status === 'uploading' || u.status === 'processing'
  );

  const completedUploads = uploadProgress.filter(u => u.status === 'complete');
  const failedUploads = uploadProgress.filter(u => u.status === 'error');

  // Progreso total ponderado por tamaño (si está disponible)
  const nonErrorUploads = uploadProgress.filter(u => u.status !== 'error');
  const totalWeight = nonErrorUploads.reduce((sum, u) => sum + (u.fileSize ?? 1), 0);
  const accumulated = nonErrorUploads.reduce((sum, u) => {
    const weight = u.fileSize ?? 1;
    const progressValue = typeof u.progress === 'number' ? u.progress : (u.status === 'complete' ? 100 : 0);
    return sum + (weight * progressValue) / 100;
  }, 0);
  const overallProgress = totalWeight > 0 ? Math.round((accumulated / totalWeight) * 100) : 0;

  useEffect(() => {
    if (completedUploads.length > 0 && activeUploads.length === 0) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [completedUploads.length, activeUploads.length, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop con efecto glassmorphism */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
        onClick={onClose}
      />
      
      {/* Contenido del overlay */}
      <div className="relative z-10">
        {showSuccess ? (
          <SuccessAnimation />
        ) : (
          <UploadAnimation uploads={activeUploads} />
        )}
      </div>

      {/* Información de estado */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl px-6 py-4 shadow-2xl">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {showSuccess ? '¡Subida completada!' : 'Subiendo archivos...'}
            </h3>
            {!showSuccess && (
              <div className="mt-1 w-80 max-w-[80vw] mx-auto">
                <Progress value={overallProgress} className="h-2" />
                <div className="mt-1 text-xs text-muted-foreground">{overallProgress}%</div>
              </div>
            )}
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                {activeUploads.length} en progreso
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {completedUploads.length} completados
              </span>
              {failedUploads.length > 0 && (
                <span className="flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-500" />
                  {failedUploads.length} errores
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadAnimation({ uploads }: { uploads: any[] }) {
  return (
    <div className="relative">
      {/* Círculo principal con gradiente animado */}
      <div className="w-32 h-32 rounded-full bg-gradient-to-r from-primary via-secondary to-primary animate-spin">
        <div className="w-28 h-28 rounded-full bg-background m-2 flex items-center justify-center">
          <Upload className="w-12 h-12 text-primary animate-bounce" />
        </div>
      </div>

      {/* Partículas orbitando */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 bg-primary rounded-full animate-ping"
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-60px)`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}

      {/* Iconos de nube flotantes */}
      <div className="absolute -top-8 -left-8">
        <Cloud className="w-8 h-8 text-secondary animate-pulse" />
      </div>
      <div className="absolute -top-8 -right-8">
        <Cloud className="w-8 h-8 text-primary animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
      <div className="absolute -bottom-8 -left-8">
        <Cloud className="w-8 h-8 text-secondary animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      <div className="absolute -bottom-8 -right-8">
        <Cloud className="w-8 h-8 text-primary animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Texto animado */}
      <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground gradient-text">
            Subiendo {uploads.length} archivo{uploads.length !== 1 ? 's' : ''}...
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Por favor, no cierres esta ventana
          </p>
        </div>
      </div>
    </div>
  );
}

function SuccessAnimation() {
  return (
    <div className="relative">
      {/* Círculo de éxito con animación */}
      <div className="w-32 h-32 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 animate-bounce-in">
        <div className="w-28 h-28 rounded-full bg-background m-2 flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-500 animate-in zoom-in-50" />
        </div>
      </div>

      {/* Partículas de celebración */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-green-500 rounded-full animate-ping"
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-80px)`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}

      {/* Texto de éxito */}
      <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            ¡Archivos subidos exitosamente!
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Redirigiendo...
          </p>
        </div>
      </div>
    </div>
  );
}
