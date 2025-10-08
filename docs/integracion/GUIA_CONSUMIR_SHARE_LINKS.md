# 🔗 Guía: Consumir Share Links Públicos de ControlFile

> **Caso de uso:** Tu aplicación externa recibe share links de ControlFile y necesita descargar los archivos sin autenticación.

## 📋 Escenario

Tienes share links como:
```
https://files.controldoc.app/share/ky7pymrmm7o9w0e6ao97uv
```

Y necesitas:
1. Obtener información del archivo (nombre, tamaño, tipo)
2. Descargar el archivo directamente
3. Sin autenticación (acceso público)

---

## 🚀 API de Share Links Públicos

### 1️⃣ Obtener Información del Share

**Endpoint:** `GET /api/shares/{token}`

**Autenticación:** ❌ No requiere (público)

**Ejemplo:**
```bash
GET https://files.controldoc.app/api/shares/ky7pymrmm7o9w0e6ao97uv
```

**Respuesta:**
```json
{
  "fileName": "CV_Juan_Perez.pdf",
  "fileSize": 524288,
  "mime": "application/pdf",
  "expiresAt": "2025-10-14T12:00:00.000Z",
  "downloadCount": 3
}
```

**Códigos de error:**
- `404` - Share link no encontrado
- `410` - Share link expirado o revocado

---

### 2️⃣ Obtener URL de Descarga

**Endpoint:** `POST /api/shares/{token}/download`

**Autenticación:** ❌ No requiere (público)

**Ejemplo:**
```bash
POST https://files.controldoc.app/api/shares/ky7pymrmm7o9w0e6ao97uv/download
```

**Respuesta:**
```json
{
  "downloadUrl": "https://s3.us-west-002.backblazeb2.com/...",
  "fileName": "CV_Juan_Perez.pdf",
  "fileSize": 524288
}
```

> ⚠️ **Importante:** La `downloadUrl` es una URL presignada válida por **5 minutos**. Después de ese tiempo, debes volver a llamar al endpoint para obtener una nueva URL.

---

## 💻 Implementación

### JavaScript/TypeScript

```typescript
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

class ControlFileShareClient {
  constructor(private baseUrl: string = 'https://files.controldoc.app') {}

  /**
   * Obtener información de un share link
   */
  async getShareInfo(shareToken: string): Promise<ShareInfo> {
    const response = await fetch(`${this.baseUrl}/api/shares/${shareToken}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Share link no encontrado');
      }
      if (response.status === 410) {
        throw new Error('Share link expirado o revocado');
      }
      throw new Error('Error al obtener información del share');
    }
    
    return response.json();
  }

  /**
   * Obtener URL de descarga (válida 5 minutos)
   */
  async getDownloadUrl(shareToken: string): Promise<DownloadInfo> {
    const response = await fetch(
      `${this.baseUrl}/api/shares/${shareToken}/download`,
      { method: 'POST' }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Share link no encontrado');
      }
      if (response.status === 410) {
        throw new Error('Share link expirado o revocado');
      }
      throw new Error('Error al obtener URL de descarga');
    }
    
    return response.json();
  }

  /**
   * Descargar archivo directamente (navegador)
   */
  async downloadFile(shareToken: string): Promise<void> {
    const { downloadUrl, fileName } = await this.getDownloadUrl(shareToken);
    
    // Crear link temporal y hacer click
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Descargar como Blob (para manipular en JS)
   */
  async downloadAsBlob(shareToken: string): Promise<Blob> {
    const { downloadUrl } = await this.getDownloadUrl(shareToken);
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      throw new Error('Error al descargar archivo');
    }
    
    return response.blob();
  }

  /**
   * Extraer token de una URL completa
   */
  extractToken(shareUrl: string): string {
    // https://files.controldoc.app/share/ky7pymrmm7o9w0e6ao97uv
    // → ky7pymrmm7o9w0e6ao97uv
    const match = shareUrl.match(/\/share\/([a-z0-9]+)$/i);
    if (!match) {
      throw new Error('URL de share inválida');
    }
    return match[1];
  }
}

