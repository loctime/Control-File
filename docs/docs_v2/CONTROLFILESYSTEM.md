# ControlFile – Sistema de Archivos

⚠️ **Este documento NO define comportamiento. Deriva estrictamente de TRUTH.md. Ante contradicción, TRUTH.md manda.**

---

Este documento describe cómo funciona el sistema de archivos de ControlFile en producción.

---

## Principio fundamental

> Un archivo no pertenece a una app, pertenece al sistema.

Las aplicaciones:
- Crean referencias (`fileId`)
- Solicitan permisos (`shareToken`)
- Renderizan contenido

ControlFile:
- Valida permisos
- Decide cómo se accede
- Protege el storage real
- Expone archivos de forma segura

---

## Arquitectura de almacenamiento

### Separación de responsabilidades

```
┌─────────────────────────────────────────┐
│         Firestore (Metadatos)           │
│  - files/{fileId} (type: "file"|"folder")│
│  - shares/{token}                       │
│  - users/{userId}                       │
│  - uploadSessions/{sessionId}           │
└─────────────────────────────────────────┘
              │
              │ Referencia (bucketKey)
              ↓
┌─────────────────────────────────────────┐
│      Backblaze B2 (Archivos reales)      │
│  - Archivos físicos                     │
│  - URLs presignadas temporales          │
└─────────────────────────────────────────┘
```

**Regla de seguridad:** Los archivos en B2 nunca son públicos directamente. Solo se acceden mediante URLs presignadas generadas bajo demanda.

---

## Estructura de datos en Firestore

### Colección: `files/{fileId}`

Los archivos y carpetas se almacenan en la misma colección `files`, diferenciados por el campo `type`.

#### Archivo (`type: "file"`)

```typescript
{
  id: string,                    // ID único del archivo
  userId: string,                 // Owner del archivo
  name: string,                   // Nombre original del archivo
  slug: string,                   // Slug para URLs amigables
  size: number,                   // Tamaño en bytes
  mime: string,                   // MIME type (ej: "image/png")
  bucketKey: string,              // Ruta en B2 (ej: "users/{userId}/files/{timestamp}-{name}")
  parentId: string | null,        // ID de carpeta padre (null = raíz)
  path: string,                   // Ruta completa (ej: "/documentos/informe.pdf")
  ancestors: string[],            // IDs de carpetas ancestras
  type: "file",                   // Tipo: "file" o "folder"
  createdAt: Timestamp,           // Fecha de creación
  modifiedAt: Timestamp,         // Última modificación
  deletedAt: Timestamp | null,   // Soft delete (null = activo)
  metadata: {
    etag?: string,                // ETag de B2 (validación de integridad)
    thumbnailUrl?: string,        // URL de thumbnail (si aplica)
    // ... otros metadatos opcionales
  }
}
```

#### Carpeta (`type: "folder"`)

```typescript
{
  id: string,                     // ID único de la carpeta
  userId: string,                 // Owner de la carpeta
  name: string,                   // Nombre de la carpeta
  slug: string,                   // Slug para URLs amigables
  parentId: string | null,        // ID de carpeta padre (null = raíz)
  path: string,                   // Ruta completa (ej: "/documentos/informes")
  ancestors: string[],            // IDs de carpetas ancestras
  type: "folder",                // Tipo: "folder"
  createdAt: Timestamp,
  modifiedAt: Timestamp,
  deletedAt: Timestamp | null,
  metadata: {
    isMainFolder: boolean,        // true si parentId === null
    isDefault: boolean,           // Carpeta por defecto
    icon: string,                 // Icono (ej: "Folder", "Taskbar")
    color: string,                // Color CSS (ej: "text-purple-600")
    description: string,          // Descripción opcional
    tags: string[],               // Tags para búsqueda
    isPublic: boolean,            // Carpeta pública (legacy, no usado)
    viewCount: number,            // Contador de vistas
    lastAccessedAt: Timestamp,    // Último acceso
    source: "navbar" | "taskbar", // Origen de la carpeta
    permissions: {
      canEdit: boolean,
      canDelete: boolean,
      canShare: boolean,
      canDownload: boolean
    },
    customFields: Record<string, any>  // Campos personalizados
  }
}
```

