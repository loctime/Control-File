# Flujo Ejecutable: Proxy de Imágenes CORS-safe

⚠️ **Este documento NO define comportamiento. Deriva estrictamente de TRUTH.md. Ante contradicción, TRUTH.md manda.**

---

**Fuente:** TRUTH.md §7.4

---

## Endpoint: `GET /api/shares/{token}/image`

**Propósito:** Servir imágenes en `<img>` tags sin problemas de CORS.

---

## Validaciones (en orden)

1. Share existe en Firestore
2. Share no expirado: `expiresAt === null || expiresAt > now`
3. Share activo: `isActive !== false && (isPublic !== false || isPublic === undefined)`
4. Archivo existe en `files/{fileId}`
5. Archivo no eliminado (`deletedAt === null`)
6. Archivo tiene `bucketKey`

---

## Headers HTTP

**Request:**
- `GET /api/shares/{token}/image` (normal)
- `HEAD /api/shares/{token}/image` (solo headers)

**Response headers:**
```
Content-Type: {fileData.mime}
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Content-Type
Cache-Control: public, max-age=3600
Content-Length: {fileData.size} (solo en HEAD)
```

---

## Proceso de streaming

1. Obtener stream desde B2 usando `bucketKey`
2. Establecer headers CORS antes de enviar datos
3. Incrementar `downloadCount` (async, no bloquea)
4. Pipe stream directamente al cliente: `fileStream.pipe(res)`

**Diferencia clave:** No genera presigned URL. Stream directo desde B2.

---

## Manejo de errores

**Stream error:**
- Si headers no enviados: retornar `500`
- Si headers ya enviados: cerrar conexión

**Update error (downloadCount):**
- Log warning
- Continuar streaming (no crítico)

---

## Uso en HTML

```html
<!-- Funciona en cualquier dominio -->
<img src="https://backend.controlfile.app/api/shares/{token}/image" alt="Imagen compartida" />
```

**Ventaja:** Headers CORS permiten embedding cross-domain.

---

## OPTIONS handler

**Endpoint:** `OPTIONS /api/shares/{token}/image`

**Respuesta:** `204 No Content` con headers CORS

**Propósito:** Preflight requests de navegadores.

---

## Referencias

- TRUTH.md §6.2, §7.4
- 02_FILOSOFIA_Y_PRINCIPIOS.md §3.3
- 03_CONTRATOS_TECNICOS/endpoints_shares.md

