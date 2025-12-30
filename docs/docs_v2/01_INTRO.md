# ControlFile – Introducción

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

ControlFile es la capa central de gestión de archivos para todo el ecosistema ControlDoc / ControlAudit y futuras aplicaciones.

Su objetivo es **separar definitivamente la lógica de archivos de la lógica de negocio de las apps**.

Las aplicaciones no gestionan storage, URLs, permisos públicos ni CORS.
ControlFile sí.

---

## Problema que resuelve

En aplicaciones modernas, el manejo de archivos suele generar:

- URLs presignadas expuestas
- lógica de seguridad duplicada
- problemas de CORS entre dominios
- dependencias fuertes al proveedor de storage
- dificultad para auditar accesos
- bugs inconsistentes entre apps

ControlFile existe para **resolver estos problemas una sola vez**, de forma centralizada.

---

## Qué es ControlFile

ControlFile es:

- un backend especializado en archivos
- una capa de seguridad y validación
- un proxy HTTP seguro
- un traductor entre apps y storage

ControlFile **no es una app de usuario**.
Es infraestructura compartida.

---

## Qué NO es ControlFile

- No es un CDN
- No es un frontend
- No es un storage en sí mismo
- No es dependiente de una app específica

---

## Principio fundamental

> Un archivo no pertenece a una app.  
> Pertenece al sistema.

Las apps:
- crean referencias (`fileId`)
- solicitan accesos (`shareToken`)
- renderizan contenido

ControlFile:
- valida permisos
- decide cómo se accede
- protege el storage real
- expone archivos de forma segura

---

## Arquitectura en producción

ControlFile está compuesto por:

### Backend (Node.js/Express)
- **Puerto**: 3001 (configurable vía `PORT`)
- **Framework**: Express.js
- **Autenticación**: Firebase Admin SDK (verifica tokens JWT)
- **Storage**: Backblaze B2 (API S3-compatible)
- **Base de datos**: Firestore
- **Deploy**: Render.com

### Frontend (Next.js)
- **Framework**: Next.js 14 (App Router)
- **Puerto**: 3000 (desarrollo)
- **Estado**: Zustand + TanStack Query
- **UI**: TailwindCSS + shadcn/ui
- **Deploy**: Vercel

### Servicios externos
- **Firebase Auth**: Proyecto centralizado (`controlstorage-eb796`)
- **Firestore**: Base de datos de metadatos
- **Backblaze B2**: Almacenamiento de archivos
- **Cloudflare Worker**: Proxy HTTP para shares públicos (opcional)

---

## Stack tecnológico real

| Capa | Tecnología | Versión/Detalles |
|------|------------|------------------|
| **Backend Runtime** | Node.js | >=18.0.0 |
| **Backend Framework** | Express.js | 4.18.2 |
| **Frontend Framework** | Next.js | 14.2.5 |
| **Frontend Runtime** | React | 18 |
| **Lenguaje** | TypeScript (frontend), JavaScript (backend) | - |
| **Autenticación** | Firebase Auth | Centralizado (SSO) |
| **Base de datos** | Firestore | - |
| **Storage** | Backblaze B2 | API S3-compatible |
| **Cliente S3** | AWS SDK v3 | @aws-sdk/client-s3 |
| **Estilos** | TailwindCSS | 3.4.0 |
| **Estado Global** | Zustand | 4.5.2 |
| **Estado Servidor** | TanStack Query | 5.45.1 |

---

## Multi-tenant y autenticación

### Firebase Auth Centralizado

Todas las aplicaciones del ecosistema (ControlFile, ControlAudit, ControlDoc, etc.) comparten **un solo proyecto Firebase Auth** (`controlstorage-eb796`).

**Ventajas de seguridad:**
- Single Sign-On (SSO) entre aplicaciones
- Un solo punto de gestión de usuarios
- Menor costo (un solo proyecto Firebase)

### Custom Claims

Cada usuario tiene claims que definen acceso por aplicación:

```json
{
  "allowedApps": ["controlfile", "controlaudit", "controldoc"],
  "plans": {
    "controlfile": "STORAGE_50GB",
    "controlaudit": "FREE_5GB"
  }
}
```

**Configuración de claims:**
```bash
npm run set-claims -- \
  --email usuario@ejemplo.com \
  --apps controlfile,controlaudit \
  --plans controlfile=STORAGE_50GB
```

### Middleware de autenticación

El backend valida tokens JWT en cada request protegido:

```javascript
// backend/src/middleware/auth.js
// Verifica token con Firebase Admin SDK
const decoded = await centralAuth.verifyIdToken(token);
// Expone req.user, req.uid, req.claims
```

**Seguridad:** Los tokens expiran automáticamente. El frontend debe refrescar tokens cuando expiran.

---

## Flujo de operaciones real

