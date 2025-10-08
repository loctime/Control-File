# Guía: Mostrar Imágenes Directamente desde Share Links

Esta guía explica cómo usar el endpoint `/api/shares/:token/image` para mostrar archivos compartidos directamente en aplicaciones externas.

## 🎯 Caso de Uso

Cuando tienes un enlace de compartido de ControlFile y necesitas:
- Mostrar una imagen directamente en un `<img>` tag
- Embeber archivos en tu aplicación sin redireccionar a la página de compartido
- Obtener una URL directa al archivo para previsualizaciones

## 📋 Endpoint

```
GET /api/shares/:token/image
```

### Características
- ✅ **Público**: No requiere autenticación
- ✅ **Redirect directo**: Redirige a Backblaze B2 con URL presignada
- ✅ **Larga duración**: URL válida por 1 hora (mejor para caching)
- ✅ **Contador automático**: Incrementa el contador de descargas
- ✅ **Sin CORS**: Funciona en cualquier dominio

## 💻 Ejemplos de Uso

### 1. HTML Simple

```html
<!-- Mostrar imagen directamente -->
<img 
  src="https://files.controldoc.app/api/shares/ky7pymrmm7o9w0e6ao97uv/image" 
  alt="Imagen compartida"
/>

<!-- PDF en iframe -->
<iframe 
  src="https://files.controldoc.app/api/shares/abc123xyz456/image"
  width="100%" 
  height="600px"
></iframe>

<!-- Video -->
<video controls>
  <source 
    src="https://files.controldoc.app/api/shares/video123/image" 
    type="video/mp4"
  />
</video>
```

### 2. React / Next.js

```tsx
// Componente simple
export function SharedImage({ shareToken }: { shareToken: string }) {
  const imageUrl = `https://files.controldoc.app/api/shares/${shareToken}/image`;
  
  return (
    <img 
      src={imageUrl} 
      alt="Imagen compartida"
      className="rounded-lg shadow-lg"
    />
  );
}

