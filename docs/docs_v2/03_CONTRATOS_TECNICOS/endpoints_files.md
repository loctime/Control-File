# Contrato Técnico: Endpoints de Files

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

**Fuente:** TRUTH.md §6

---

## Base path

Todos los endpoints están en `/api/files`.

**Nota:** Estos endpoints son core de ControlFile y no están pensados para uso directo por apps externas.

---

## Endpoints protegidos (requieren autenticación)

### POST /api/files/restore

Restaurar archivo desde papelera.

**Body:**
```typescript
{
  fileId: string;
}
```

**Respuesta:**
```typescript
{
  success: true;
  message: string;
}
```

**Validaciones:**
- Usuario autenticado
- Archivo existe en `files/{fileId}`
- Ownership: `fileData.userId === uid`
- Archivo en papelera: `fileData.deletedAt !== null`
- Cuota disponible: `usedBytes + fileData.size <= planQuotaBytes`

**Efectos sobre `files`:**
- `files/{fileId}.deletedAt = null`
- `files/{fileId}.updatedAt = now`

**Efectos sobre cuota:**
- `users/{uid}.usedBytes += fileData.size`

**Efectos sobre B2:**
- Ninguno (archivo ya existe en B2)

---

### POST /api/files/permanent-delete

Eliminar permanentemente archivo de papelera.

**Body:**
```typescript
{
  fileId: string;
}
```

**Respuesta:**
```typescript
{
  success: true;
  message: string;
}
```

**Validaciones:**
- Usuario autenticado
- Archivo existe en `files/{fileId}`
- Ownership: `fileData.userId === uid`
- Archivo en papelera: `fileData.deletedAt !== null`

**Efectos sobre `files`:**
- Elimina documento `files/{fileId}` completamente

**Efectos sobre cuota:**
- Ninguno (cuota ya fue decrementada al mover a papelera)

**Efectos sobre B2:**
- Elimina objeto físico usando `bucketKey`

---

### POST /api/files/zip

Descargar múltiples archivos como ZIP.

**Body:**
```typescript
{
  fileIds: string[];
  zipName?: string; // Opcional, default: "seleccion"
}
```

**Respuesta:** Stream `application/zip` (no JSON)

**Headers:**
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="{zipName}-{timestamp}.zip"`

**Validaciones:**
- Usuario autenticado
- `fileIds` es array no vacío
- Máximo 200 archivos
- Para cada archivo:
  - Existe en `files/{fileId}`
  - Ownership: `fileData.userId === uid`
  - No eliminado: `fileData.deletedAt === null`
  - Es archivo: `fileData.type === "file"` (no carpetas)
  - Tiene `bucketKey`

**Efectos sobre `files`:**
- Ninguno (solo lectura)

**Efectos sobre cuota:**
- Ninguno

**Efectos sobre B2:**
- Genera presigned URLs temporales (expiración: 5 minutos) para cada archivo
- Stream directo desde B2 al ZIP

**Nota:** Archivos con nombres duplicados se renombran automáticamente en el ZIP.

---

### POST /api/files/empty-trash

Eliminar permanentemente múltiples archivos de papelera.

**Body:**
```typescript
{
  fileIds: string[];
}
```

**Respuesta:**
```typescript
{
  success: true;
  deletedIds: string[]; // IDs eliminados exitosamente
  notFound: string[]; // IDs no encontrados
  unauthorized: string[]; // IDs sin permisos
}
```

**Validaciones:**
- Usuario autenticado
- `fileIds` es array no vacío
- Para cada archivo:
  - Existe en `files/{fileId}` (o se marca como `notFound`)
  - Ownership: `fileData.userId === uid` (o se marca como `unauthorized`)

**Efectos sobre `files`:**
- Elimina documentos `files/{fileId}` en batch para archivos válidos

**Efectos sobre cuota:**
- `users/{uid}.usedBytes -= sum(fileData.size)` (decrementa total de tamaños)

**Efectos sobre B2:**
- Elimina objetos físicos usando `bucketKey` para cada archivo válido
- Tolerante a errores: continúa aunque falle B2 para algún archivo

---

## Referencias

- TRUTH.md §6
- 02_FILOSOFIA_Y_PRINCIPIOS.md §5.1, §7.2
- 04_FLUJOS_EJECUTABLES/upload.md

