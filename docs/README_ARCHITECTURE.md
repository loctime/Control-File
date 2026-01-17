# ControlFile Backend (Express) — Arquitectura Técnica

## Alcance
Esta documentación describe **exclusivamente** el backend Express ubicado en `backend/src`. El objetivo es reflejar el comportamiento real del código (sin suposiciones externas).

## Entry point y composición del servicio
- **Entry point**: `backend/src/index.js` inicializa Express, CORS, Helmet, rate limiting y logging, y monta los routers de dominio. Las rutas relevantes para archivos y compartidos se exponen bajo `/api/uploads`, `/api/files`, `/api/folders`, `/api/shares` y el endpoint público `/upload`.【F:backend/src/index.js†L1-L236】
- **Autenticación centralizada**: `backend/src/middleware/auth.js` valida tokens Firebase con un proyecto de identidad separado, auto-inicializa usuarios y expone `req.user` y `req.uid`.【F:backend/src/middleware/auth.js†L1-L136】
- **Almacenamiento**: Backblaze B2 se integra vía el SDK S3, con soporte de presigned URLs, multipart y acceso directo (buffer/stream).【F:backend/src/services/b2.js†L1-L200】

## Capas lógicas (backend/src)
1. **HTTP/Express layer**: define endpoints, valida inputs, y gestiona respuestas/errores (routes/*).【F:backend/src/routes/upload.js†L1-L220】
2. **Middleware de seguridad/identidad**: `auth.js` aplica Firebase Auth y construye el contexto de usuario.【F:backend/src/middleware/auth.js†L1-L136】
3. **Servicios de integración**:
   - **Backblaze B2** (S3): presign, multipart, delete, metadata, streaming.【F:backend/src/services/b2.js†L1-L200】
   - **Cloudmersive**: antivirus, OCR y conversiones (activables por API key).【F:backend/src/services/cloudmersive.js†L1-L118】
4. **Persistencia**: Firestore vía Admin SDK (colecciones `files`, `uploadSessions`, `shares`, `users`, `stores`, etc.).【F:backend/src/routes/upload.js†L111-L187】【F:backend/src/routes/shares.js†L45-L83】【F:backend/src/routes/stores/sheets.js†L16-L108】

## Rutas clave en el backend
- **Uploads**: `/api/uploads/presign`, `/api/uploads/confirm`, `/api/uploads/proxy-upload` (todas con auth).【F:backend/src/routes/upload.js†L22-L330】
- **Upload externo**: `/upload` (multipart/form-data) para apps externas autenticadas por Firebase.【F:backend/src/index.js†L152-L168】【F:backend/src/routes/external-upload.js†L12-L210】
- **Files**: `/api/files/list`, `/api/files/presign-get`, `/api/files/delete` (auth).【F:backend/src/routes/files.js†L14-L235】
- **Shares**: `/api/shares/create`, `/api/shares/:token`, `/api/shares/:token/download`, `/api/shares/:token/image` (mixto público/privado).【F:backend/src/routes/shares.js†L17-L330】

## Controles de seguridad observados
- **Autenticación JWT**: `Authorization: Bearer <Firebase ID Token>`, verificado por `centralAuth.verifyIdToken`.【F:backend/src/middleware/auth.js†L87-L136】
- **Rate limit global** y **CORS allowlist** definidos en el entry point (aplican a todas las rutas).【F:backend/src/index.js†L31-L98】

> Nota: Los detalles de flujo y análisis de riesgos se encuentran en los documentos `SYSTEM_FLOWS.md` y `STORAGE_AND_SECURITY.md` dentro de `/docs`.