**Seguridad:** Las reglas de Firestore validan que `resource.data.userId == uid()` para operaciones de escritura.

---

## Jerarquía de carpetas

### Sistema de paths y ancestors

Cada archivo/carpeta tiene:
- `parentId`: ID directo de la carpeta padre
- `path`: Ruta completa como string (ej: `/documentos/informes`)
- `ancestors`: Array de IDs de todas las carpetas ancestras

**Ejemplo:**
```
/documentos (id: "folder-1")
  └── /informes (id: "folder-2", parentId: "folder-1")
      └── informe.pdf (id: "file-1", parentId: "folder-2")
```

```typescript
// folder-1
{
  id: "folder-1",
  parentId: null,
  path: "/documentos",
  ancestors: []
}

// folder-2
{
  id: "folder-2",
  parentId: "folder-1",
  path: "/documentos/informes",
  ancestors: ["folder-1"]
}

// file-1
{
  id: "file-1",
  parentId: "folder-2",
  path: "/documentos/informes/informe.pdf",
  ancestors: ["folder-1", "folder-2"]
}
```

**Ventajas:**
- Búsqueda eficiente de ancestros
- Construcción rápida de breadcrumbs
- Validación de jerarquía

---

## Generación de claves en B2

### Formato de `bucketKey`

```
users/{userId}/files/{timestamp}-{sanitizedFileName}
```

**Ejemplo:**
```
users/abc123/files/1704067200000-informe-final.pdf
```

**Características:**
- Prefijo por usuario (aislamiento)
- Timestamp para evitar colisiones
- Nombre sanitizado (sin caracteres especiales)

**Campo en Firestore:** `bucketKey` (no `b2Key`)

**Código:** `backend/src/routes/upload.js` → `generateFileKey()`

---

## Sistema de slugs

### Generación de slugs

Los slugs se generan automáticamente desde el nombre:

```javascript
const baseSlug = name.toLowerCase()
  .replace(/\s+/g, '-')      // Espacios → guiones
  .replace(/[^\w-]/g, '');   // Eliminar caracteres especiales
```

**Unicidad:** Si el slug ya existe en la misma carpeta, se agrega un contador:
- `documento.pdf` → `documento.pdf`
- `documento.pdf` (duplicado) → `documento-1.pdf`
- `documento.pdf` (duplicado) → `documento-2.pdf`

**Código:** `backend/src/routes/folders.js` → creación de carpetas

---

## Navegación por slugs

### URLs amigables

Las carpetas pueden accederse mediante URLs basadas en slugs:

```
/{username}/{slug1}/{slug2}/...
```

**Ejemplo:**
```
/usuario/documentos/informes
```

**Endpoint:** `GET /api/folders/by-slug/:username/:path(*)`

**Validación:**
- Solo el owner puede acceder (por ahora)
- Navegación recursiva por slugs
- Actualización automática de `viewCount`

---

## Carpetas principales (Main Folders)

### Carpetas raíz

Las carpetas con `parentId === null` son carpetas principales:

```typescript
{
  parentId: null,
  metadata: {
    isMainFolder: true
  }
}
```

**Características:**
- Aparecen en la navegación principal
- Pueden tener `source: "navbar"` o `source: "taskbar"`
- Se crean automáticamente si no existen

**Endpoint:** `GET /api/folders/root?name={nombre}&pin={0|1}`

---

## Sistema de Taskbar vs Navbar

### Diferenciación por `metadata.source`

| Característica | Navbar (`source: "navbar"`) | Taskbar (`source: "taskbar"`) |
|----------------|----------------------------|-------------------------------|
| **Ubicación** | Barra superior | Barra inferior fija |
| **Estilo** | Borde morado | Borde azul |
| **Propósito** | Navegación principal | Acceso rápido |
| **Context menu** | Sí | No |

**Validación:** Solo `"navbar"` y `"taskbar"` están permitidos. Cualquier otro valor se normaliza a `"navbar"`.

**Código:** `backend/src/routes/folders.js` → `validateAndNormalizeSource()`

---

## Soft delete

### Campo `deletedAt`

Los archivos y carpetas no se eliminan físicamente, se marcan como eliminados:

```typescript
{
  deletedAt: Timestamp | null  // null = activo, Timestamp = eliminado
}
```

