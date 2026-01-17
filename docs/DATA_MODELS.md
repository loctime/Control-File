# ControlFile Backend (Express) — Modelos de Datos

> Modelos derivados **exclusivamente** del uso en `backend/src`.

## Colección: `files`
Usada para archivos y carpetas (folders se marcan con `type: 'folder'`).

**Campos observados (según uso real):**
- `id`: id interno del documento (se escribe explícitamente al crear).【F:backend/src/routes/upload.js†L232-L247】
- `userId`: dueño del archivo.【F:backend/src/routes/upload.js†L232-L247】【F:backend/src/routes/external-upload.js†L130-L199】
- `name` / `fileName`: nombre del archivo (externo guarda ambos).【F:backend/src/routes/external-upload.js†L130-L199】
- `size`: tamaño en bytes.【F:backend/src/routes/upload.js†L232-L247】
- `mime`: MIME type.【F:backend/src/routes/upload.js†L232-L247】
- `parentId`: carpeta padre (null si root o archivo externo).【F:backend/src/routes/upload.js†L232-L247】【F:backend/src/routes/external-upload.js†L130-L199】
- `bucketKey`: clave en B2 (requerida para presign/get/share).【F:backend/src/routes/upload.js†L232-L247】【F:backend/src/routes/shares.js†L140-L190】
- `etag`: hash devuelto por B2 en upload.【F:backend/src/routes/upload.js†L232-L247】
- `createdAt`, `updatedAt`, `deletedAt`: timestamps de control (soft delete).【F:backend/src/routes/upload.js†L232-L247】【F:backend/src/routes/files.js†L222-L235】
- `ancestors`: cadena de ancestros (solo en upload presign).【F:backend/src/routes/upload.js†L232-L247】
- Campos específicos de cargas externas:
  - `companyId`, `auditId`, `sourceApp`, `bucketPath`, `fileURL`, `metadata`, `uploadedBy`.【F:backend/src/routes/external-upload.js†L130-L199】

## Colección: `uploadSessions`
Sesiones temporales para uploads presign o proxy.

**Campos observados:**
- `uid`: dueño de la sesión.【F:backend/src/routes/upload.js†L111-L144】
- `size`, `name`, `mime`: metadatos del archivo.【F:backend/src/routes/upload.js†L111-L144】
- `parentId`, `ancestors`: ubicación lógica en árbol.【F:backend/src/routes/upload.js†L111-L144】
- `status`: `pending`, `uploaded`, `completed`.【F:backend/src/routes/upload.js†L111-L144】【F:backend/src/routes/upload.js†L273-L306】
- `expiresAt`: expiración de la sesión (24h).【F:backend/src/routes/upload.js†L111-L144】
- `bucketKey`, `uploadId`: referencia a B2 y multipart upload.【F:backend/src/routes/upload.js†L111-L144】
- `etag`, `virusScan`: cuando el upload se hace vía `proxy-upload`.【F:backend/src/routes/upload.js†L273-L306】

## Colección: `shares`
Tokens públicos para compartir archivos.

**Campos observados:**
- `token`: ID del share (doc id).【F:backend/src/routes/shares.js†L45-L83】
- `fileId`, `uid`: archivo y dueño.【F:backend/src/routes/shares.js†L45-L83】
- `fileName`, `fileSize`, `mime`: metadata para previsualización.【F:backend/src/routes/shares.js†L45-L83】
- `expiresAt`: expiración (si existe).【F:backend/src/routes/shares.js†L45-L83】
- `isActive`: activo/inactivo (revocado).【F:backend/src/routes/shares.js†L45-L83】【F:backend/src/routes/shares.js†L300-L333】
- `downloadCount`, `lastDownloadAt`: métricas de descarga.【F:backend/src/routes/shares.js†L45-L83】【F:backend/src/routes/shares.js†L360-L430】
- `virusScanned`, `revokedAt`, `revokedReason`: control de seguridad (algunos opcionales).【F:backend/src/routes/shares.js†L160-L190】【F:backend/src/routes/shares.js†L300-L333】

## Colección: `users`
- Se auto-inicializa si no existe, con cuota y email básico.【F:backend/src/middleware/auth.js†L44-L80】
- Campos observados: `planQuotaBytes`, `usedBytes`, `pendingBytes`, `createdAt`, `email`.【F:backend/src/middleware/auth.js†L44-L80】

## Colección: `stores` (integración Google Sheets)
- `googleSheet`: objeto con `spreadsheetId`, `sheetId`, `editUrl`, `createdAt`, `lastSyncAt`.【F:backend/src/routes/stores/sheets.js†L83-L108】
- Subcolección `products`: productos sincronizados, con `syncedAt` por item.【F:backend/src/routes/stores/sheets.js†L40-L68】