// Uso
<SharedImage shareToken="ky7pymrmm7o9w0e6ao97uv" />
```

### 3. Markdown (en documentación, blogs, etc.)

```markdown
![Imagen desde ControlFile](https://files.controldoc.app/api/shares/TOKEN/image)
```

### 4. JavaScript Dinámico

```javascript
// Obtener el token desde un enlace de compartido
const shareUrl = "https://files.controldoc.app/share/ky7pymrmm7o9w0e6ao97uv";
const shareToken = shareUrl.split('/share/')[1];

// Construir URL de imagen directa
const imageUrl = `https://files.controldoc.app/api/shares/${shareToken}/image`;

// Usar en elemento img
document.getElementById('myImage').src = imageUrl;
```

### 5. CSS Background

```css
.hero-section {
  background-image: url('https://files.controldoc.app/api/shares/TOKEN/image');
  background-size: cover;
  background-position: center;
}
```

### 6. Open Graph / Social Media

```html
<!-- Para compartir en redes sociales -->
<meta 
  property="og:image" 
  content="https://files.controldoc.app/api/shares/TOKEN/image"
/>

<meta 
  name="twitter:image" 
  content="https://files.controldoc.app/api/shares/TOKEN/image"
/>
```

## 🔄 Comparación con Otros Endpoints

### `/api/shares/:token` (GET)
- **Retorna**: JSON con metadata del archivo
- **Uso**: Obtener información antes de descargar
- **Ejemplo**:
  ```json
  {
    "fileName": "imagen.jpg",
    "fileSize": 1024000,
    "mime": "image/jpeg",
    "expiresAt": "2025-10-15T10:00:00Z",
    "downloadCount": 5
  }
  ```

### `/api/shares/:token/download` (POST)
- **Retorna**: JSON con `downloadUrl` temporal (5 minutos)
- **Uso**: Descargas programáticas
- **Ejemplo**:
  ```json
  {
    "downloadUrl": "https://s3.us-west-000.backblazeb2.com/...",
    "fileName": "archivo.pdf",
    "fileSize": 2048000
  }
  ```

### `/api/shares/:token/image` (GET) ✨ **NUEVO**
- **Retorna**: Redirect HTTP 302 al archivo
- **Uso**: Embeber directamente en HTML/CSS
- **Ventaja**: No requiere JavaScript, funciona en cualquier tag que acepte URLs

## 🔐 Seguridad

El endpoint valida automáticamente:
- ✅ Token existe en Firestore
- ✅ Enlace no está expirado
- ✅ Enlace no ha sido revocado
- ✅ Archivo no ha sido eliminado

Si alguna validación falla, retorna:
- `404` - Enlace no encontrado
- `410` - Enlace expirado o revocado

## ⚡ Performance y Caching

1. **Primera carga**: 
   - Backend verifica permisos
   - Genera URL presignada (válida 1 hora)
   - Redirect a Backblaze B2

2. **Cargas subsecuentes**:
   - Los navegadores pueden cachear el redirect
   - La URL presignada dura 1 hora
   - No afecta los contadores de descarga

## 🌐 Ejemplos por Dominio

### ControlFile (files.controldoc.app)
```
https://files.controldoc.app/api/shares/TOKEN/image
```

### ControlAudit
```
https://backend-controlaudit.com/api/shares/TOKEN/image
```

### ControlDoc
```
https://backend-controldoc.com/api/shares/TOKEN/image
```

## 📝 Notas Importantes

1. **Funciona con cualquier tipo de archivo**: imágenes, videos, PDFs, etc.
2. **El nombre `/image` es solo convención**: funciona con cualquier tipo MIME
3. **Contador de descargas**: Cada acceso incrementa el contador (igual que download)
4. **No hay límite de accesos**: Mientras el enlace esté activo
5. **Compatible con CDN**: La URL presignada puede ser cacheada por CDNs

## 🎨 Ejemplo Completo: Galería de Imágenes

```tsx
// app/gallery/page.tsx
'use client';

import { useState, useEffect } from 'react';

interface SharedImage {
  token: string;
  fileName: string;
  fileSize: number;
}

export default function GalleryPage() {
  const [images, setImages] = useState<SharedImage[]>([]);

  useEffect(() => {
    // Supongamos que tienes una API que devuelve tokens de imágenes compartidas
    async function loadImages() {
      const response = await fetch('/api/my-shared-images');
      const data = await response.json();
      setImages(data.images);
    }
    loadImages();
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4 p-8">
      {images.map((image) => (
        <div key={image.token} className="relative group">
          <img
            src={`https://files.controldoc.app/api/shares/${image.token}/image`}
            alt={image.fileName}
            className="w-full h-64 object-cover rounded-lg shadow-md 
                       group-hover:shadow-xl transition-shadow"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 
                          text-white p-2 rounded-b-lg opacity-0 
                          group-hover:opacity-100 transition-opacity">
            <p className="text-sm truncate">{image.fileName}</p>
            <p className="text-xs text-gray-300">
              {(image.fileSize / 1024).toFixed(0)} KB
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## 🚀 Integración con Otras Apps

### Desde ControlAudit

```typescript
// Mostrar imagen de evidencia desde ControlFile
const evidenceImage = {
  shareToken: 'ky7pymrmm7o9w0e6ao97uv',
  description: 'Evidencia fotográfica del incidente'
};

<div className="evidence-card">
  <img 
    src={`${process.env.CONTROLFILE_BACKEND}/api/shares/${evidenceImage.shareToken}/image`}
    alt={evidenceImage.description}
  />
  <p>{evidenceImage.description}</p>
</div>
```

### Desde ControlDoc

```typescript
// Previsualizar documento compartido
const document = {
  shareToken: 'abc123xyz456',
  name: 'Contrato de Servicios.pdf'
};

<div className="document-preview">
  <iframe
    src={`${process.env.CONTROLFILE_BACKEND}/api/shares/${document.shareToken}/image`}
    title={document.name}
    width="100%"
    height="800px"
    className="border rounded-lg"
  />
</div>
```

## 🔍 Debugging

Si las imágenes no cargan, verifica:

1. **Token válido**: Verifica que el token existe
   ```bash
   curl https://files.controldoc.app/api/shares/TOKEN
   ```

2. **Enlace activo**: Verifica que no esté expirado
   ```javascript
   const response = await fetch(`/api/shares/${token}`);
   const data = await response.json();
   console.log('Expires:', data.expiresAt);
   console.log('Active:', data.isActive);
   ```

3. **Permisos CORS**: El endpoint es público, pero verifica la consola del navegador

4. **Backend URL correcta**: Asegúrate de usar el dominio correcto
   - Producción: `https://files.controldoc.app`
   - Desarrollo: `http://localhost:3001`

## 📚 Recursos Adicionales

- [API Reference](../../API_REFERENCE.md) - Documentación completa de la API
- [Guía de Share Links](./GUIA_CONSUMIR_SHARE_LINKS.md) - Uso avanzado de enlaces compartidos
- [Integración con Apps Externas](./GUIA_INTEGRACION_APPS_EXTERNAS.md) - Conectar otras aplicaciones

---

¿Preguntas? Abre un issue o contacta al equipo de desarrollo.

