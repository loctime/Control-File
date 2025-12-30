# Glosario

⚠️ **Este documento NO define comportamiento. Deriva estrictamente de TRUTH.md. Ante contradicción, TRUTH.md manda.**

---

Términos técnicos y conceptos clave de ControlFile.

---

## Términos principales

### `bucketKey`
Campo en `files` que contiene la ruta del archivo en B2.  
Formato: `users/{userId}/files/{timestamp}-{name}`

### `fileId`
ID único del documento en colección `files`.  
Puede ser archivo (`type: "file"`) o carpeta (`type: "folder"`).

### `shareToken`
Token aleatorio que identifica un share público.  
Es el ID del documento en colección `shares`.

### `uploadSessionId`
ID único de una sesión de upload temporal.  
Documento en `uploadSessions` que expira en 24 horas.

### `presigned URL`
URL temporal generada por B2 que permite acceso directo sin autenticación.  
Expira en 5 minutos (descarga) o 1 hora (upload).

### `proxy stream`
Stream directo desde B2 a través del backend.  
Usado para imágenes CORS-safe (`/api/shares/{token}/image`).

---

## Colecciones Firestore

### `files`
Colección unificada para archivos y carpetas.  
Diferenciación por campo `type`.

### `shares`
Shares públicos de archivos.  
Indexado por `token`.

### `uploadSessions`
Sesiones temporales de upload.  
Expiran en 24 horas.

### `users`
Información de usuarios y cuotas.

---

## Conceptos de seguridad

### Ownership
Propiedad de un recurso.  
Validado por `userId == uid()` en `files`, `uid` en otras colecciones.

### Soft delete
Eliminación lógica marcada con `deletedAt`.  
Archivo permanece en Firestore y B2.

### Permanent delete
Eliminación física de Firestore y B2.  
Requiere endpoint explícito `POST /api/files/permanent-delete`.

---

## Referencias

- TRUTH.md (definiciones canónicas)
- 02_FILOSOFIA_Y_PRINCIPIOS.md (principios operativos)

