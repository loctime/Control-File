# ✅ Respuesta: Imágenes Directas desde Share Links

## 🎯 La Pregunta

> ¿Cómo puedo mostrar una imagen directamente desde un enlace de compartido (`/share/...`) en un `<img>` tag?
> ¿Existe un endpoint directo para obtener imágenes desde un share token?
> ¿Cuál es la forma correcta de convertir un enlace de compartido a una URL de imagen directa?

## ✅ La Respuesta Corta

**SÍ, ahora existe un endpoint directo:**

```html
<img src="https://files.controldoc.app/api/shares/TOKEN/image" alt="Imagen" />
```

## 📝 Conversión de URLs

De esto:
```
https://files.controldoc.app/share/ky7pymrmm7o9w0e6ao97uv
```

A esto:
```
https://files.controldoc.app/api/shares/ky7pymrmm7o9w0e6ao97uv/image
```

**Fórmula simple:** Reemplazar `/share/` por `/api/shares/` y agregar `/image` al final.

## 🚀 Ejemplos de Uso

### HTML Simple
```html
<img 
  src="https://files.controldoc.app/api/shares/ky7pymrmm7o9w0e6ao97uv/image" 
  alt="Imagen compartida"
/>
```

### React/Next.js
```tsx
export function SharedImage({ shareToken }: { shareToken: string }) {
  return (
    <img 
      src={`https://files.controldoc.app/api/shares/${shareToken}/image`}
      alt="Imagen compartida"
    />
  );
}
```

### JavaScript Dinámico
```javascript
// Extraer token de URL completa
const shareUrl = "https://files.controldoc.app/share/ky7pymrmm7o9w0e6ao97uv";
const token = shareUrl.split('/share/')[1];

// Construir URL de imagen
const imageUrl = `https://files.controldoc.app/api/shares/${token}/image`;

// Usar en elemento img
document.getElementById('myImage').src = imageUrl;
```

## ✨ Características

- ✅ **Público**: No requiere autenticación
- ✅ **Redirect directo**: Redirige a Backblaze B2
- ✅ **URL válida por 1 hora**: Suficiente para caching
- ✅ **Compatible con `<img>`, `<iframe>`, `<video>`**: Cualquier tag que acepte URLs
- ✅ **Funciona con cualquier tipo de archivo**: imágenes, PDFs, videos, etc.
- ✅ **Sin CORS**: Funciona en cualquier dominio

## 🔄 Comparación con Otros Métodos

### ❌ Método Anterior (NO funcionaba)
```javascript
// Esto NO funcionaba directamente en <img>
POST /api/shares/TOKEN/download
// Retorna JSON con downloadUrl temporal
```

### ✅ Método Nuevo (Funciona directamente)
```html
<!-- Funciona directamente -->
<img src="/api/shares/TOKEN/image" />
```

## 📚 Documentación Completa

- **Guía detallada**: [GUIA_IMAGENES_DIRECTAS.md](./GUIA_IMAGENES_DIRECTAS.md)
- **10 ejemplos prácticos**: [EJEMPLOS_IMAGENES_DIRECTAS.md](./EJEMPLOS_IMAGENES_DIRECTAS.md)
- **API Reference**: [API_REFERENCE.md](../../API_REFERENCE.md)

## 🎨 Casos de Uso

### 1. Galería de Imágenes
```html
<div class="gallery">
  <img src="https://files.controldoc.app/api/shares/TOKEN1/image" />
  <img src="https://files.controldoc.app/api/shares/TOKEN2/image" />
  <img src="https://files.controldoc.app/api/shares/TOKEN3/image" />
</div>
```

### 2. Vista Previa de PDF
```html
<iframe 
  src="https://files.controldoc.app/api/shares/TOKEN/image"
  width="100%" 
  height="600px"
></iframe>
```

### 3. Background CSS
```css
.hero {
  background-image: url('https://files.controldoc.app/api/shares/TOKEN/image');
}
```

### 4. Open Graph (Redes Sociales)
```html
<meta 
  property="og:image" 
  content="https://files.controldoc.app/api/shares/TOKEN/image"
/>
```

## 🔐 Seguridad

El endpoint valida automáticamente:
- ✅ Token existe
- ✅ Enlace no expirado
- ✅ Enlace no revocado
- ✅ Archivo no eliminado

Si algo falla:
- `404` - Token no encontrado
- `410` - Enlace expirado o revocado

## ⚙️ Implementación Técnica

### Backend (Node.js/Express)
```javascript
// backend/src/routes/shares.js
router.get('/:token/image', async (req, res) => {
  // 1. Validar token
  // 2. Verificar expiración
  // 3. Generar URL presignada (1 hora)
  // 4. Redirect a Backblaze B2
  res.redirect(downloadUrl);
});
```

### Frontend (Next.js)
```typescript
// app/api/shares/[token]/image/route.ts
export async function GET(req, { params }) {
  const response = await fetch(`${backend}/api/shares/${params.token}/image`);
  return NextResponse.redirect(response.headers.get('location'));
}
```

## 🎁 Bonus: Función Utilitaria

```typescript
/**
 * Convierte URL de share a URL de imagen directa
 */
export function shareUrlToImageUrl(shareUrl: string): string {
  const token = shareUrl.split('/share/')[1];
  const baseUrl = shareUrl.split('/share/')[0];
  return `${baseUrl}/api/shares/${token}/image`;
}

// Uso
const imageUrl = shareUrlToImageUrl(
  "https://files.controldoc.app/share/ky7pymrmm7o9w0e6ao97uv"
);
// => "https://files.controldoc.app/api/shares/ky7pymrmm7o9w0e6ao97uv/image"
```

## ✅ Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿Endpoint directo? | ✅ Sí: `GET /api/shares/:token/image` |
| ¿Funciona en `<img>`? | ✅ Sí, directamente |
| ¿Requiere JavaScript? | ❌ No, funciona con HTML puro |
| ¿Requiere auth? | ❌ No, es público |
| ¿Compatible con CORS? | ✅ Sí, funciona en cualquier dominio |
| ¿Válido por cuánto tiempo? | ⏱️ 1 hora (renovable automáticamente) |

## 🚀 Implementación Inmediata

**Para tu equipo:**

1. **Backend ya implementado** ✅
   - Endpoint: `GET /api/shares/:token/image`
   - Ubicación: `backend/src/routes/shares.js` (línea 169)
   - Next.js: `app/api/shares/[token]/image/route.ts`

2. **Documentación creada** ✅
   - Guía completa con ejemplos
   - 10 casos de uso reales
   - Código listo para copiar

3. **Listo para usar** ✅
   - No requiere configuración adicional
   - Funciona con tokens existentes
   - Compatible con todos los shares activos

## 📞 Siguiente Paso

**Lee la guía completa**: [GUIA_IMAGENES_DIRECTAS.md](./GUIA_IMAGENES_DIRECTAS.md)

**O copia directamente los ejemplos**: [EJEMPLOS_IMAGENES_DIRECTAS.md](./EJEMPLOS_IMAGENES_DIRECTAS.md)

---

**¿Preguntas?** Revisa la documentación completa o contacta al equipo de desarrollo.

**Fecha de implementación**: Octubre 2025  
**Estado**: ✅ Listo para producción

