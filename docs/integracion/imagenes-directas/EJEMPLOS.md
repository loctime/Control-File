# Ejemplos Prácticos: Imágenes Directas desde Share Links

Ejemplos listos para copiar y pegar del nuevo endpoint `/api/shares/:token/image`

## 🖼️ Ejemplo 1: Galería Simple

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Galería de Imágenes - ControlFile</title>
    <style>
        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        .gallery img {
            width: 100%;
            height: 300px;
            object-fit: cover;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }
        .gallery img:hover {
            transform: scale(1.05);
        }
    </style>
</head>
<body>
    <div class="gallery">
        <img src="https://files.controldoc.app/api/shares/TOKEN1/image" alt="Imagen 1">
        <img src="https://files.controldoc.app/api/shares/TOKEN2/image" alt="Imagen 2">
        <img src="https://files.controldoc.app/api/shares/TOKEN3/image" alt="Imagen 3">
    </div>
</body>
</html>
```

## 📄 Ejemplo 2: Visor de PDFs

```typescript
// components/PDFViewer.tsx
'use client';

interface PDFViewerProps {
  shareToken: string;
  title?: string;
}

export function PDFViewer({ shareToken, title = 'Documento' }: PDFViewerProps) {
  const pdfUrl = `https://files.controldoc.app/api/shares/${shareToken}/image`;
  
  return (
    <div className="w-full h-screen flex flex-col">
      <div className="bg-gray-800 text-white p-4">
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <iframe
        src={pdfUrl}
        className="flex-1 w-full border-0"
        title={title}
      />
    </div>
  );
}

// Uso
<PDFViewer 
  shareToken="abc123xyz456" 
  title="Contrato de Servicios.pdf"
/>
```

## 🎬 Ejemplo 3: Reproductor de Video

```tsx
// components/VideoPlayer.tsx
'use client';

import { useState } from 'react';

interface VideoPlayerProps {
  shareToken: string;
  poster?: string; // Token de imagen de miniatura
}

export function VideoPlayer({ shareToken, poster }: VideoPlayerProps) {
  const [error, setError] = useState(false);
  
  const videoUrl = `https://files.controldoc.app/api/shares/${shareToken}/image`;
  const posterUrl = poster 
    ? `https://files.controldoc.app/api/shares/${poster}/image`
    : undefined;

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Error al cargar el video
      </div>
    );
  }

  return (
    <video
      controls
      className="w-full rounded-lg shadow-lg"
      poster={posterUrl}
      onError={() => setError(true)}
    >
      <source src={videoUrl} type="video/mp4" />
      Tu navegador no soporta el tag de video.
    </video>
  );
}

// Uso
<VideoPlayer 
  shareToken="video123token" 
  poster="thumbnail456token"
/>
```

## 📊 Ejemplo 4: ControlAudit - Evidencias Fotográficas

```typescript
// app/audits/[id]/evidences/page.tsx
'use client';

import { useState, useEffect } from 'react';

interface Evidence {
  id: string;
  shareToken: string;
  description: string;
  uploadedAt: string;
  uploadedBy: string;
}