### 1. Subida de archivo

```
Frontend → POST /api/uploads/presign
  ↓
Backend valida auth (Firebase token)
Backend crea registro en Firestore (uploadSession)
Backend genera presigned URL de B2 (expira en 1h)
  ↓
Frontend → PUT directo a B2 (presigned URL)
  ↓
Frontend → POST /api/uploads/confirm
  ↓
Backend valida upload en B2
Backend crea documento en Firestore (files/{fileId})
Backend actualiza cuota del usuario
```

**Características:**
- Uploads directos a B2 (no pasan por el backend)
- Soporte multipart para archivos >128MB
- Validación de cuota antes de presign
- Reintentos automáticos en caso de fallo

### 2. Descarga de archivo

```
Frontend → POST /api/files/presign-get
  ↓
Backend valida auth y ownership
Backend genera presigned URL de B2 (expira en 5min)
  ↓
Frontend → GET directo a B2 (presigned URL)
```

**Seguridad:** Las URLs presignadas expiran en 5 minutos por defecto. No se almacenan URLs en Firestore.

### 3. Share público

```
Usuario → POST /api/shares/create
  ↓
Backend genera token aleatorio
Backend crea documento en Firestore (shares/{token})
  ↓
Público → GET /api/shares/{token}
  ↓
Backend valida expiración y estado
Backend genera presigned URL temporal
```

**Características:**
- Tokens aleatorios (no predecibles)
- Expiración configurable (default: 24 horas)
- Contador de descargas
- Revocación inmediata (isActive: false)

### 4. Proxy de imágenes (solución CORS definitiva)

Para compartir imágenes en `<img>` tags sin problemas de CORS:

```
Público → GET /api/shares/{token}/image
  ↓
Backend valida share (expiración, estado)
Backend obtiene archivo desde B2 (stream)
Backend retorna imagen con headers CORS
```

**Características:**
- Headers CORS configurados (`Access-Control-Allow-Origin: *`)
- Stream directo desde B2 (no carga en memoria)
- Cache headers (`Cache-Control: public, max-age=3600`)
- Soporta HEAD requests (solo headers)
- Actualiza contador de descargas

**Razón de seguridad:** Este endpoint es público pero seguro porque:
1. Valida token de share (no predecible)
2. Valida expiración y estado activo
3. Solo sirve archivos que tienen `bucketKey` (archivos en B2)
4. No expone URLs de B2 directamente

**Código:** `backend/src/routes/shares.js` → `GET /:token/image`

---

## Estructura de datos en Firestore

### Modelo unificado: colección `files`

**Importante:** Archivos y carpetas se almacenan en la misma colección `files`, diferenciados por el campo `type`.

#### Colección: `files/{fileId}`

```typescript
// Archivo (type: "file")
{
  id: string,
  userId: string,
  name: string,
  size: number,
  mime: string,
  bucketKey: string,        // Ruta en B2 (ej: "users/{userId}/files/{timestamp}-{name}")
  parentId: string | null,
  path: string,
  ancestors: string[],
  type: "file",             // Diferenciador: "file" o "folder"
  createdAt: Timestamp,
  updatedAt: Timestamp,      // (modifiedAt para carpetas)
  deletedAt: Timestamp | null
}

// Carpeta (type: "folder")
{
  id: string,
  userId: string,
  name: string,
  slug: string,
  parentId: string | null,
  path: string,
  ancestors: string[],
  type: "folder",           // Diferenciador: "folder"
  createdAt: Timestamp,
  updatedAt: Timestamp,      // (modifiedAt para carpetas)    // (o updatedAt, ambos aceptados)
  deletedAt: Timestamp | null
}
```

#### Otras colecciones

```
shares/{token}
  - token: string
  - fileId: string
  - uid: string
  - fileName: string
  - expiresAt: Timestamp | null
  - isActive: boolean
  - downloadCount: number

users/{userId}
  - planQuotaBytes: number
  - usedBytes: number
  - pendingBytes: number
  - planId: string

uploadSessions/{sessionId}
  - uid: string
  - bucketKey: string
  - status: string
  - expiresAt: Timestamp
```

**Seguridad:** Las reglas de Firestore validan ownership (`resource.data.userId == uid()`).

**Nota sobre `allow read: if true`:** La colección `files` permite lectura pública (`allow read: if true`) porque es necesaria para shares públicos vía Cloudflare Worker. El control de acceso real está en la colección `shares/{token}` que valida expiración y estado. Los datos sensibles (archivos reales) están en B2, no en Firestore.

---

## Sistema de cuotas

### Planes disponibles

