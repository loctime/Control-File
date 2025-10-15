'use client';

import { useMemo } from 'react';
import { 
  File,
  Folder,
  Share2,
  Download,
  Trash2,
  X,
  FileText,
  FileSearch
} from 'lucide-react';
import { formatFileSize, formatDate } from '@/lib/utils';
import { useDriveStore } from '@/lib/stores/drive';
import { useUIStore } from '@/lib/stores/ui';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { getAuth } from 'firebase/auth';
import { FilePreview } from '@/components/drive/details/FilePreview';

// Vista previa extraída a componente dedicado

export function DetailsPanel() {
  const { items, selectedItems } = useDriveStore();
  const { toggleDetailsPanel, addToast } = useUIStore();

  const selectedFiles = useMemo(() => {
    return items.filter(item => selectedItems.includes(item.id));
  }, [items, selectedItems]);

  const downloadViaProxy = async (fileId: string, fileName: string) => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        addToast({ type: 'error', title: 'No autenticado', message: 'Inicia sesión para descargar' });
        return;
      }
      const token = await currentUser.getIdToken();
      const resp = await fetch('/api/files/proxy-download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'archivo';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Descarga fallida', message: e?.message || 'Intenta de nuevo' });
    }
  };

  const handleOCR = async (fileId: string) => {
    try {
      addToast({ type: 'info', title: 'Procesando...', message: 'Extrayendo texto del archivo' });
      
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch('/api/files/ocr', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileId })
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al extraer texto');
      }
      
      const result = await response.json();
      addToast({ 
        type: 'success', 
        title: 'Texto extraído', 
        message: `${result.text.length} caracteres encontrados` 
      });
      
      // Refrescar datos
      window.location.reload();
      
    } catch (error: any) {
      addToast({ type: 'error', title: 'Error', message: error.message });
    }
  };

  const handleConvertToPDF = async (fileId: string) => {
    try {
      addToast({ type: 'info', title: 'Convirtiendo...', message: 'Creando archivo PDF' });
      
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch('/api/files/convert-to-pdf', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileId })
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al convertir');
      }
      
      const result = await response.json();
      addToast({ 
        type: 'success', 
        title: 'Convertido', 
        message: `Creado: ${result.fileName}` 
      });
      
      // Refrescar datos
      window.location.reload();
      
    } catch (error: any) {
      addToast({ type: 'error', title: 'Error', message: error.message });
    }
  };

  if (selectedFiles.length === 0) {
    return (
             <div className="h-full flex flex-col">
         {/* Header */}
         <div className="flex items-center justify-between p-3 border-b">
           <h3 className="font-semibold text-sm">Detalles</h3>
           <Button variant="ghost" size="sm" onClick={toggleDetailsPanel} className="h-8 w-8 p-0">
             <X className="h-4 w-4" />
           </Button>
         </div>

         {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground">
            <File className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Selecciona un elemento para ver sus detalles</p>
          </div>
        </div>
      </div>
    );
  }

  if (selectedFiles.length > 1) {
    const totalSize = selectedFiles.reduce((sum, file) => {
      if (file.type === 'file') {
        return sum + (file.size || 0);
      }
      return sum;
    }, 0);
    const fileCount = selectedFiles.filter(f => f.type === 'file').length;
    const folderCount = selectedFiles.filter(f => f.type === 'folder').length;

    return (
             <div className="h-full flex flex-col">
         {/* Header */}
         <div className="flex items-center justify-between p-3 border-b">
           <h3 className="font-semibold text-sm">Detalles</h3>
           <Button variant="ghost" size="sm" onClick={toggleDetailsPanel} className="h-8 w-8 p-0">
             <X className="h-4 w-4" />
           </Button>
         </div>

         {/* Multiple selection info */}
        <div className="p-4 space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <File className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{selectedFiles.length} elementos</span>
            </div>
          </div>

          <div className="space-y-2">
            {fileCount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Archivos:</span>
                <span>{fileCount}</span>
              </div>
            )}
            {folderCount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Carpetas:</span>
                <span>{folderCount}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-medium">
              <span>Tamaño total:</span>
              <span>{formatFileSize(totalSize)}</span>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={async () => {
                try {
                  const auth = getAuth();
                  const currentUser = auth.currentUser;
                  if (!currentUser) {
                    addToast({ type: 'error', title: 'No autenticado', message: 'Inicia sesión para descargar' });
                    return;
                  }
                  const token = await currentUser.getIdToken();
                  const fileIds = selectedFiles.filter(f => f.type === 'file').map(f => f.id);
                  if (fileIds.length === 0) return;
                  const resp = await fetch('/api/files/zip', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ fileIds, zipName: 'archivos' }),
                  });
                  if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || `Error ${resp.status}`);
                  }
                  const blob = await resp.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `archivos-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch (e: any) {
                  addToast({ type: 'error', title: 'ZIP falló', message: e?.message || 'Intenta de nuevo' });
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar como ZIP
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Share2 className="mr-2 h-4 w-4" />
              Compartir
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Single item selected
  const item = selectedFiles[0];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Detalles</h3>
          {item.type === 'file' && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {item.mime?.split('/')[0] || 'Archivo'}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={toggleDetailsPanel} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Preview */}
        <div className="p-4">
          {item.type === 'file' ? (
                         <div className="space-y-3">
               <FilePreview file={item} />
               
               {/* Name */}
               <h4 className="font-semibold break-words">{item.name}</h4>
               
               {/* Tags */}
               <div className="flex gap-2">
                 {item.type === 'file' && item.isShared && (
                   <Badge variant="outline">
                     <Share2 className="mr-1 h-3 w-3" />
                     Compartido
                   </Badge>
                 )}
               </div>

               {/* Actions */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {item.type === 'file' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 justify-center"
                      onClick={() => downloadViaProxy(item.id, item.name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button variant="outline" size="sm" className="flex-1 justify-center">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  
                  <Button variant="outline" size="sm" className="flex-1 justify-center text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* OCR Button - solo para imágenes/PDFs */}
                {item.type === 'file' && (item.mime?.startsWith('image/') || item.mime === 'application/pdf') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOCR(item.id)}
                    className="w-full justify-start"
                  >
                    <FileSearch className="h-4 w-4 mr-2" />
                    Extraer texto (OCR)
                  </Button>
                )}

                {/* Convert to PDF - solo para Office */}
                {item.type === 'file' && (
                  item.mime?.includes('wordprocessing') || 
                  item.mime?.includes('spreadsheet') || 
                  item.mime?.includes('presentation')
                ) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConvertToPDF(item.id)}
                    className="w-full justify-start"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Convertir a PDF
                  </Button>
                )}
              </div>

              {/* Mostrar texto OCR si existe */}
              {item.type === 'file' && (item as any).ocr?.processed && (
                <div className="mt-4 p-3 bg-muted/30 rounded text-xs">
                  <p className="font-semibold mb-1">Texto extraído:</p>
                  <p className="line-clamp-6">{(item as any).ocr.text}</p>
                </div>
              )}
            </div>
          ) : (
                         <div className="space-y-3">
               <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
                 <div className="text-center">
                   <Folder className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                   <span className="text-sm text-muted-foreground">Carpeta</span>
                 </div>
               </div>
               
               {/* Name */}
               <h4 className="font-semibold break-words">{item.name}</h4>
               
               {/* Tags */}
               <div className="flex gap-2">
                 {item.type === 'file' && item.isShared && (
                   <Badge variant="outline">
                     <Share2 className="mr-1 h-3 w-3" />
                     Compartido
                   </Badge>
                 )}
               </div>

               {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 justify-center">
                  <Share2 className="h-4 w-4" />
                </Button>
                
                <Button variant="outline" size="sm" className="flex-1 justify-center text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Properties */}
        <div className="p-4 space-y-3">
          <div className="space-y-2 text-sm">
            {item.type === 'file' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tamaño:</span>
                <span>{formatFileSize(item.size || 0)}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creado:</span>
              <span>{formatDate(item.createdAt)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modificado:</span>
              <span>{formatDate(item.modifiedAt || item.createdAt)}</span>
            </div>
            
            {item.type === 'file' && item.mime && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-mono text-xs">{item.mime}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
