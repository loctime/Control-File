# ControlFile – Filosofía y Principios (Para IA/Agentes)

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

Este documento define principios **operativos** para evitar decisiones incorrectas, inventos y regresiones.

**Autoridad:** `TRUTH.md` es la fuente única de verdad técnica.  
Este documento solo interpreta TRUTH.md en forma de reglas accionables.

---

## 1. Separación de responsabilidades

### 1.1 Apps NO gestionan storage
- Apps no generan URLs presignadas
- Apps no manejan CORS
- Apps no validan permisos públicos
- Apps no acceden directamente a B2

**Consecuencia:** Si una app necesita acceso a archivos, usa endpoints del backend ControlFile.

**Antipatrón:** La app genera presigned URL directo contra B2.

**Referencia:** TRUTH.md §1, §3

---

## 2. Modelo de datos unificado

### 2.1 Colección `files` es única para items (file/folder)
- Archivos y carpetas están en `files`
- Diferenciación por `type: "file" | "folder"`
- La colección `folders` es legacy (no usar)

**Consecuencia:** Queries usan `collection('files')` + filtro `type`.

**Nota:** El código actual fuerza `type: 'file'` al listar si falta (política de compatibilidad). Según TRUTH.md, `type` es obligatorio. Nuevos documentos deben establecerlo explícitamente.

**Antipatrón:** Escribir o depender de `collection('folders')` o crear documentos sin `type`.

**Referencia:** TRUTH.md §4.1, §5.1

### 2.2 Campo `bucketKey` es el identificador de storage
- Campo oficial: `bucketKey`
- No introducir variantes (`b2Key`, `objectKey`, `key`) como estándar

**Consecuencia:** Validar `bucketKey` antes de cualquier operación con B2 o share/image.

**Antipatrón:** Asumir nombres alternativos o mapear sin documentar en TRUTH.

**Referencia:** TRUTH.md §4.1

### 2.3 Cuotas: `planQuotaBytes` + `usedBytes` + `pendingBytes`
- Campo oficial: `planQuotaBytes`
- `pendingBytes` existe y afecta validación

**Consecuencia:** La validación correcta es:
`usedBytes + pendingBytes + size <= planQuotaBytes`

**Antipatrón:** Usar `quotaBytes` o ignorar `pendingBytes`.

**Referencia:** TRUTH.md §4.3, §8.1

---

## 3. Seguridad siempre en backend

### 3.1 Validación doble (Rules + backend)
- Firestore Rules dan un piso mínimo
- Backend valida ownership/permisos en operaciones críticas

**Consecuencia:** Backend verifica ownership antes de presign, delete, rename, replace, create share.

**Antipatrón:** Confiar solo en Rules o mover validaciones al frontend.

**Referencia:** TRUTH.md §5

### 3.2 Presigned URLs son efímeras y NO se persisten
- Descarga: ~5 min
- Upload: ~1 h
- No guardar URLs presignadas en Firestore/DB
- No cachearlas como “fuente de verdad”

**Consecuencia:** Generar presigned URL bajo demanda.

**Nota:** Se permite caching HTTP controlado en proxies (ej. `Cache-Control`), no en Firestore.

**Antipatrón:** Guardar presigned URL en documentos o “reutilizarlas”.

**Referencia:** TRUTH.md §3.3

### 3.3 Proxy stream para imágenes (CORS)
- `/api/shares/{token}/image` hace stream directo desde B2
- No genera presigned URL
- Resuelve CORS para `<img>`

**Consecuencia:** Para rendering de imágenes cross-domain, usar el proxy.

**Antipatrón:** Usar presigned URLs para `<img>` en dominios distintos.

**Referencia:** TRUTH.md §7.2, §8.4

---

## 4. Identidad y ownership por colección

### 4.1 `files` usa `userId`
- Ownership de files/folders se expresa con `userId`

**Consecuencia:** Al crear items en `files`, siempre setear `userId: uid`.

**Antipatrón:** Usar `uid` dentro de `files`.

**Referencia:** TRUTH.md §4.1