// Uso
const shareClient = new ControlFileShareClient();

// Ejemplo 1: Obtener información
const info = await shareClient.getShareInfo('ky7pymrmm7o9w0e6ao97uv');
console.log(`Archivo: ${info.fileName} (${info.fileSize} bytes)`);

// Ejemplo 2: Descargar directamente
await shareClient.downloadFile('ky7pymrmm7o9w0e6ao97uv');

// Ejemplo 3: Desde URL completa
const token = shareClient.extractToken('https://files.controldoc.app/share/ky7pymrmm7o9w0e6ao97uv');
await shareClient.downloadFile(token);

// Ejemplo 4: Obtener blob para procesar
const blob = await shareClient.downloadAsBlob('ky7pymrmm7o9w0e6ao97uv');
const dataUrl = URL.createObjectURL(blob);
```

---

### Node.js / Backend

```javascript
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function downloadSharedFile(shareToken, outputPath) {
  // 1. Obtener URL de descarga
  const response = await fetch(
    `https://files.controldoc.app/api/shares/${shareToken}/download`,
    { method: 'POST' }
  );
  
  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }
  
  const { downloadUrl, fileName } = await response.json();
  
  // 2. Descargar archivo
  const fileResponse = await fetch(downloadUrl);
  const buffer = await fileResponse.buffer();
  
  // 3. Guardar en disco
  const finalPath = outputPath || path.join(__dirname, fileName);
  fs.writeFileSync(finalPath, buffer);
  
  console.log(`Archivo descargado: ${finalPath}`);
  return finalPath;
}

// Uso
downloadSharedFile('ky7pymrmm7o9w0e6ao97uv', './downloads/cv.pdf')
  .then(path => console.log('OK:', path))
  .catch(err => console.error('Error:', err));
```

---

### React Component

```tsx
import { useState } from 'react';
import { ControlFileShareClient } from '@/lib/controlfile-share';

export function SharedFileViewer({ shareUrl }: { shareUrl: string }) {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const shareClient = new ControlFileShareClient();
  
  const loadInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = shareClient.extractToken(shareUrl);
      const data = await shareClient.getShareInfo(token);
      
      setInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDownload = async () => {
    try {
      const token = shareClient.extractToken(shareUrl);
      await shareClient.downloadFile(token);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };
  
  React.useEffect(() => {
    loadInfo();
  }, [shareUrl]);
  
  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!info) return null;
  
  return (
    <div className="border rounded p-4">
      <h3 className="font-bold">{info.fileName}</h3>
      <p className="text-sm text-gray-600">
        Tamaño: {(info.fileSize / 1024).toFixed(2)} KB
      </p>
      <p className="text-sm text-gray-600">
        Tipo: {info.mime}
      </p>
      <p className="text-sm text-gray-600">
        Descargas: {info.downloadCount}
      </p>
      <button 
        onClick={handleDownload}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Descargar
      </button>
    </div>
  );
}
```

---

## 🎯 Caso de Uso: Bolsa de Trabajo

### Flujo Completo

```typescript
// 1. Usuario sube CV en la aplicación de Bolsa de Trabajo
async function subirCV(file: File, usuarioId: string) {
  // Subir a ControlFile (con autenticación)
  const fileId = await controlFile.upload(file);
  
  // Crear share link público (válido 30 días)
  const response = await fetch('https://backend.controldoc.app/api/shares/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await getAuthToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileId,
      expiresIn: 720 // 30 días en horas
    })
  });
  
  const { shareToken, shareUrl } = await response.json();
  
  // Guardar en tu base de datos
  await db.postulantes.update(usuarioId, {
    cvShareToken: shareToken,
    cvShareUrl: shareUrl
  });
  
  return shareUrl;
}

// 2. Admin descarga el CV (sin autenticación de ControlFile)
async function descargarCVPostulante(postulanteId: string) {
  // Obtener share token de tu BD
  const postulante = await db.postulantes.findById(postulanteId);
  
  // Descargar directamente (público, sin auth)
  const shareClient = new ControlFileShareClient();
  await shareClient.downloadFile(postulante.cvShareToken);
}