**Ventajas:**
- Recuperación posible
- Historial de cambios
- Auditoría

**Validación:** El backend filtra automáticamente archivos con `deletedAt !== null` en las consultas.

---

## Sistema de cuotas

### Actualización automática

Cada usuario tiene una cuota en `users/{userId}`:

```typescript
{
  quotaBytes: number,    // Cuota total (según plan)
  usedBytes: number      // Bytes usados
}
```

**Actualización:**
- Después de cada upload exitoso: `usedBytes += fileSize`
- Después de cada delete: `usedBytes -= fileSize`
- Validación antes de upload: `usedBytes + fileSize <= quotaBytes`

**Código:** `backend/src/routes/upload.js` → validación y actualización de cuota

---

## Uploads multipart

### Archivos grandes (>128MB)

Para archivos mayores a 128MB, se usa upload multipart:

```typescript
// 1. Crear sesión multipart
POST /api/uploads/presign
{
  name: "video.mp4",
  size: 500000000,  // 500MB
  mime: "video/mp4"
}

// Respuesta:
{
  uploadSessionId: "...",
  useMultipart: true,
  partSize: 5242880,  // 5MB por parte
  totalParts: 96,
  parts: [
    { partNumber: 1, uploadUrl: "..." },
    { partNumber: 2, uploadUrl: "..." },
    // ...
  ]
}

// 2. Upload directo a B2 (cada parte)
PUT {uploadUrl}  // Body: parte del archivo

// 3. Confirmar
POST /api/uploads/confirm
{
  uploadSessionId: "...",
  parts: [
    { PartNumber: 1, ETag: "..." },
    { PartNumber: 2, ETag: "..." },
    // ...
  ]
}
```

**Límites B2:**
- Mínimo por parte: 5MB
- Máximo por parte: 5GB
- Máximo de partes: 10,000

**Código:** `lib/b2.ts` → funciones multipart

---

## Cache de carpetas

### TanStack Cache

El backend implementa un sistema de cache para carpetas usando TanStack Query:

**Endpoints con cache:**
- `GET /api/files/list` (carpetas)
- `GET /api/folders/root`

**Invalidación:**
- Crear carpeta → invalida cache
- Eliminar carpeta → invalida cache
- Renombrar carpeta → invalida cache

**Código:** `backend/src/middleware/cache.js`

---

## Reglas de seguridad

### Firestore Rules

```javascript
// Archivos y carpetas (colección unificada)
match /files/{fileId} {
  // READ público necesario para shares públicos vía Cloudflare Worker
  // El control de acceso real está en shares/{token} que valida expiración y estado
  // Los datos sensibles están en B2, no en Firestore
  allow read: if true;
  allow create: if isAuth() && request.resource.data.userId == uid();
  allow update, delete: if isAuth() && resource.data.userId == uid();
}
```

**Motivo de `allow read: if true`:**
- Necesario para shares públicos que se validan vía Cloudflare Worker
- El control de acceso real está en la colección `shares/{token}` que valida:
  - Expiración (`expiresAt`)
  - Estado activo (`isActive`)
  - Ownership del archivo
- Los datos sensibles (archivos reales) están en B2, no en Firestore
- Solo metadatos públicos (nombre, tamaño, MIME) están expuestos

**Nota:** Las carpetas están en la misma colección `files` con `type: "folder"`. Las mismas reglas aplican.

**Archivo:** `firestore-rules/controlFile.rules`

**Legacy:** Existe una regla `match /folders/{folderId}` en las reglas pero no se usa. Las carpetas se almacenan en `files` con `type: "folder"`.

---

## Validación server-side

### Doble validación

Aunque Firestore tiene reglas, el backend valida ownership en cada operación crítica:

```javascript
// Ejemplo: Eliminar archivo
const fileDoc = await fileRef.get();
if (fileDoc.data().userId !== uid) {
  return res.status(403).json({ error: 'No autorizado' });
}
```

**Razón de seguridad:** Las reglas de Firestore pueden tener bugs o ser bypassadas. La validación server-side es la última línea de defensa.

---

## Búsqueda y filtrado

### Listado de archivos y carpetas

**Endpoint:** `GET /api/files/list`

