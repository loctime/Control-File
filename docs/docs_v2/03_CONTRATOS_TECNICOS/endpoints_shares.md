# Contrato Técnico: Endpoints de Shares

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

**Fuente:** TRUTH.md §7

---

## Base path

Todos los endpoints están en `/api/shares`.

---

## Endpoints protegidos (requieren autenticación)

### POST /api/shares/create

Crear nuevo share.

**Body:**
```typescript
{
  fileId: string;
  expiresIn?: number; // horas, default: 24
}
```

**Respuesta:**
```typescript
{
  shareToken: string;
  shareUrl: string;
  expiresAt: Timestamp;
  fileName: string;
}
```

**Validaciones:**
- Usuario autenticado
- Archivo existe y pertenece al usuario
- Archivo no eliminado (`deletedAt === null`)

---

### POST /api/shares/revoke

Revocar share existente.

**Body:**
```typescript
{
  shareToken: string;
}
```

**Actualiza:**
- `isActive = false`
- `revokedAt = now`

**Validaciones:**
- Usuario autenticado
- Share pertenece al usuario (`uid === req.user.uid`)

---

### GET /api/shares/

Listar shares del usuario autenticado.

**Respuesta:**
```typescript
{
  shares: Array<{
    token: string;
    fileName: string;
    fileSize: number;
    expiresAt: Timestamp | null;
    createdAt: Timestamp;
    downloadCount: number;
    shareUrl: string;
  }>;
}
```

**Filtros:**
- Solo shares activos (`isActive === true`)

---

## Endpoints públicos (sin autenticación)

### GET /api/shares/{token}

Obtener información de share.

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

**Validaciones:**
- Share existe
- No expirado (`expiresAt === null || expiresAt > now`)
- Activo (`isActive !== false && (isPublic !== false || isPublic === undefined)`)

---

### POST /api/shares/{token}/download

Descargar archivo compartido.

**Respuesta:**
```typescript
{
  downloadUrl: string; // presigned URL de B2, expira en 5 min
  fileName: string;
  fileSize: number;
}
```

**Validaciones:**
- Share válido (existe, no expirado, activo)
- Archivo existe y no eliminado
- Archivo tiene `bucketKey`
- Escaneo de virus (si habilitado y archivo sospechoso)

**Efectos:**
- Incrementa `downloadCount`

---

### GET /api/shares/{token}/image

Proxy de imagen CORS-safe.

**Respuesta:** Stream directo desde B2 (no presigned URL)

**Headers:**
- `Content-Type`: MIME del archivo
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`
- `Cache-Control: public, max-age=3600`

**Soporta:** GET y HEAD requests

**Validaciones:**
- Share válido (existe, no expirado, activo)
- Archivo existe y no eliminado
- Archivo tiene `bucketKey`

**Efectos:**
- Incrementa `downloadCount` (async, no bloquea)

---

### POST /api/shares/{token}/increment-counter

Incrementar contador (usado por Cloudflare Worker).

**Respuesta:**
```typescript
{
  success: boolean;
}
```

**Actualiza:**
- `downloadCount += 1`
- `lastDownloadAt = now`

**Nota:** No valida share (Worker ya lo hizo).

---

## Referencias

- TRUTH.md §7, §8
- 02_FILOSOFIA_Y_PRINCIPIOS.md §9.1
- 04_FLUJOS_EJECUTABLES/share_publico.md
- 04_FLUJOS_EJECUTABLES/proxy_imagenes.md