// 3. Mostrar lista de CVs en panel admin
async function listarCVsPendientes() {
  const postulantes = await db.postulantes.findAll({ estado: 'pendiente' });
  
  // Para cada postulante, obtener info del CV
  const cvs = await Promise.all(
    postulantes.map(async (p) => {
      try {
        const info = await shareClient.getShareInfo(p.cvShareToken);
        return {
          postulanteId: p.id,
          nombre: p.nombre,
          cvFileName: info.fileName,
          cvSize: info.fileSize,
          shareUrl: p.cvShareUrl
        };
      } catch (err) {
        console.error(`CV no disponible para ${p.nombre}:`, err);
        return null;
      }
    })
  );
  
  return cvs.filter(Boolean);
}
```

---

## ⚠️ Consideraciones Importantes

### 1. Validez de URLs

```typescript
// ❌ MAL: Guardar downloadUrl en BD
const { downloadUrl } = await shareClient.getDownloadUrl(token);
await db.save({ downloadUrl }); // Esta URL expira en 5 min ❌

// ✅ BIEN: Guardar shareToken
await db.save({ shareToken: token }); // Este token dura días/semanas ✅

// Luego, cuando necesites descargar:
const { downloadUrl } = await shareClient.getDownloadUrl(db.shareToken);
// Ahora sí úsala (tienes 5 min)
```

### 2. Manejo de Expiración

```typescript
async function descargarConReintentos(shareToken: string) {
  try {
    return await shareClient.downloadFile(shareToken);
  } catch (err: any) {
    if (err.message.includes('expirado')) {
      // Notificar al usuario que el link expiró
      alert('El archivo compartido ha expirado. Solicita un nuevo link.');
    } else if (err.message.includes('no encontrado')) {
      alert('El archivo ya no está disponible.');
    } else {
      alert('Error al descargar el archivo.');
    }
    throw err;
  }
}
```

### 3. Seguridad

- ✅ Los share links son públicos por diseño (cualquiera con el token puede acceder)
- ✅ Los tokens son largos y aleatorios (difíciles de adivinar)
- ✅ Puedes revocar shares con `POST /api/shares/revoke` (requiere auth del creador)
- ⚠️ No uses shares para archivos confidenciales sin encriptación adicional

---

## 🔧 Troubleshooting

### Error: "Acceso a carpetas de otros usuarios no implementado aún"

**Causa:** Estás usando el endpoint incorrecto (probablemente `/api/files/...`)

**Solución:** Usa `/api/shares/{token}/download` en lugar de endpoints de files

### Error 404: Share link no encontrado

**Causas:**
- Token incorrecto
- Share fue eliminado
- Error al extraer token de la URL

**Solución:**
```typescript
// Verificar que el token sea correcto
console.log('Token:', shareToken);

// Verificar que la URL sea correcta
const token = shareClient.extractToken(shareUrl);
```

### Error 410: Share link expirado

**Causa:** El share superó su fecha de expiración

**Solución:** Crear un nuevo share link con `/api/shares/create`

---

## 📚 Resumen de Endpoints

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/shares/create` | POST | ✅ Sí | Crear share link (requiere fileId) |
| `/api/shares/{token}` | GET | ❌ No | Obtener info del share |
| `/api/shares/{token}/download` | POST | ❌ No | Obtener URL de descarga |
| `/api/shares/revoke` | POST | ✅ Sí | Revocar share link |

---

## 🚀 Próximos Pasos

1. Copia la clase `ControlFileShareClient` a tu proyecto
2. Implementa la descarga de archivos compartidos
3. Guarda los `shareToken` en tu base de datos (no las `downloadUrl`)
4. Maneja errores de expiración y archivos no encontrados

---

**¿Preguntas?** Revisa también:
- `API_REFERENCE.md` - Referencia completa de la API
- `README_INTEGRACION_RAPIDA.md` - Integración con autenticación

