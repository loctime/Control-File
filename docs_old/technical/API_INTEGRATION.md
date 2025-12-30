# Guía de Integración con la API de ControlFile

Esta guía te muestra cómo integrar aplicaciones externas (por ejemplo, ControlAudit/ControlDoc) con ControlFile para autenticar usuarios mediante tu proyecto de Auth central y gestionar archivos (listar, subir, descargar, compartir) usando la API.

## Requisitos previos
- Proyecto de Auth central Firebase (ejemplo: `controlstorage-eb796`).
- Backend de ControlFile desplegado (Render u otro) con variables:
  - `FB_ADMIN_IDENTITY` (service account del proyecto de Auth central)
  - `FB_ADMIN_APPDATA` (service account del proyecto de datos, ej. `controlfile-data`)
  - `FB_DATA_PROJECT_ID=controlfile-data`
  - `APP_CODE=controlfile` (fijo para todas las integraciones)
  - `ALLOWED_ORIGINS` incluye tu frontend externo (ej. `https://auditoria.controldoc.app`, `http://localhost:5173`).
- Asignar claims de acceso a los usuarios (una sola vez por usuario):
  ```bash
  npm run set-claims -- --email tu-correo@dominio \
    --apps controlfile,controlaudit,controldoc \
    --plans controlfile=pro;controlaudit=basic;controldoc=trial
  ```

## Autenticación
- Obtén un ID token de Firebase en tu frontend (Auth central).
- Envía el token en el header: `Authorization: Bearer <ID_TOKEN>` a todas las rutas privadas.
- Control de acceso: el backend valida que el claim `allowedApps` del usuario incluya las aplicaciones permitidas (ej. `controlfile`, `controlaudit`, `controldoc`).

**Nota importante**: Todas las aplicaciones externas comparten el mismo backend con `APP_CODE=controlfile`. Los datos no se separan por aplicación, sino que se controla el acceso mediante el claim `allowedApps` del usuario.

## SDK recomendado (cliente)
```ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ControlFileClient } from '@/lib/controlfile-sdk';

const firebaseApp = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
});
const auth = getAuth(firebaseApp);

export const controlFile = new ControlFileClient(
  'https://<tu-backend-controlfile>.onrender.com',
  async () => auth.currentUser!.getIdToken()
);

export async function loginWithGoogle() {
  await signInWithPopup(auth, new GoogleAuthProvider());
}
```

## Flujos principales

### 1) Subida simple (PUT presignado)
1. `POST /api/uploads/presign` con `{ name, size, mime, parentId? }`.
2. Realiza `PUT` al `url` devuelto.
3. Confirma: `POST /api/uploads/confirm` con `{ uploadSessionId, etag }`.

Ejemplo con SDK:
```ts
const presign = await controlFile.presignUpload({ name: file.name, size: file.size, mime: file.type, parentId: null });
const put = await fetch(presign.url, { method: 'PUT', body: file });
await controlFile.confirm({ uploadSessionId: presign.uploadSessionId, etag: put.headers.get('etag') || undefined });
```

### 2) Subida multipart (archivos grandes)
- `presign` devuelve `multipart` con `uploadId` y `parts[]`.
- Sube cada parte a las URLs indicadas.
- Confirma con `POST /api/uploads/confirm` incluyendo `parts: [{ PartNumber, ETag }]`.

### 3) Proxy de subida (opcional)
- Si necesitas evitar CORS en el `PUT`, usa el proxy del backend:
  - `POST /api/uploads/proxy-upload` con `multipart/form-data` (`file`, `sessionId`).
  - Primero crea la sesión con `/api/uploads/presign` y usa su `uploadSessionId` como `sessionId`.

### 4) Descarga
- `POST /api/files/presign-get` con `{ fileId }` para obtener `downloadUrl` temporal (5 min).

### 5) Carpetas
- `GET /api/folders/root?name=<Nombre>&pin=1` crea/obtiene la raíz de la app y puede fijarla en la barra del usuario.
- `POST /api/folders/create` crea carpetas hijas.

### 6) Compartir
- `POST /api/shares/create` genera un `shareToken` y `shareUrl` público (expirable).
- Público (sin auth): `GET /api/shares/:token` y `POST /api/shares/:token/download` para obtener `downloadUrl`.
- Revocar: `POST /api/shares/revoke`.

## Ejemplos rápidos (curl)
```bash
# Listar raíz
curl -H "Authorization: Bearer $ID_TOKEN" \
  "https://<backend>/api/files/list?parentId=null&pageSize=20"

# Presign de subida
curl -X POST -H "Authorization: Bearer $ID_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"demo.txt","size":12,"mime":"text/plain","parentId":null}' \
  "https://<backend>/api/uploads/presign"

# Confirmar subida
curl -X POST -H "Authorization: Bearer $ID_TOKEN" -H "Content-Type: application/json" \
  -d '{"uploadSessionId":"us_...","etag":"..."}' \
  "https://<backend>/api/uploads/confirm"

# Presign de descarga
curl -X POST -H "Authorization: Bearer $ID_TOKEN" -H "Content-Type: application/json" \
  -d '{"fileId":"f_..."}' \
  "https://<backend>/api/files/presign-get"
```

## Errores comunes y solución
- 401 No autorizado: falta o es inválido `Authorization: Bearer <ID_TOKEN>`.
- 403 Forbidden: el claim `allowedApps` del usuario no incluye la aplicación requerida (ej. `controlfile`, `controlaudit`, `controldoc`).
- 413 Espacio insuficiente: supera cuota del usuario (ver `planQuotaBytes`, `usedBytes`, `pendingBytes`).
- CORS bloqueado: agrega tu dominio a `ALLOWED_ORIGINS` del backend.
- Firestore PERMISSION_DENIED / CONSUMER_INVALID: revisa `FB_ADMIN_APPDATA` y `FB_DATA_PROJECT_ID` y habilita la API de Firestore.

## Checklist
- Autenticación con el proyecto de Auth central correcta (token válido).
- Listado `GET /api/files/list` responde 200 con items.
- Subida (`presign` → `PUT`/proxy → `confirm`) completada y `fileId` creado.
- Descarga (`presign-get`) retorna URL funcional.

---
Consulta la referencia completa de endpoints en `API_REFERENCE.md`.
