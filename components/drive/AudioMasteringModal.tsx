'use client';

import { useState } from 'react';
import { Music, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useUIStore } from '@/lib/stores/ui';
import { useQueryInvalidation } from '@/hooks/useQueryInvalidation';
import { getAuth } from 'firebase/auth';

interface AudioMasteringModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  fileSize: number;
}

type MasteringAction = 'create' | 'replace';

interface MasteringResult {
  success: boolean;
  message: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  action?: string;
}

export function AudioMasteringModal({ 
  isOpen, 
  onClose, 
  fileId, 
  fileName, 
  fileSize 
}: AudioMasteringModalProps) {
  const [selectedAction, setSelectedAction] = useState<MasteringAction>('create');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<MasteringResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { addToast } = useUIStore();
  const { invalidateFiles } = useQueryInvalidation();

  const handleMasterAudio = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      setResult(null);

      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No autenticado');
      }

      const token = await currentUser.getIdToken();

      addToast({
        type: 'info',
        title: 'Procesando audio...',
        message: 'Masterizando archivo con FFmpeg'
      });

      const response = await fetch('/api/audio/master', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId,
          action: selectedAction
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en el procesamiento');
      }

      setResult(data);

      // Show success message
      const actionText = selectedAction === 'create' ? 'creado' : 'reemplazado';
      addToast({
        type: 'success',
        title: 'Audio masterizado',
        message: `Archivo ${actionText} exitosamente`
      });

      // Refresh file list
      invalidateFiles();

    } catch (error: any) {
      console.error('Error mastering audio:', error);
      setError(error.message);
      addToast({
        type: 'error',
        title: 'Error de masterización',
        message: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setResult(null);
      setError(null);
      setSelectedAction('create');
      onClose();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Masterizar Audio
          </DialogTitle>
          <DialogDescription>
            Aplicar masterización profesional con normalización de loudness (-14 LUFS)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-2">Archivo seleccionado:</h4>
            <p className="text-sm font-mono break-all">{fileName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatFileSize(fileSize)}
            </p>
          </div>

          {/* Processing State */}
          {isProcessing && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Procesando con FFmpeg...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Esto puede tomar unos minutos
                </p>
              </div>
            </div>
          )}

          {/* Success State */}
          {result && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm font-medium text-green-700">
                  ¡Masterización completada!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {result.message}
                </p>
                {result.fileName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Archivo: {result.fileName}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                <p className="text-sm font-medium text-red-700">
                  Error en la masterización
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Action Selection - Only show if not processing and no result/error */}
          {!isProcessing && !result && !error && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">
                  ¿Qué hacer con el archivo masterizado?
                </Label>
                <RadioGroup
                  value={selectedAction}
                  onValueChange={(value) => setSelectedAction(value as MasteringAction)}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="create" id="create" />
                    <Label htmlFor="create" className="text-sm">
                      Crear nuevo archivo masterizado
                      <span className="block text-xs text-muted-foreground">
                        Mantiene el original y crea una copia masterizada
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="replace" id="replace" />
                    <Label htmlFor="replace" className="text-sm">
                      Reemplazar archivo original
                      <span className="block text-xs text-muted-foreground">
                        Sobrescribe el archivo original con la versión masterizada
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Configuración de masterización:
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Loudness: -14 LUFS (estándar streaming)</li>
                  <li>• True Peak: -1.5 dB (evita clipping)</li>
                  <li>• LRA: 11 LU (rango dinámico)</li>
                </ul>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            {result || error ? (
              <Button onClick={handleClose} variant="outline">
                Cerrar
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleClose} 
                  variant="outline"
                  disabled={isProcessing}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleMasterAudio}
                  disabled={isProcessing}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Music className="h-4 w-4 mr-2" />
                      Masterizar
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