**Query parameters:**
- `parentId`: string | null - Filtrar por carpeta padre
- `pageSize`: number - Tamaño de página (default: 100, max: 200)
- `cursor`: string - Cursor para paginación

**Filtros automáticos:**
- Solo items del usuario (`userId == uid`)
- Solo items activos (`deletedAt == null`)
- Archivos ordenados por `updatedAt` descendente
- Carpetas ordenadas por `createdAt` descendente
- Archivos y carpetas se obtienen en queries separadas y se combinan

**Respuesta:**
```typescript
{
  success: true,
  data: Array<{
    id: string,
    type: "file" | "folder",
    name: string,
    // ... otros campos según type
  }>,
  cursor?: string  // Para paginación
}
```

**Código:** `backend/src/routes/files.js` → `GET /list`

**Nota:** El endpoint acepta tanto archivos como carpetas porque ambos están en la colección `files` con `type` diferente.

---

## Proxy de imágenes (solución CORS definitiva)

### Endpoint: `GET /api/shares/{token}/image`

Este endpoint permite compartir imágenes en `<img>` tags sin problemas de CORS.

**Flujo:**
```
Cliente → GET /api/shares/{token}/image
  ↓
Backend valida share (expiración, estado activo)
Backend obtiene archivo desde B2 (stream)
Backend retorna imagen con headers CORS
```

**Características:**
- Headers CORS configurados (`Access-Control-Allow-Origin: *`)
- Stream directo desde B2 (no carga en memoria)
- Cache headers (`Cache-Control: public, max-age=3600`)
- Soporta HEAD requests (solo headers, sin body)
- Actualiza contador de descargas automáticamente
- Solo funciona con archivos que tienen `bucketKey` (archivos en B2)

**Validaciones:**
- Token de share existe y es válido
- Share no expirado (`expiresAt` > ahora o `expiresAt === null`)
- Share activo (`isActive !== false`)
- Archivo existe y no está eliminado (`deletedAt === null`)
- Archivo tiene `bucketKey` (requisito para B2)

**Razón de seguridad:** Este endpoint es público pero seguro porque:
1. Valida token de share (no predecible, generado aleatoriamente)
2. Valida expiración y estado activo
3. Solo sirve archivos que tienen `bucketKey` (archivos en B2)
4. No expone URLs de B2 directamente
5. Headers CORS permiten embedding en cualquier dominio

**Código:** `backend/src/routes/shares.js` → `GET /:token/image`

**Uso:**
```html
<!-- En cualquier dominio -->
<img src="https://backend.controlfile.app/api/shares/{token}/image" alt="Imagen compartida" />
```

---

## Integración con otras apps

### SDK de ControlFile

Las apps externas pueden integrar ControlFile usando el SDK incluido.

**Ubicación:** `lib/controlfile-sdk.ts`

**Clase principal:** `ControlFileClient`

**Ver documentación completa:** `INTEGRACION.md` (próximamente)

---

## Decisiones de diseño

### 1. Archivos y carpetas en la misma colección

**Razón:** Simplifica queries y permite tratar ambos como "items" en la UI.

### 2. Paths como strings

**Razón:** Fácil de construir breadcrumbs y URLs amigables.

### 3. Ancestors como array

**Razón:** Validación rápida de jerarquía sin queries recursivas.

### 4. Soft delete

**Razón:** Recuperación y auditoría sin costo adicional.

### 5. Slugs únicos por carpeta

**Razón:** URLs amigables sin conflictos dentro del mismo contexto.

---

## Limitaciones conocidas

### 1. Búsqueda por nombre

**Estado:** No implementado. Solo búsqueda por `parentId`.

**Workaround:** Filtrar en el frontend después de obtener todos los archivos.

### 2. Compartir carpetas

**Estado:** No implementado. Solo se pueden compartir archivos individuales.

### 3. Permisos granulares

**Estado:** Solo ownership. No hay permisos de lectura/escritura por usuario.

### 4. Versiones de archivos

**Estado:** No implementado. Reemplazar archivo sobrescribe el anterior.

---

## Próximos pasos

Ver los siguientes documentos:
- `API.md` - Documentación completa de endpoints
- `INTEGRACION.md` - Guía de integración
- `SEGURIDAD.md` - Detalles de seguridad
