# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.0.4] - 2025-01-XX

### Añadido
- Método `files.uploadFile()` completamente implementado y disponible en runtime
- El método asegura automáticamente que la ruta de carpetas exista antes de subir el archivo
- Función idempotente: si la ruta ya existe, la reutiliza
- Tipos públicos exportados: `UploadFileParams`, `FileResponse`, `EnsurePathParams`

### Corregido
- Eliminado archivo `uploadFile.ts` duplicado que causaba confusión
- El método ahora está correctamente implementado en `FilesModule` y disponible a través de `client.files.uploadFile()`

## [1.0.0] - 2025-01-XX

### Añadido
- SDK inicial con capacidades de archivos y shares
- Módulo `files` con métodos:
  - `list()` - Listar archivos y carpetas con paginación
  - `getDownloadUrl()` - Obtener URL de descarga presignada
  - `upload()` - Subir archivos con tracking de progreso
  - `delete()` - Eliminar archivos
  - `rename()` - Renombrar archivos
  - `replace()` - Reemplazar contenido de archivos
- Módulo `shares` con métodos:
  - `create()` - Crear share link con expiración configurable
  - `getInfo()` - Obtener información de share (público)
  - `getDownloadUrl()` - Obtener URL de descarga desde share (público)
  - `getImageUrl()` - Generar URL de imagen directa para `<img>` tags
  - `revoke()` - Revocar share link
  - `list()` - Listar shares del usuario
  - `buildShareUrl()` - Helper para construir URL pública
  - `buildImageUrl()` - Helper para construir URL de imagen
- Sistema completo de errores tipados:
  - `AuthenticationError` - Errores de autenticación (401)
  - `NotFoundError` - Recurso no encontrado (404)
  - `ForbiddenError` - Acceso denegado (403)
  - `QuotaExceededError` - Cuota excedida (413)
  - `ValidationError` - Parámetros inválidos (400)
  - `NetworkError` - Errores de red o timeout
  - `ServerError` - Errores del servidor (5xx)
- Normalización automática de errores HTTP
- Reintentos automáticos para errores de red y servidor
- Timeouts configurables
- Validación de parámetros de entrada
- Tipos TypeScript completos para todas las operaciones
- Documentación completa en README.md