export default function EvidencesPage({ params }: { params: { id: string } }) {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);

  useEffect(() => {
    // Cargar evidencias desde tu API
    fetch(`/api/audits/${params.id}/evidences`)
      .then(res => res.json())
      .then(data => setEvidences(data.evidences));
  }, [params.id]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Evidencias Fotográficas</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {evidences.map((evidence) => (
          <div
            key={evidence.id}
            className="cursor-pointer group"
            onClick={() => setSelectedEvidence(evidence)}
          >
            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
              <img
                src={`https://files.controldoc.app/api/shares/${evidence.shareToken}/image`}
                alt={evidence.description}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
              />
            </div>
            <p className="mt-2 text-sm text-gray-600 truncate">
              {evidence.description}
            </p>
          </div>
        ))}
      </div>

      {/* Modal de vista ampliada */}
      {selectedEvidence && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEvidence(null)}
        >
          <div className="bg-white rounded-lg max-w-4xl w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{selectedEvidence.description}</h3>
                <p className="text-sm text-gray-600">
                  Subido por {selectedEvidence.uploadedBy} el{' '}
                  {new Date(selectedEvidence.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvidence(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <img
              src={`https://files.controldoc.app/api/shares/${selectedEvidence.shareToken}/image`}
              alt={selectedEvidence.description}
              className="w-full rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

## 📝 Ejemplo 5: ControlDoc - Vista Previa de Documentos

```typescript
// components/DocumentPreview.tsx
'use client';

import { useState, useEffect } from 'react';

interface DocumentPreviewProps {
  shareToken: string;
  documentName: string;
}

export function DocumentPreview({ shareToken, documentName }: DocumentPreviewProps) {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener metadata del documento
    fetch(`https://files.controldoc.app/api/shares/${shareToken}`)
      .then(res => res.json())
      .then(data => {
        setMetadata(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading metadata:', err);
        setLoading(false);
      });
  }, [shareToken]);

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />;
  }

  const imageUrl = `https://files.controldoc.app/api/shares/${shareToken}/image`;
  const isImage = metadata?.mime?.startsWith('image/');
  const isPDF = metadata?.mime === 'application/pdf';

  return (
    <div className="border rounded-lg overflow-hidden shadow-lg">
      {/* Header con información */}
      <div className="bg-blue-600 text-white p-4">
        <h3 className="font-bold text-lg">{documentName}</h3>
        <div className="text-sm opacity-90 mt-1">
          <span>{metadata?.mime}</span>
          {' • '}
          <span>{(metadata?.fileSize / 1024).toFixed(0)} KB</span>
          {' • '}
          <span>{metadata?.downloadCount} descargas</span>
        </div>
      </div>

      {/* Contenido del documento */}
      <div className="bg-gray-50">
        {isImage && (
          <img
            src={imageUrl}
            alt={documentName}
            className="w-full h-auto"
          />
        )}
        
        {isPDF && (
          <iframe
            src={imageUrl}
            className="w-full h-[600px]"
            title={documentName}
          />
        )}
        
        {!isImage && !isPDF && (
          <div className="p-8 text-center">
            <p className="text-gray-600 mb-4">
              Vista previa no disponible para este tipo de archivo
            </p>
            <a
              href={imageUrl}
              download
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Descargar {documentName}
            </a>
          </div>
        )}
      </div>

      {/* Footer con acciones */}
      <div className="bg-gray-100 p-4 flex gap-2">
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50"
        >
          Abrir en nueva pestaña
        </a>
        <a
          href={imageUrl}
          download={documentName}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Descargar
        </a>
      </div>
    </div>
  );
}

// Uso
<DocumentPreview 
  shareToken="doc123token" 
  documentName="Reporte Mensual.pdf"
/>
```

## 🔄 Ejemplo 6: Conversión de URLs de Share a Image

```typescript
// utils/shareUrl.ts

/**
 * Convierte una URL de share completa a URL de imagen directa
 */
export function shareUrlToImageUrl(shareUrl: string): string {
  // Extraer el token de la URL
  const match = shareUrl.match(/\/share\/([a-z0-9]+)/i);
  if (!match) {
    throw new Error('URL de share inválida');
  }
  
  const token = match[1];
  const baseUrl = shareUrl.split('/share/')[0];
  
  return `${baseUrl}/api/shares/${token}/image`;
}

/**
 * Extrae el token de una URL de share
 */
export function extractShareToken(shareUrl: string): string {
  const match = shareUrl.match(/\/share\/([a-z0-9]+)/i);
  if (!match) {
    throw new Error('URL de share inválida');
  }
  return match[1];
}

// Ejemplos de uso
const shareUrl = "https://files.controldoc.app/share/ky7pymrmm7o9w0e6ao97uv";

const imageUrl = shareUrlToImageUrl(shareUrl);
// => "https://files.controldoc.app/api/shares/ky7pymrmm7o9w0e6ao97uv/image"

const token = extractShareToken(shareUrl);
// => "ky7pymrmm7o9w0e6ao97uv"

// Usar en un componente
function ShareImage({ shareUrl }: { shareUrl: string }) {
  const imageUrl = shareUrlToImageUrl(shareUrl);
  return <img src={imageUrl} alt="Shared" />;
}
```

## 📱 Ejemplo 7: Lista Responsiva con Lazy Loading

```tsx
// components/ResponsiveGallery.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface GalleryImage {
  shareToken: string;
  title: string;
  description?: string;
}

interface ResponsiveGalleryProps {
  images: GalleryImage[];
}

