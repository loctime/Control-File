# Flujo Ejecutable: Acceso a Share Público

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

**Fuente:** TRUTH.md §7.2, §7.3

---

## Flujo: Obtener información de share

### Endpoint: `GET /api/shares/{token}`

**Validaciones (en orden):**
1. Share existe en Firestore
2. No expirado: `expiresAt === null || expiresAt > now`
3. Activo: `isActive !== false && (isPublic !== false || isPublic === undefined)`

**Respuesta:**
```typescript
{
  fileName: string;
  fileSize: number;
  mime: string;
  expiresAt: Timestamp | null;
  downloadCount: number;
}
```

**Códigos de error:**
- `404`: Share no encontrado
- `410`: Share expirado o revocado

---

## Flujo: Descargar archivo compartido

### Endpoint: `POST /api/shares/{token}/download`

**Validaciones (en orden):**
1. Share válido (existe, no expirado, activo)
2. Archivo existe en `files/{fileId}`
3. Archivo no eliminado (`deletedAt === null`)
4. Archivo tiene `bucketKey`
5. Escaneo de virus (si habilitado y archivo sospechoso)

**Acciones:**
- Generar presigned URL de B2 (expiración: 5 minutos)
- Incrementar `downloadCount`
- Si virus detectado: revocar share automáticamente

**Respuesta:**
```typescript
{
  downloadUrl: string; // presigned URL de B2
  fileName: string;
  fileSize: number;
}
```

**Siguiente paso:** Cliente hace `GET {downloadUrl}` directamente a B2.

---

## Validación de share activo

Función helper (pseudocódigo):

```javascript
function isShareValid(shareData) {
  // 1. Existe
  if (!shareData) return false;
  
  // 2. No expirado
  if (shareData.expiresAt && shareData.expiresAt < now) return false;
  
  // 3. Activo
  if (shareData.isActive === false) return false;
  if (shareData.isPublic === false) return false; // legacy
  
  return true;
}
```

---

## Escaneo de virus

**Condiciones:**
- Cloudmersive habilitado
- Share no escaneado (`virusScanned !== true`)
- Archivo sospechoso (según heurísticas)

**Acciones si virus detectado:**
- Revocar share: `isActive = false`
- Guardar motivo: `revokedReason = "Virus detectado: {virusName}"`
- Retornar error `400` con código `VIRUS_DETECTED`

---

## Referencias

- TRUTH.md §6.2, §7.2, §7.3
- 02_FILOSOFIA_Y_PRINCIPIOS.md §9.1, §9.2
- 03_CONTRATOS_TECNICOS/modelo_shares.md
- 03_CONTRATOS_TECNICOS/endpoints_shares.md

