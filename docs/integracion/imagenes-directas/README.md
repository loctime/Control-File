# Imágenes Directas - Share Links

## Descripción
Sistema para mostrar imágenes directamente desde ControlFile usando share links especiales. Permite embeber imágenes en aplicaciones externas sin autenticación.

## 🚀 Características

- ✅ **Endpoint especial** para imágenes (`/api/shares/:token/image`)
- ✅ **Redirect directo** a Backblaze B2
- ✅ **Sin autenticación** requerida
- ✅ **Optimizado para `<img>` tags**
- ✅ **Caché de navegador** automático
- ✅ **Soporte para todos los formatos** de imagen

## 📋 Endpoint Principal

### GET /api/shares/:token/image

**Descripción:** Obtiene una imagen directamente para usar en `<img>` tags

**Parámetros:**
- `token` (string): Token del share link

**Respuesta:** Redirect 302 a URL presignada de Backblaze B2

**Headers de respuesta:**
```
Location: https://s3.us-west-004.backblazeb2.com/file/...
Cache-Control: public, max-age=3600
Content-Type: image/jpeg
```

## 💡 Ejemplos de Uso

### 1. Imagen Básica en HTML
```html
<!-- Usar directamente en img tag -->
<img src="https://files.controldoc.app/api/shares/abc123def456/image" 
     alt="Imagen compartida" 
     width="300" 
     height="200" />
```

### 2. Imagen con Fallback
```html
<img src="https://files.controldoc.app/api/shares/abc123def456/image" 
     alt="Imagen compartida"
     onerror="this.src='/default-image.png'" />
```

### 3. Imagen Responsiva
```html
<img src="https://files.controldoc.app/api/shares/abc123def456/image" 
     alt="Imagen compartida"
     class="w-full h-auto rounded-lg shadow-md" />
```

### 4. Componente React
```tsx
import { useState } from 'react';

interface SharedImageProps {
  token: string;
  alt: string;
  className?: string;
  fallback?: string;
}

export function SharedImage({ token, alt, className, fallback }: SharedImageProps) {
  const [error, setError] = useState(false);

  if (error && fallback) {
    return <img src={fallback} alt={alt} className={className} />;
  }

  return (
    <img
      src={`https://files.controldoc.app/api/shares/${token}/image`}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}

// Uso
<SharedImage 
  token="abc123def456" 
  alt="Imagen compartida"
  className="w-64 h-48 object-cover rounded"
  fallback="/default-image.png"
/>
```

### 5. Imagen con Lazy Loading
```tsx
import { useState, useRef, useEffect } from 'react';

export function LazySharedImage({ token, alt, className }: SharedImageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={className}>
      {isVisible ? (
        <img
          src={`https://files.controldoc.app/api/shares/${token}/image`}
          alt={alt}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}
```

### 6. Galería de Imágenes
```tsx
interface GalleryProps {
  imageTokens: string[];
}

export function SharedImageGallery({ imageTokens }: GalleryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {imageTokens.map((token, index) => (
        <SharedImage
          key={token}
          token={token}
          alt={`Imagen ${index + 1}`}
          className="w-full h-48 object-cover rounded-lg hover:scale-105 transition-transform"
          fallback="/placeholder-image.png"
        />
      ))}
    </div>
  );
}
```

## 🔧 Configuración

### Variables de Entorno
```bash
# Configuración de imágenes
IMAGE_CACHE_TTL=3600  # 1 hora en segundos
IMAGE_MAX_SIZE=10485760  # 10MB
IMAGE_ALLOWED_TYPES=image/jpeg,image/png,image/webp,image/gif
```

### Headers de Caché
```javascript
// Configuración recomendada para el endpoint
res.setHeader('Cache-Control', 'public, max-age=3600');
res.setHeader('Content-Type', mimeType);
res.redirect(302, presignedUrl);
```

## 🛡️ Seguridad

- **Tokens únicos**: Cada share tiene un token aleatorio
- **Expiración automática**: Los shares expiran según configuración
- **Validación de tipo**: Solo archivos de imagen
- **Sin autenticación**: Público pero controlado
- **URLs presignadas**: Acceso directo a Backblaze B2

## 📊 Casos de Uso

### 1. **Blogs y Sitios Web**
- Imágenes en artículos
- Galerías de fotos
- Contenido multimedia

### 2. **Aplicaciones Externas**
- Mostrar imágenes de ControlFile
- Integración con CMS
- Sistemas de contenido

### 3. **E-commerce**
- Imágenes de productos
- Galerías de catálogos
- Fotos promocionales

### 4. **Redes Sociales**
- Imágenes en posts
- Avatares y perfiles
- Contenido compartido

## 🔄 Flujo de Trabajo

1. **Usuario crea** share link para imagen
2. **Sistema genera** token único
3. **App externa** usa endpoint `/image`
4. **Sistema valida** token y tipo de archivo
5. **Redirect directo** a Backblaze B2
6. **Navegador muestra** imagen con caché

## 📚 Documentación Adicional

- [Ejemplos Detallados](./EJEMPLOS.md) - Más ejemplos de código
- [Respuestas y Errores](./RESPUESTA.md) - Manejo de errores
- [Share Links](../share-links/README.md) - Sistema completo de share links
- [API Reference](../../API_REFERENCE.md) - Referencia completa