export function ResponsiveGallery({ images }: ResponsiveGalleryProps) {
  const [visibleImages, setVisibleImages] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const token = entry.target.getAttribute('data-token');
            if (token) {
              setVisibleImages(prev => new Set([...prev, token]));
            }
          }
        });
      },
      { rootMargin: '50px' }
    );

    return () => observerRef.current?.disconnect();
  }, []);

  const setImageRef = (element: HTMLDivElement | null, token: string) => {
    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {images.map((image) => (
        <div
          key={image.shareToken}
          ref={(el) => setImageRef(el, image.shareToken)}
          data-token={image.shareToken}
          className="aspect-square bg-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow"
        >
          {visibleImages.has(image.shareToken) ? (
            <img
              src={`https://files.controldoc.app/api/shares/${image.shareToken}/image`}
              alt={image.title}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}
          <div className="p-3 bg-white">
            <h3 className="font-semibold truncate">{image.title}</h3>
            {image.description && (
              <p className="text-sm text-gray-600 truncate">{image.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Uso
const myImages: GalleryImage[] = [
  { shareToken: 'token1', title: 'Imagen 1', description: 'Descripción' },
  { shareToken: 'token2', title: 'Imagen 2' },
  // ... más imágenes
];

<ResponsiveGallery images={myImages} />
```

## 🎨 Ejemplo 8: Background Dinámico

```typescript
// components/HeroSection.tsx
'use client';

interface HeroSectionProps {
  backgroundShareToken: string;
  title: string;
  subtitle: string;
}

export function HeroSection({ backgroundShareToken, title, subtitle }: HeroSectionProps) {
  const bgUrl = `https://files.controldoc.app/api/shares/${backgroundShareToken}/image`;
  
  return (
    <div
      className="relative h-screen flex items-center justify-center text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${bgUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">{title}</h1>
        <p className="text-2xl">{subtitle}</p>
      </div>
    </div>
  );
}

// Uso
<HeroSection 
  backgroundShareToken="hero123token"
  title="Bienvenido a ControlAudit"
  subtitle="Sistema de gestión de auditorías"
/>
```

## 🔐 Ejemplo 9: Verificación de Estado antes de Mostrar

```typescript
// components/SafeImage.tsx
'use client';

import { useState, useEffect } from 'react';

interface SafeImageProps {
  shareToken: string;
  alt: string;
  className?: string;
}

export function SafeImage({ shareToken, alt, className }: SafeImageProps) {
  const [status, setStatus] = useState<'loading' | 'valid' | 'expired' | 'error'>('loading');
  const [metadata, setMetadata] = useState<any>(null);

  useEffect(() => {
    // Verificar estado del share antes de mostrar
    fetch(`https://files.controldoc.app/api/shares/${shareToken}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setMetadata(data);
          setStatus('valid');
        } else if (res.status === 410) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [shareToken]);

  if (status === 'loading') {
    return (
      <div className={`bg-gray-200 animate-pulse ${className}`}>
        <div className="flex items-center justify-center h-full">
          Cargando...
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className={`bg-yellow-100 border-2 border-yellow-400 ${className}`}>
        <div className="flex items-center justify-center h-full text-yellow-800">
          ⚠️ Enlace expirado
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`bg-red-100 border-2 border-red-400 ${className}`}>
        <div className="flex items-center justify-center h-full text-red-800">
          ❌ Error al cargar
        </div>
      </div>
    );
  }

  // Solo mostrar si el estado es válido
  return (
    <img
      src={`https://files.controldoc.app/api/shares/${shareToken}/image`}
      alt={alt}
      className={className}
      title={`${metadata.fileName} - ${metadata.downloadCount} descargas`}
    />
  );
}

// Uso
<SafeImage 
  shareToken="token123" 
  alt="Descripción" 
  className="w-full h-64 object-cover rounded-lg"
/>
```

## 📊 Ejemplo 10: Dashboard con Estadísticas

```typescript
// app/dashboard/shared-files/page.tsx
'use client';

import { useState, useEffect } from 'react';

interface SharedFile {
  token: string;
  fileName: string;
  fileSize: number;
  mime: string;
  expiresAt: string;
  downloadCount: number;
  createdAt: string;
}

export default function SharedFilesDashboard() {
  const [files, setFiles] = useState<SharedFile[]>([]);

  useEffect(() => {
    // Obtener lista de archivos compartidos (requiere autenticación)
    fetch('/api/shares', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('idToken')}`
      }
    })
      .then(res => res.json())
      .then(data => setFiles(data.shares));
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Archivos Compartidos</h1>
      
      <div className="grid gap-4">
        {files.map((file) => {
          const isExpired = new Date(file.expiresAt) < new Date();
          const isImage = file.mime.startsWith('image/');
          
          return (
            <div
              key={file.token}
              className="flex gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              {/* Miniatura */}
              {isImage && !isExpired && (
                <div className="w-24 h-24 flex-shrink-0">
                  <img
                    src={`https://files.controldoc.app/api/shares/${file.token}/image`}
                    alt={file.fileName}
                    className="w-full h-full object-cover rounded"
                  />
                </div>
              )}
              
              {/* Información */}
              <div className="flex-1">
                <h3 className="font-bold text-lg">{file.fileName}</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Tamaño: {(file.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                  <p>Tipo: {file.mime}</p>
                  <p>Descargas: {file.downloadCount}</p>
                  <p className={isExpired ? 'text-red-600 font-semibold' : ''}>
                    {isExpired ? '⚠️ Expirado' : `Expira: ${new Date(file.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              
              {/* Acciones */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `https://files.controldoc.app/api/shares/${file.token}/image`
                    );
                    alert('URL copiada');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Copiar URL
                </button>
                <a
                  href={`https://files.controldoc.app/share/${file.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-200 text-center rounded hover:bg-gray-300"
                >
                  Ver página
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 🎯 Casos de Uso Reales

### ControlAudit
- Galería de evidencias fotográficas en auditorías
- Visualización de documentos adjuntos
- Reportes con imágenes embebidas

### ControlDoc
- Vista previa de contratos PDF
- Galería de logos/documentos empresariales
- Sistema de firmas digitales con visualización

### ControlFile
- Compartir archivos en redes sociales
- Embeber en landing pages
- Integración con sistemas externos

---

¿Más ejemplos? Contribuye con tus propios casos de uso!

