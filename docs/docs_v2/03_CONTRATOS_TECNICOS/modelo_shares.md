# Contrato Técnico: Colección `shares`

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

**Fuente:** TRUTH.md §4.2

---

## Documento indexado por `token`

El `token` es el ID del documento en Firestore.

---

## Campos obligatorios

- `token`: string (ID del documento, token aleatorio)
- `fileId`: string (ID del archivo compartido)
- `uid`: string (owner que creó el share)
- `fileName`: string (nombre del archivo al momento de crear share)
- `fileSize`: number (tamaño del archivo)
- `mime`: string (MIME type del archivo)
- `isActive`: boolean (true = activo, false = revocado)
- `expiresAt`: Timestamp | null (null = nunca expira)
- `createdAt`: Timestamp
- `downloadCount`: number (contador de descargas)

---

## Campos opcionales

- `virusScanned`: boolean (si fue escaneado por virus)
- `revokedReason`: string (motivo de revocación)
- `revokedAt`: Timestamp (fecha de revocación)
- `lastDownloadAt`: Timestamp (última descarga)

---

## Campos legacy (retrocompatibilidad)

- `isPublic`: boolean (legacy, retrocompatible con `isActive`)

**Regla de lectura:** Validar `isActive !== false && (isPublic !== false || isPublic === undefined)`

**Regla de escritura:** No crear nuevos shares con `isPublic`. Solo usar `isActive`.

---

## Validación de share activo

Un share es válido si:
1. Existe el documento
2. No expirado: `expiresAt === null || expiresAt > now`
3. Activo: `isActive !== false && (isPublic !== false || isPublic === undefined)`
4. Archivo existe y no está eliminado: `files/{fileId}.deletedAt === null`
5. Archivo tiene `bucketKey`

---

## Referencias

- TRUTH.md §4.2, §6.2, §7.2
- 02_FILOSOFIA_Y_PRINCIPIOS.md §4.3, §9.1
- 06_LEGACY_Y_EXCEPCIONES/isPublic.md

