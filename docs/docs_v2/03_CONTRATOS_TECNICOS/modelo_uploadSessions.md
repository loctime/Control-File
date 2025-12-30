# Contrato Técnico: Colección `uploadSessions`

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

**Fuente:** TRUTH.md §4.4

---

## Propósito

Sesiones temporales para uploads en progreso.  
Se crean antes del upload, se confirman después.

---

## Campos obligatorios

- `uid`: string (owner de la sesión)
- `bucketKey`: string (ruta en B2 donde se subirá)
- `size`: number (tamaño del archivo en bytes)
- `name`: string (nombre del archivo)
- `mime`: string (MIME type)
- `status`: `'pending' | 'uploaded' | 'completed'`
- `expiresAt`: Timestamp (sesión expira en 24 horas)
- `createdAt`: Timestamp

---

## Campos opcionales

- `parentId`: string | null (carpeta padre donde se subirá)
- `uploadId`: string (para multipart uploads)
- `ancestors`: string[] (IDs de carpetas ancestras)
- `completedAt`: Timestamp (cuando `status = 'completed'`)

---

## Estados de sesión

1. **`pending`**: Sesión creada, upload no iniciado o en progreso
2. **`uploaded`**: Upload completado a B2, pendiente de confirmación
3. **`completed`**: Confirmado, archivo creado en `files`

---

## Flujo de estados

```
pending → uploaded → completed
```

**Nota:** Una sesión puede pasar de `pending` directamente a `completed` si no hay pasos intermedios.

---

## Validación de cuota

Antes de crear sesión:
- Validar: `usedBytes + pendingBytes + size <= planQuotaBytes`
- Actualizar: `pendingBytes += size`

Al confirmar:
- Actualizar: `usedBytes += size`
- Actualizar: `pendingBytes -= size`

---

## Referencias

- TRUTH.md §4.4, §8.1
- 02_FILOSOFIA_Y_PRINCIPIOS.md §7.1, §7.2

