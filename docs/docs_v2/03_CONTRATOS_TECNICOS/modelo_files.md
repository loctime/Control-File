# Contrato Técnico: Colección `files`

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

**Fuente:** TRUTH.md §4.1

---

## Colección unificada

Archivos y carpetas están en la misma colección `files`.  
Diferenciación por campo `type: "file" | "folder"`.

---

## Archivo (`type: "file"`)

### Campos obligatorios

- `id`: string (ID único del documento)
- `userId`: string (owner del archivo)
- `name`: string (nombre original)
- `size`: number (tamaño en bytes)
- `mime`: string (MIME type)
- `bucketKey`: string (ruta en B2)
- `parentId`: string | null (ID de carpeta padre)
- `path`: string (ruta completa)
- `ancestors`: string[] (IDs de carpetas ancestras)
- `type`: `"file"` (diferenciador)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp
- `deletedAt`: Timestamp | null (null = activo)

### Campos opcionales

- `etag`: string (ETag de B2 para validación de integridad)

---

## Carpeta (`type: "folder"`)

### Campos obligatorios

- `id`: string (ID único del documento)
- `userId`: string (owner de la carpeta)
- `name`: string (nombre de la carpeta)
- `slug`: string (slug para URLs amigables)
- `parentId`: string | null (ID de carpeta padre)
- `path`: string (ruta completa)
- `ancestors`: string[] (IDs de carpetas ancestras)
- `type`: `"folder"` (diferenciador)
- `createdAt`: Timestamp
- `modifiedAt`: Timestamp (o `updatedAt`, ambos aceptados)
- `deletedAt`: Timestamp | null (null = activo)

---

## Reglas de negocio

1. **Ownership:** `userId` debe coincidir con `uid()` del usuario autenticado
2. **Soft delete:** `deletedAt == null` significa activo
3. **Jerarquía:** `ancestors` contiene IDs de todas las carpetas ancestras
4. **Path:** Se calcula recursivamente desde `parentId`

---

## Queries comunes

```javascript
// Listar archivos activos del usuario
collection('files')
  .where('userId', '==', uid)
  .where('deletedAt', '==', null)
  .where('type', '==', 'file')

// Listar carpetas activas del usuario
collection('files')
  .where('userId', '==', uid)
  .where('deletedAt', '==', null)
  .where('type', '==', 'folder')
```

---

## Referencias

- TRUTH.md §4.1
- 02_FILOSOFIA_Y_PRINCIPIOS.md §2.1

