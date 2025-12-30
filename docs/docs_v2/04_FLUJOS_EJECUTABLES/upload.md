# Flujo Ejecutable: Upload de Archivo

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

**Fuente:** TRUTH.md §8.1

---

## Secuencia de pasos

### 1. Crear sesión de upload

**Endpoint:** `POST /api/uploads/presign`

**Validaciones:**
- Usuario autenticado
- Cuota disponible: `usedBytes + pendingBytes + size <= planQuotaBytes`

**Acciones:**
- Crear documento en `uploadSessions/{sessionId}`
- Actualizar `users/{uid}.pendingBytes += size`
- Generar presigned URL de B2 (expiración: 1 hora)

**Respuesta:**
```typescript
{
  uploadSessionId: string;
  url?: string; // Para upload simple
  multipart?: {
    uploadId: string;
    parts: Array<{
      partNumber: number;
      url: string;
    }>;
  };
}
```

---

### 2. Upload directo a B2

**Cliente → B2** (no pasa por backend)

- Upload simple: `PUT {presignedUrl}` con body del archivo
- Upload multipart: `PUT {partUrl}` para cada parte

**Nota:** Backend no recibe el archivo. Solo genera la URL.

---

### 3. Confirmar upload

**Endpoint:** `POST /api/uploads/confirm`

**Body:**
```typescript
{
  uploadSessionId: string;
  etag?: string; // Para upload simple
  parts?: Array<{ // Para multipart
    PartNumber: number;
    ETag: string;
  }>;
}
```

**Validaciones:**
- Sesión existe y pertenece al usuario
- Sesión en estado `pending` o `uploaded`
- Archivo existe en B2 (verificado con metadata)

**Acciones:**
- Completar multipart upload si aplica
- Crear documento en `files/{fileId}`
- Actualizar `users/{uid}.usedBytes += size`
- Actualizar `users/{uid}.pendingBytes -= size`
- Actualizar sesión: `status = 'completed'`

**Respuesta:**
```typescript
{
  success: true;
  fileId: string;
  message: string;
}
```

---

## Validación de cuota

**Momento:** ANTES de generar presigned URL (paso 1)

**Fórmula:** `usedBytes + pendingBytes + size <= planQuotaBytes`

**Razón:** Evitar uploads que luego no se puedan confirmar.

---

## Multipart upload

**Umbral:** Archivos > 128MB

**Proceso:**
1. Crear multipart upload en B2
2. Generar presigned URL para cada parte
3. Cliente sube cada parte directamente
4. Confirmar con lista de partes y ETags

---

## Referencias

- TRUTH.md §4.4, §8.1
- 02_FILOSOFIA_Y_PRINCIPIOS.md §7.1, §7.2
- 03_CONTRATOS_TECNICOS/modelo_uploadSessions.md