| Plan ID | Nombre | Cuota | Precio Mensual |
|---------|--------|-------|----------------|
| `FREE_5GB` | Gratis | 5 GB | $0 |
| `STORAGE_50GB` | 50 GB | 50 GB | $0.99 |
| `STORAGE_100GB` | 100 GB | 100 GB | $1.99 |
| `STORAGE_250GB` | 250 GB | 250 GB | $3.99 |
| `STORAGE_500GB` | 500 GB | 500 GB | $6.99 |
| `STORAGE_1TB` | 1 TB | 1 TB | $12.99 |

**Configuración:** `config/plans.json`

**Validación:** El backend valida cuota antes de permitir uploads. La cuota se actualiza automáticamente después de cada upload/delete.

---

## Seguridad implementada

### 1. Autenticación
- ✅ Tokens JWT de Firebase (no almacenados en localStorage)
- ✅ Verificación server-side con Firebase Admin SDK
- ✅ Tokens expiran automáticamente

### 2. Autorización
- ✅ Custom claims por aplicación
- ✅ Firestore rules validan ownership
- ✅ Backend valida permisos en cada operación

### 3. Storage
- ✅ URLs presignadas con expiración corta (5min descarga, 1h upload)
- ✅ Archivos en B2 nunca son públicos directamente
- ✅ Validación de ownership antes de generar URLs

### 4. Shares públicos
- ✅ Tokens aleatorios no predecibles
- ✅ Expiración configurable
- ✅ Revocación inmediata (isActive)
- ✅ Contador de accesos
- ✅ Proxy de imágenes CORS-safe (`/shares/{token}/image`)

### 5. CORS
- ✅ Lista blanca de dominios permitidos
- ✅ Configurado en backend (`ALLOWED_ORIGINS`)
- ✅ Validación de origen en cada request

### 6. Rate Limiting
- ✅ 100 requests por IP cada 15 minutos (configurable)
- ✅ Implementado con `express-rate-limit`

---

## Endpoints principales

### Uploads
- Endpoints de upload no están documentados en TRUTH.md §6.
- Ver `04_FLUJOS_EJECUTABLES/upload.md` para flujo de upload.

### Archivos y Carpetas
- Endpoints de archivos y carpetas no están documentados en TRUTH.md §6.
- Ver código fuente para endpoints específicos.

### Shares
- `POST /api/shares/create` - Crear share (protegido)
- `GET /api/shares/{token}` - Obtener info de share (público)
- `GET /api/shares/{token}/download` - Descargar archivo compartido (público)
- `GET /api/shares/{token}/image` - Proxy de imagen CORS-safe (público, para `<img>` tags)

### Health
- Endpoints de health no están documentados en TRUTH.md §6.

---

## Integración con otras apps

### SDK de ControlFile

Las aplicaciones externas pueden integrar ControlFile usando el SDK incluido.

**Ubicación:** `lib/controlfile-sdk.ts`

**Clase principal:** `ControlFileClient`

**Métodos disponibles:**
- `list()` - Listar archivos y carpetas
- `presignUpload()` - Generar URL de subida
- `confirm()` - Confirmar upload completado
- `presignGet()` - Generar URL de descarga
- `delete()` - Eliminar archivo
- `rename()` - Renombrar archivo
- `replace()` - Reemplazar contenido

**Ver documentación completa:** Ver `03_CONTRATOS_TECNICOS/` para especificaciones técnicas.

---

## Configuración multi-dominio

ControlFile soporta múltiples dominios con configuración dinámica:

```typescript
// lib/domain-config.ts
DOMAIN_CONFIGS = {
  'files.controldoc.app': { /* config */ },
  'localhost': { /* config */ }
}
```

**Características:**
- Configuración de Firebase por dominio
- Configuración de B2 por dominio (opcional)
- Fallback a configuración por defecto

**Seguridad:** Solo dominios autorizados pueden acceder. Validación en backend vía CORS.

---

## Decisiones de seguridad explícitas

### 1. URLs presignadas de corta duración
**Razón:** Minimizar ventana de acceso no autorizado si una URL se filtra.

### 2. Uploads directos a B2
**Razón:** Evitar que el backend maneje archivos grandes (mejor rendimiento, menor costo).

### 3. Validación server-side siempre
**Razón:** Las reglas de Firestore no son suficientes. El backend valida ownership en cada operación crítica.

### 4. Tokens de share aleatorios
**Razón:** Evitar enumeración de shares. Los tokens son imposibles de predecir.

### 5. CORS restrictivo
**Razón:** Prevenir ataques CSRF desde dominios no autorizados.

---

## Próximos pasos

Ver los siguientes documentos en orden:
1. `TRUTH.md` - Fuente única de verdad técnica
2. `02_FILOSOFIA_Y_PRINCIPIOS.md` - Principios operativos
3. `03_CONTRATOS_TECNICOS/` - Contratos técnicos derivados de TRUTH.md
4. `04_FLUJOS_EJECUTABLES/` - Flujos paso a paso
