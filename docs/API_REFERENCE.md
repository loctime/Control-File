# ControlFile Backend (Express) — API Reference (subset)

> Este documento cubre **solo** los endpoints Express relacionados con archivos, uploads y shares.

## Auth
Todos los endpoints protegidos requieren:
```
Authorization: Bearer <Firebase ID Token>
```
La validación se realiza con Firebase Admin y un proyecto de identidad dedicado.【F:backend/src/middleware/auth.js†L1-L136】

---

## Uploads
### POST `/api/uploads/presign`
Genera una URL presignada (single o multipart) para subir a B2.

**Body** (JSON):
- `name` o `fileName` (string)
- `size` o `fileSize` (number)
- `mime` o `mimeType` (string)
- `parentId` (string | null)

**Respuestas**:
- `200`: objeto `uploadSessionData` con URL presignada y/o partes multipart.
- `400/403/413`: validaciones de tamaño, cuenta o cuota.

**Notas**:
- Valida la cuenta y la cuota antes de emitir la URL.
- Crea un documento en `uploadSessions` con `status: pending`.

【F:backend/src/routes/upload.js†L22-L144】

### POST `/api/uploads/confirm`
Confirma un upload previamente presignado.

**Body** (JSON):
- `uploadSessionId` (string)
- `etag` (string, opcional)
- `parts` (array, obligatorio si multipart)

**Acciones**:
- Completa multipart si corresponde.
- Verifica existencia en B2.
- Crea documento en `files`.

【F:backend/src/routes/upload.js†L146-L262】

### POST `/api/uploads/proxy-upload`
Subida proxy: el backend recibe el archivo y lo sube a B2.

**Body**: `multipart/form-data` con `file` y `sessionId`.

**Acciones**:
- Verifica sesión en `uploadSessions`.
- (Opcional) escanea con Cloudmersive si se considera sospechoso.
- Sube a B2 y marca `uploadSessions.status = uploaded`.

【F:backend/src/routes/upload.js†L264-L330】

### POST `/upload` (externo, público autenticado)
Subida directa para aplicaciones externas.

**Body**: `multipart/form-data`
- `file` (File)
- `auditId` (string)
- `companyId` (string)
- `sourceApp` (opcional)
- `metadata` (JSON string, opcional)

**Acciones**:
- Sube a B2 con path `audits/{companyId}/{auditId}/{uuid}{ext}`.
- Genera presigned GET (7 días) para el archivo.
- Crea registro en `files`.

【F:backend/src/index.js†L152-L168】【F:backend/src/routes/external-upload.js†L12-L210】

---

## Files
### GET `/api/files/list`
Lista archivos y carpetas del usuario autenticado.

**Query**:
- `parentId` (string | null)
- `pageSize` (number, max 200)
- `cursor` (string, doc id)

**Notas**:
- Consulta `files` para archivos y carpetas y ordena por `updatedAt/modifiedAt`.

【F:backend/src/routes/files.js†L14-L132】

### POST `/api/files/presign-get`
Genera URL presignada para descarga.

**Body**: `{ fileId: string }`

**Notas**:
- Valida ownership y `deletedAt`.
- Si no existe `bucketKey` y hay `url` absoluta, devuelve URL directa.

【F:backend/src/routes/files.js†L150-L223】

### POST `/api/files/delete`
Soft delete: marca `deletedAt` y decrementa cuota del usuario.

**Body**: `{ fileId: string }`

【F:backend/src/routes/files.js†L224-L255】

---

## Shares
### POST `/api/shares/create`
Crea un token de share para un archivo del usuario.

**Body**:
- `fileId` (string)
- `expiresIn` (number, horas; default 24)

【F:backend/src/routes/shares.js†L17-L83】

### GET `/api/shares/:token`
Devuelve metadata pública del share (sin auth).

【F:backend/src/routes/shares.js†L85-L123】

### POST `/api/shares/:token/download`
Devuelve un presigned GET URL (5 minutos) y actualiza el contador.

【F:backend/src/routes/shares.js†L126-L220】

### GET `/api/shares/:token/image`
Stream directo desde B2 (útil para `<img>`), con CORS abierto.

【F:backend/src/routes/shares.js†L232-L330】

### POST `/api/shares/revoke`
Revoca un share activo (requiere auth).

【F:backend/src/routes/shares.js†L300-L333】

### GET `/api/shares`
Lista shares activos del usuario (requiere auth).

【F:backend/src/routes/shares.js†L336-L359】

### POST `/api/shares/:token/increment-counter`
Incrementa contador sin validación adicional (público, pensado para Worker).

【F:backend/src/routes/shares.js†L360-L430】
