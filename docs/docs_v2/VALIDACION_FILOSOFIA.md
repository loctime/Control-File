# Validación: 02_FILOSOFIA_Y_PRINCIPIOS.md vs Código Real

⚠️ **Este documento NO define comportamiento. Deriva estrictamente de TRUTH.md. Ante contradicción, TRUTH.md manda.**

---

## Diferencias encontradas

### 1. Soft delete vs Permanent delete
**Archivo:** `02_FILOSOFIA_Y_PRINCIPIOS.md`  
**Línea:** 142  
**Problema:** El documento afirma "Borrado físico en B2 es política separada (fuera de TRUTH salvo definición explícita)" pero el código tiene `POST /api/files/permanent-delete` que SÍ elimina físicamente.

**Código:** `backend/src/routes/files.js:300-344`
- Endpoint `POST /api/files/permanent-delete` existe
- Elimina físicamente de B2: `await b2Service.deleteObject(fileData.bucketKey)`
- Elimina documento de Firestore: `await fileRef.delete()`
- Requiere que archivo tenga `deletedAt` (ya en papelera)

**Corrección:** Documentar que permanent-delete existe como endpoint explícito, no como política separada.

---

### 2. Campo `type` al crear archivo desde upload
**Archivo:** `02_FILOSOFIA_Y_PRINCIPIOS.md`  
**Línea:** 28-31  
**Problema:** El documento afirma que `type: "file"` es obligatorio, pero el código NO establece `type` al crear archivo desde upload.

**Código:** `backend/src/routes/upload.js:208-222`
- Al crear documento en `files`, NO se establece `type: "file"`
- Solo se establecen: `id`, `userId`, `name`, `size`, `mime`, `bucketKey`, `parentId`, `etag`, `createdAt`, `updatedAt`, `deletedAt`, `ancestors`

**Verificación necesaria:** Revisar si `type` se infiere en queries o si es un bug.

**Corrección:** Si `type` es obligatorio según TRUTH.md, el código debe establecerlo. Si no es necesario, corregir documento.

---

### 3. Validación de cuota en restore
**Archivo:** `02_FILOSOFIA_Y_PRINCIPIOS.md`  
**Línea:** 188-195 (Sección 7.2)  
**Problema:** El documento no menciona que restore valida cuota antes de restaurar.

**Código:** `backend/src/routes/files.js:373-382`
- Endpoint `POST /api/files/restore` valida cuota antes de restaurar
- Validación: `userData.usedBytes + fileData.size > userData.planQuotaBytes`
- Solo restaura si hay cuota disponible

**Corrección:** Agregar restore a flujos críticos o mencionar que restore también valida cuota.

---

### 4. Replace no valida cuota antes, solo ajusta delta
**Archivo:** `02_FILOSOFIA_Y_PRINCIPIOS.md`  
**Línea:** 188-195 (Sección 7.2)  
**Problema:** El documento no menciona replace, y replace NO valida cuota antes de reemplazar.

**Código:** `backend/src/routes/files.js:500-545`
- Endpoint `POST /api/files/replace` existe
- NO valida cuota antes de reemplazar
- Solo ajusta delta: `usedBytes: increment(newSize - oldSize)`
- Si `newSize > oldSize` y no hay cuota, falla silenciosamente en el incremento

**Corrección:** Documentar comportamiento de replace o agregar validación de cuota.

---

### 5. Validación legacy `isPublic` - comportamiento exacto
**Archivo:** `02_FILOSOFIA_Y_PRINCIPIOS.md`  
**Línea:** 218  
**Problema:** El documento dice "activo (`isActive !== false` o legacy)" pero no especifica comportamiento cuando `isPublic` es `undefined`.

**Código:** `backend/src/routes/shares.js:105, 143, 250`
- Validación: `if (shareData.isActive === false || shareData.isPublic === false)`
- Si `isPublic` es `undefined`, la condición `isPublic === false` es `false`
- Por lo tanto, si `isActive !== false` y `isPublic` es `undefined`, el share es válido

**Corrección:** Aclarar que `isPublic === undefined` se trata como válido (solo `false` revoca).

---

### 6. Campo `path` y `ancestors` al crear archivo
**Archivo:** `02_FILOSOFIA_Y_PRINCIPIOS.md`  
**Línea:** 28-31  
**Problema:** El documento no menciona que `path` puede no estar presente al crear archivo desde upload.

**Código:** `backend/src/routes/upload.js:208-222`
- Al crear archivo, NO se establece `path`
- Solo se establece `ancestors`
- `path` se calcula en otros lugares (folders)

**Verificación:** Revisar si `path` es obligatorio según TRUTH.md o si se calcula después.

---

## Patch propuesto

```diff
--- a/docs/docs_v2/02_FILOSOFIA_Y_PRINCIPIOS.md
+++ b/docs/docs_v2/02_FILOSOFIA_Y_PRINCIPIOS.md
@@ -134,13 +134,20 @@
 
 ## 5. Soft delete (Firestore)
 
 ### 5.1 Eliminación lógica en `files`
 - `deletedAt` marca eliminación lógica
 - Queries y listados deben filtrar `deletedAt == null`
 
 **Consecuencia:** Nunca asumir que "no existe" si tiene `deletedAt`.
 
-**Nota:** Borrado físico en B2 es política separada (fuera de TRUTH salvo definición explícita).
+**Nota:** Borrado físico existe como endpoint explícito `POST /api/files/permanent-delete`.
+Este endpoint requiere que el archivo ya esté en papelera (`deletedAt !== null`) y elimina físicamente de B2 y Firestore.
 
 **Antipatrón:** Borrar físicamente como comportamiento por defecto sin decisión formal.
 
 **Referencia:** TRUTH.md §4.1
@@ -188,10 +195,18 @@
 **Consecuencia:** No crear `files` definitivos sin confirmación.
 
 **Antipatrón:** Crear `files` antes de que el upload esté confirmado.
 
 **Referencia:** TRUTH.md §4.4, §7.1
 
 ### 7.2 Cuota se valida ANTES de presign
 - Validar con `usedBytes + pendingBytes + size`
 - Actualizar `pendingBytes` al crear sesión
 - Ajustar `usedBytes/pendingBytes` al completar
 
+**Nota:** Restore también valida cuota antes de restaurar: `usedBytes + fileSize <= planQuotaBytes`.
+
+**Nota:** Replace NO valida cuota antes, solo ajusta delta (`newSize - oldSize`). Si `newSize > oldSize` y no hay cuota, el incremento puede fallar.
+
 **Antipatrón:** Validar cuota después del upload.
 
 **Referencia:** TRUTH.md §4.3
@@ -214,6 +227,7 @@
 ### 9.1 Públicos: sin auth, con validación estricta de share
 Validación mínima en cada endpoint público:
 - share existe
 - no expirado (`expiresAt > now` o `null`)
-- activo (`isActive !== false` o legacy)
+- activo (`isActive !== false` y `isPublic !== false` si existe)
+- Si `isPublic` es `undefined`, se trata como válido (solo `false` revoca)
 
 **Antipatrón:**
```