### 4.2 `shares` y `uploadSessions` usan `uid`
- `shares.uid` = owner que creó el share
- `uploadSessions.uid` = owner de la sesión

**Consecuencia:** No intentar normalizar todo a `userId` si contradice TRUTH/código.

**Antipatrón:** Mezclar `userId`/`uid` dentro de la misma colección sin documentarlo.

**Referencia:** TRUTH.md §4.2, §4.4

### 4.3 Shares validan token (no auth)
- Endpoints públicos validan: existe + activo + no expirado
- Ownership se valida al crear share (endpoint protegido)

**Consecuencia:** Endpoints públicos de shares no deben exigir auth.

**Antipatrón:** Exigir auth en `GET /shares/{token}`, `/download`, `/image`.

**Referencia:** TRUTH.md §7.2

---

## 5. Soft delete (Firestore)

### 5.1 Eliminación lógica en `files`
- `deletedAt` marca eliminación lógica
- Queries y listados deben filtrar `deletedAt == null`

**Consecuencia:** Nunca asumir que “no existe” si tiene `deletedAt`.

**Nota:** Borrado físico existe como endpoint explícito `POST /api/files/permanent-delete`.
Este endpoint requiere que el archivo ya esté en papelera (`deletedAt !== null`) y elimina físicamente de B2 y Firestore.

**Antipatrón:** Borrar físicamente como comportamiento por defecto sin decisión formal.

**Referencia:** TRUTH.md §4.1

---

## 6. Campos obligatorios vs opcionales

### 6.1 No inventar campos fuera de TRUTH
- Solo usar campos documentados
- Opcionales pueden faltar: validar existencia

**Consecuencia:** Si aparece una necesidad nueva, primero actualizar TRUTH.md.

**Antipatrón:** “Agregar rápido” campos no documentados y que agentes los asuman.

**Referencia:** TRUTH.md §4

### 6.2 Legacy controlado
- `shares.isPublic` es legacy
- Lectura debe ser retrocompatible
- Escritura nueva NO debe generar legacy

**Consecuencia:** Leer legacy, escribir moderno.

**Antipatrón:** Crear nuevos shares con `isPublic` o depender solo de legacy.

**Referencia:** TRUTH.md §4.2

---

## 7. Flujos críticos

### 7.1 Upload requiere sesión
- Crear `uploadSessions` antes de subir
- Upload directo a B2 con presigned
- Confirmar y recién ahí crear/activar `files`

**Consecuencia:** No crear `files` definitivos sin confirmación.

**Antipatrón:** Crear `files` antes de que el upload esté confirmado.

**Referencia:** TRUTH.md §4.4, §8.1

### 7.2 Cuota se valida ANTES de presign
- Validar con `usedBytes + pendingBytes + size`
- Actualizar `pendingBytes` al crear sesión
- Ajustar `usedBytes/pendingBytes` al completar

**Nota:** Restore también valida cuota antes de restaurar: `usedBytes + fileSize <= planQuotaBytes`.

**Nota:** Replace NO valida cuota antes, solo ajusta delta (`newSize - oldSize`). Si `newSize > oldSize` y no hay cuota, el incremento puede fallar.

**Antipatrón:** Validar cuota después del upload.

**Referencia:** TRUTH.md §4.3

---

## 8. Firestore Rules y riesgo de lectura pública

### 8.1 `files` es lectura pública por diseño (si se mantiene `allow read: if true`)
**Regla:** No almacenar metadatos sensibles en `files`.

**Consecuencia:** Cualquier campo “privado” debe ir a otra colección o cambiar rules.

**Antipatrón:** Agregar campos sensibles a `files` mientras read es público.

**Referencia:** TRUTH.md §5.1

---

## 9. Endpoints de shares

### 9.1 Públicos: sin auth, con validación estricta de share
Validación mínima en cada endpoint público:
- share existe
- no expirado (`expiresAt > now` o `null`)
- activo (`isActive !== false` y `isPublic !== false` si existe)
- Si `isPublic` es `undefined`, se trata como válido (solo `false` revoca)

**Antipatrón:**
