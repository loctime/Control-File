# ControlFile Backend (Express) — Storage & Security

## Storage
### Backblaze B2 (S3 API)
- Se usa el SDK S3 para `PutObject`, `GetObject`, `HeadObject`, multipart y streaming. La región se deriva del endpoint de B2 y se usa `forcePathStyle`.【F:backend/src/services/b2.js†L1-L33】
- **Presigned URLs**:
  - Subida (`PutObject`) para `/api/uploads/presign` y descargas (`GetObject`) para `/api/files/presign-get` y shares.【F:backend/src/services/b2.js†L34-L73】【F:backend/src/routes/files.js†L150-L223】【F:backend/src/routes/shares.js†L126-L220】
- **Multipart**: se habilita si el archivo supera 128MB y se generan partes con URLs presignadas.【F:backend/src/services/b2.js†L92-L155】【F:backend/src/routes/upload.js†L72-L110】
- **Proxy streaming**: `/api/shares/:token/image` hace stream directo desde B2 para servir imágenes con CORS abierto.【F:backend/src/routes/shares.js†L232-L330】

## Autenticación y autorización
- **JWT Firebase**: `authMiddleware` verifica el `Authorization: Bearer <token>` usando un proyecto de identidad (app `authApp`) y construye `req.user` con UID/email.【F:backend/src/middleware/auth.js†L1-L136】
- **Auto-provisioning**: si el usuario no existe en Firestore, se crea con cuota por defecto (en bytes).【F:backend/src/middleware/auth.js†L44-L80】

## Seguridad de archivos
- **Quota enforcement**: en `/api/uploads/presign` se valida la cuenta y la cuota antes de presignar la subida.【F:backend/src/routes/upload.js†L62-L90】
- **Virus scan (opcional)**: Cloudmersive se usa para escanear archivos sospechosos en `proxy-upload` y en downloads de shares; si no hay API key, el servicio se deshabilita automáticamente.【F:backend/src/routes/upload.js†L279-L306】【F:backend/src/routes/shares.js†L160-L190】【F:backend/src/services/cloudmersive.js†L1-L52】

## Riesgos y notas de seguridad observadas
- **Tokens públicos de share no criptográficos**: se generan con `Math.random()`, lo que no es seguro para tokens expuestos públicamente.【F:backend/src/routes/shares.js†L45-L75】
- **Endpoint público `increment-counter`**: permite incrementar contadores sin verificación real, lo que habilita abuso de métricas.【F:backend/src/routes/shares.js†L360-L430】
- **Fallback a URL externa**: si un archivo no tiene `bucketKey`, `presign-get` devuelve `fileData.url` sin validar dominio; esto podría exponer recursos externos no controlados.【F:backend/src/routes/files.js†L190-L223】
- **Control de visibilidad multi-app**: `assertItemVisibleForApp` retorna `true` siempre, sin aplicar controles por app/tenant.【F:backend/src/routes/files.js†L8-L18】
