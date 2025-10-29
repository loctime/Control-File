# Share Links - Enlaces Públicos de ControlFile

## Descripción
Sistema de enlaces públicos para compartir archivos de ControlFile sin autenticación. Los enlaces tienen expiración configurable y control de acceso.

## 🚀 Características

- ✅ **Enlaces públicos** sin autenticación requerida
- ✅ **Expiración configurable** (1 hora a 7 días)
- ✅ **Control de acceso** por token único
- ✅ **Contador de descargas** opcional
- ✅ **URLs presignadas** para descarga directa
- ✅ **Soporte para imágenes** con endpoint especial

## 📋 Endpoints Disponibles

### 1. Crear Share Link
```http
POST /api/shares/create
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json

{
  "fileId": "archivo123",
  "expiresIn": 3600, // Segundos (opcional, default: 1 hora)
  "maxDownloads": 10 // Opcional, sin límite por defecto
}
```

**Respuesta:**
```json
{
  "success": true,
  "shareToken": "abc123def456",
  "shareUrl": "https://files.controldoc.app/share/abc123def456",
  "expiresAt": "2025-10-30T10:00:00Z",
  "maxDownloads": 10
}
```

### 2. Obtener Información del Share
```http
GET /api/shares/:token/info
```

**Respuesta:**
```json
{
  "fileId": "archivo123",
  "fileName": "documento.pdf",
  "fileSize": 1024000,
  "mimeType": "application/pdf",
  "expiresAt": "2025-10-30T10:00:00Z",
  "downloadsLeft": 8,
  "maxDownloads": 10,
  "createdAt": "2025-10-29T10:00:00Z"
}
```

### 3. Descargar Archivo
```http
GET /api/shares/:token/download
```

**Respuesta:** Redirect a URL presignada de Backblaze B2

### 4. Obtener Imagen (Especial)
```http
GET /api/shares/:token/image
```

**Respuesta:** Redirect directo a imagen para usar en `<img>` tags

## 🔧 Configuración

### Variables de Entorno
```bash
# Configuración de share links
SHARE_LINK_DEFAULT_EXPIRY=3600  # 1 hora en segundos
SHARE_LINK_MAX_EXPIRY=604800    # 7 días en segundos
```

### Firestore Rules
```javascript
// Reglas para colección shares
match /shares/{token} {
  allow read: if true; // Público
  allow write: if request.auth != null; // Solo autenticados pueden crear
}
```

## 💡 Ejemplos de Uso

### Crear y Compartir Archivo
```javascript
// 1. Crear share link
const shareResponse = await fetch('/api/shares/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileId: 'archivo123',
    expiresIn: 3600, // 1 hora
    maxDownloads: 5
  })
});

const { shareToken, shareUrl } = await shareResponse.json();

// 2. Compartir URL
console.log('Compartir:', shareUrl);
// https://files.controldoc.app/share/abc123def456
```

### Mostrar Imagen Directamente
```html
<!-- Usar endpoint especial para imágenes -->
<img src="https://files.controldoc.app/api/shares/abc123def456/image" 
     alt="Imagen compartida" />
```

### Verificar Estado del Share
```javascript
// Verificar si el share sigue activo
const infoResponse = await fetch('/api/shares/abc123def456/info');
const info = await infoResponse.json();

if (info.downloadsLeft > 0) {
  console.log('Share activo, descargas restantes:', info.downloadsLeft);
} else {
  console.log('Share expirado o sin descargas restantes');
}
```

## 🛡️ Seguridad

- **Tokens únicos**: Cada share tiene un token aleatorio único
- **Expiración automática**: Los shares expiran automáticamente
- **Control de descargas**: Límite opcional de descargas
- **Sin autenticación**: Los shares son públicos pero seguros
- **URLs presignadas**: Acceso directo a Backblaze B2 sin pasar por el servidor

## 📊 Casos de Uso

### 1. **Compartir Documentos**
- PDFs, Word, Excel, etc.
- Enlaces que expiran en 24-48 horas
- Control de quién puede descargar

### 2. **Mostrar Imágenes**
- Fotos de perfil, avatares
- Galerías de productos
- Imágenes en blogs o sitios web

### 3. **Descargas Temporales**
- Archivos de instalación
- Documentos temporales
- Contenido promocional

### 4. **Integración con Apps Externas**
- Mostrar archivos de ControlFile en otras apps
- Embeber contenido sin autenticación
- Compartir entre diferentes sistemas

## 🔄 Flujo de Trabajo

1. **Usuario autenticado** crea share link
2. **Sistema genera** token único y URL pública
3. **Usuario comparte** la URL con otros
4. **Receptores acceden** sin autenticación
5. **Sistema valida** expiración y límites
6. **Descarga directa** desde Backblaze B2

## 📚 Documentación Adicional

- [Guía Completa de Share Links](../GUIA_CONSUMIR_SHARE_LINKS.md) - Documentación detallada
- [API Reference](../../API_REFERENCE.md) - Referencia completa de API
- [Firestore Rules](../../firestore.rules) - Reglas de seguridad