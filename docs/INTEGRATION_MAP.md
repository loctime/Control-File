# ControlFile Backend (Express) — Mapa de Integraciones

## Firebase (Auth + Firestore)
- **Auth**: el middleware valida `ID Tokens` con `centralAuth.verifyIdToken` desde un proyecto de identidad dedicado (`authApp`).【F:backend/src/middleware/auth.js†L1-L136】
- **Firestore**: se usa para `files`, `uploadSessions`, `shares`, `users`, `stores`, etc. (en rutas y servicios).【F:backend/src/routes/upload.js†L111-L187】【F:backend/src/routes/shares.js†L45-L83】【F:backend/src/routes/stores/sheets.js†L16-L108】

## Backblaze B2 (S3 API)
- Presigned URLs y operaciones directas (put/get/head/delete), incluido multipart y streaming por API S3 compatible.【F:backend/src/services/b2.js†L1-L200】
- Utilizado por uploads y shares (descargas presignadas y proxy image).【F:backend/src/routes/upload.js†L72-L110】【F:backend/src/routes/shares.js†L126-L330】

## Cloudmersive (Virus/OCR/Convert)
- Integración opcional para virus scan, OCR y conversiones; se desactiva si no hay API key o módulos instalados.【F:backend/src/services/cloudmersive.js†L1-L118】
- Se usa en `proxy-upload` y en descargas de shares para archivos sospechosos.【F:backend/src/routes/upload.js†L279-L306】【F:backend/src/routes/shares.js†L160-L190】

## GitHub (URL-only)
- **Repositorios por URL**: Los repositorios se acceden directamente por URL (owner/repo). GitHub OAuth no se utiliza.
- **Token por entorno**: Se usa `process.env.GITHUB_TOKEN` como fallback automático si el acceso público falla (401/403/404).
- **Stub defensivo**: `/api/github/status` se mantiene como stub estático para compatibilidad con frontends antiguos.【F:backend/src/routes/github-status.js†L1-L36】
- **Indexación**: Los indexadores intentan acceso público primero, luego fallback a token de entorno.【F:backend/src/services/repository-indexer.js†L13-L170】

## Google Sheets / Drive
- Integración en `/api/stores/*` para crear hojas, compartir con service account y leer productos desde Sheets.【F:backend/src/routes/stores/sheets.js†L1-L200】

## Audio Processing (FFmpeg)
- Endpoint `/api/audio/master` descarga desde B2, procesa audio (FFmpeg o modo simplificado) y guarda resultados en B2/Firestore.【F:backend/src/routes/audio.js†L1-L120】
