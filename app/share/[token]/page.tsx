'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Download, Calendar, FileText, AlertCircle } from 'lucide-react';

interface ShareInfo {
  fileName: string;
  fileSize: number;
  mime: string;
  expiresAt: string;
  downloadCount: number;
}

interface DownloadInfo {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [downloadInfo, setDownloadInfo] = useState<DownloadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (token) {
      loadShareInfo();
    }
  }, [token]);

  const loadShareInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/shares/${token}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Enlace de compartir no encontrado');
        } else if (response.status === 410) {
          setError('Enlace expirado o revocado');
        } else {
          setError('Error al cargar la información del archivo');
        }
        return;
      }

      const data = await response.json();
      setShareInfo(data);
    } catch (err) {
      console.error('Error loading share info:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      
      const response = await fetch(`/api/shares/${token}/download`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al obtener el archivo');
      }

      const data = await response.json();
      setDownloadInfo(data);

      // Crear enlace de descarga temporal
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Error al descargar el archivo');
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isImage = (mime: string) => {
    return mime.startsWith('image/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Cargando archivo compartido...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="mb-6">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
            <p className="text-gray-600">{error}</p>
          </div>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!shareInfo) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white p-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">Archivo compartido</h1>
                <p className="text-blue-100">ControlFile</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-8">
              {/* File Info */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Información del archivo</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del archivo
                    </label>
                    <p className="text-gray-900 font-mono bg-gray-50 p-2 rounded">
                      {shareInfo.fileName}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tamaño
                    </label>
                    <p className="text-gray-900">{formatFileSize(shareInfo.fileSize)}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de archivo
                    </label>
                    <p className="text-gray-900">{shareInfo.mime}</p>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Expira el {formatDate(shareInfo.expiresAt)}</span>
                  </div>

                  <div className="text-sm text-gray-600">
                    Descargas: {shareInfo.downloadCount}
                  </div>
                </div>
              </div>

              {/* Preview/Download */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Vista previa</h2>
                
                {isImage(shareInfo.mime) && downloadInfo ? (
                  <div className="mb-4">
                    <img 
                      src={downloadInfo.downloadUrl}
                      alt={shareInfo.fileName}
                      className="max-w-full h-auto rounded-lg border shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      {isImage(shareInfo.mime) 
                        ? 'Haz clic en "Descargar" para ver la imagen'
                        : 'Vista previa no disponible para este tipo de archivo'
                      }
                    </p>
                  </div>
                )}

                <Button 
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full"
                  size="lg"
                >
                  <Download className="h-5 w-5 mr-2" />
                  {downloading ? 'Preparando descarga...' : 'Descargar archivo'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Archivo compartido desde ControlFile</p>
        </div>
      </div>
    </div>
  );
}
