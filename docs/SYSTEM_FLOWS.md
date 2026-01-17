# ControlFile Backend (Express) — Flujos Críticos

> Flujos reconstruidos paso a paso según `backend/src`.

## 1) Upload pipeline

### A. Presign + confirm (`/api/uploads/*`)
1. **Cliente autenticado** llama `POST /api/uploads/presign` con `name/size/mime`.
2. **Auth**: `authMiddleware` valida Firebase token y genera `req.user`.
3. **Validaciones**: tamaño (máx. 5GB) + estado de cuenta/cuota (`loadAccount`, `requireActiveAccount`, `requireStorage`).
4. **Resolución de carpeta**: `resolveParentAndAncestors` para `parentId/ancestors`.
5. **Generación de bucketKey**: `generateFileKey(uid, parentPath, name)`.
6. **Presign**:
   - Si el archivo supera 128MB: `createMultipartUpload` + URLs por parte.
   - Si no: `createPresignedPutUrl`.
7. **Persistencia**: se crea `uploadSessions/{uploadSessionId}` con `status: pending`.
8. **Cliente** sube el archivo a B2 usando la URL presignada.
9. **Confirmación**: `POST /api/uploads/confirm` valida `uploadSessionId` y ownership.
10. **Multipart**: si aplica, `completeMultipartUpload`.
11. **Verificación en B2**: `getObjectMetadata`.
12. **Persistencia final**: crea documento en `files` y marca la sesión como `completed`.

**Fuentes**: rutas y servicios de upload/presign y B2.【F:backend/src/routes/upload.js†L22-L262】【F:backend/src/services/b2.js†L1-L200】

### B. Proxy upload (`/api/uploads/proxy-upload`)
1. **Cliente autenticado** envía `multipart/form-data` con `file` y `sessionId`.
2. **Valida sesión** en `uploadSessions` y ownership.
3. **(Opcional)** escaneo Cloudmersive para archivos sospechosos.
4. **Sube a B2** usando `uploadFileDirectly`.
5. **Marca sesión** como `uploaded` con `etag` y resultado de scan.

**Fuentes**: `proxy-upload` y Cloudmersive.【F:backend/src/routes/upload.js†L264-L330】【F:backend/src/services/cloudmersive.js†L1-L118】

### C. Upload externo (`/upload`)
1. **Cliente autenticado** envía `multipart/form-data` (`file`, `auditId`, `companyId`).
2. **Valida campos** y parsea `metadata` opcional.
3. **Genera bucketPath** `audits/{companyId}/{auditId}/{uuid}{ext}`.
4. **Sube a B2** con `uploadFileDirectly`.
5. **Genera presigned GET** (7 días) para retorno inmediato.
6. **Crea documento en `files`** con `companyId/auditId/sourceApp/metadata`.

**Fuentes**: endpoint externo y B2.【F:backend/src/index.js†L152-L168】【F:backend/src/routes/external-upload.js†L12-L210】

---

## 2) Share token pipeline

### A. Crear share
1. **Cliente autenticado** llama `POST /api/shares/create` con `fileId`.
2. **Valida ownership** y `deletedAt`.
3. **Genera token** con `Math.random()`.
4. **Guarda `shares/{token}`** con metadata y `expiresAt`.
5. **Devuelve `shareUrl`** para consumo público.

**Fuente**: `shares.js` create.【F:backend/src/routes/shares.js†L17-L83】

### B. Consumir share
1. **Cliente público** consulta `GET /api/shares/:token`.
2. **Valida expiración/estado** (`isActive` o `isPublic`).
3. **Devuelve metadata** para UI.

**Fuente**: `shares.js` info.【F:backend/src/routes/shares.js†L85-L123】

### C. Descargar share
1. **Cliente público** llama `POST /api/shares/:token/download`.
2. **Valida expiración/estado** del share.
3. **Busca file** en `files` y valida `bucketKey`.
4. **(Opcional)** escanea con Cloudmersive si es sospechoso.
5. **Genera presigned GET** (5 min) y responde.
6. **Incrementa `downloadCount`** en el share.

**Fuente**: `shares.js` download.【F:backend/src/routes/shares.js†L126-L220】

### D. Imagen embebida
1. **Cliente público** llama `GET /api/shares/:token/image`.
2. **Valida expiración/estado** del share.
3. **Obtiene file** y valida `bucketKey`.
4. **Proxy stream** desde B2 (CORS abierto).
5. **Incrementa contador** (best-effort).

**Fuente**: `shares.js` image.【F:backend/src/routes/shares.js†L232-L330】

---

## 3) File access pipeline

### A. Listado de archivos
1. **Cliente autenticado** llama `GET /api/files/list`.
2. **Cache**: `cacheFiles` puede responder sin tocar Firestore.
3. **Query de archivos**: `files` con `userId` y `deletedAt == null`.
4. **Query de carpetas**: `files` con `type == 'folder'`.
5. **Merge + sort** por `updatedAt/modifiedAt`.

**Fuente**: `files.js` list.【F:backend/src/routes/files.js†L14-L132】

### B. Presigned download
1. **Cliente autenticado** llama `POST /api/files/presign-get`.
2. **Valida ownership** y `deletedAt`.
3. **Si `bucketKey` existe**: presigned GET (5 min).
4. **Fallback**: si no hay `bucketKey` pero hay `url` absoluta, devuelve esa URL.

**Fuente**: `files.js` presign-get.【F:backend/src/routes/files.js†L150-L223】

---

## Hallazgos (riesgos / inconsistencias / redundancias)

### Uploads
- **Redundancia de pipelines**: existen dos caminos de upload (`/api/uploads/*` vs `/upload`) con esquemas de metadata distintos (`bucketKey` y `bucketPath`, `name` y `fileName`). Esto complica consistencia y consumo downstream.【F:backend/src/routes/upload.js†L22-L262】【F:backend/src/routes/external-upload.js†L130-L199】
- **Validación de MIME limitada**: se exige `mime`, pero no hay whitelist/denylist formal en presign (el cliente puede mentir sobre tipo).【F:backend/src/routes/upload.js†L49-L90】

### Shares
- **Token no criptográfico**: `Math.random()` no es apropiado para tokens públicos (riesgo de predicción).【F:backend/src/routes/shares.js†L45-L75】
- **Increment-counter público sin validación**: cualquiera puede inflar `downloadCount` sin auth ni verificación real de token válido.【F:backend/src/routes/shares.js†L360-L430】

### File access
- **Fallback a URL externa**: si `bucketKey` falta, se devuelve `fileData.url` sin validar origen/allowlist. Esto puede permitir enlaces no controlados si el dato fue inyectado en Firestore.【F:backend/src/routes/files.js†L190-L223】
- **Visibilidad por app**: `assertItemVisibleForApp` devuelve `true` siempre, por lo que no aplica ninguna política real de visibilidad multi-app/tenant.【F:backend/src/routes/files.js†L8-L18】
