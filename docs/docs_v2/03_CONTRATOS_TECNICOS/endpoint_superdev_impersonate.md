# Contrato Técnico: Endpoint de Impersonación Superdev

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de la implementación en `app/api/superdev/impersonate/route.ts`.
Ante contradicción, el código fuente manda.

---

## Base path

`/api/superdev/impersonate`

---

## Endpoint protegido (requiere superdev)

### POST /api/superdev/impersonate

Generar un Firebase Custom Token para impersonar a un owner válido.

**⚠️ CRÍTICO**: Este endpoint es EXCLUSIVO para usuarios con custom claim `superdev: true`.

---

## Autenticación

**Header requerido:**
```
Authorization: Bearer <SUPERDEV_ID_TOKEN>
```

**Validación:**
1. Token debe estar presente en header `Authorization`
2. Token debe ser válido (no expirado, no revocado)
3. Token debe tener custom claim `superdev === true`

**Códigos de error de autenticación:**
- `401` - `UNAUTHORIZED`: Token ausente o inválido
- `401` - `TOKEN_EXPIRED`: Token expirado
- `401` - `TOKEN_REVOKED`: Token revocado
- `403` - `FORBIDDEN`: Token válido pero sin permisos de superdev

---

## Request Body

```typescript
{
  ownerId: string; // UID del owner a impersonar (requerido)
}
```

**Validaciones:**
- `ownerId` debe ser un string no vacío
- `ownerId` se trimea antes de usar

**Códigos de error de validación:**
- `400` - `INVALID_OWNER_ID`: ownerId faltante o inválido

---

## Validación del Owner

El endpoint valida que el `ownerId` corresponda a un owner válido:

### 1. Existencia en Firestore

**Colección:** `apps/auditoria/owners/{ownerId}`

```typescript
const ownerDoc = await adminDb
  .collection('apps')
  .doc('auditoria')
  .collection('owners')
  .doc(targetOwnerId)
  .get();
```

**Código de error:**
- `404` - `OWNER_NOT_FOUND`: Owner no encontrado en Firestore

### 2. Validación de estructura

El documento del owner debe cumplir:

```typescript
{
  role: 'admin',
  ownerId: targetOwnerId, // Debe coincidir con el UID
  appId: 'auditoria'
}
```

**Código de error:**
- `403` - `INVALID_OWNER`: El UID no corresponde a un owner válido

### 3. Existencia en Firebase Auth

```typescript
const authUser = await adminAuth.getUser(targetOwnerId);
```

**Código de error:**
- `404` - `OWNER_AUTH_NOT_FOUND`: Owner no tiene cuenta de autenticación

---

## Response

### Respuesta exitosa (200)

```typescript
{
  customToken: string; // Firebase Custom Token para el owner
}
```

**El custom token incluye los siguientes claims:**
```typescript
{
  appId: 'auditoria',
  role: 'admin',
  ownerId: targetOwnerId
}
```

---

## Uso del Custom Token

```typescript
import { signInWithCustomToken } from 'firebase/auth';

// 1. Obtener custom token
const response = await fetch('/api/superdev/impersonate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${superdevToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ ownerId: 'target-owner-uid' }),
});

const { customToken } = await response.json();

// 2. Autenticarse con el custom token
await signInWithCustomToken(auth, customToken);

// 3. El usuario ahora está autenticado como el owner
// Al hacer logout, se revierte a la sesión original
```

---

## Logging de Auditoría

Todas las operaciones se registran con el logger estructurado:

### Impersonación exitosa

```typescript
logger.info('Superdev impersonation successful', {
  superdevUid: string,
  superdevEmail: string,
  targetOwnerId: string,
  targetOwnerEmail: string,
  timestamp: string, // ISO 8601
});
```

### Intentos fallidos

Se registran con nivel `warn` o `error` según el caso:
- Intentos con ownerId inválido
- Intentos con owner inexistente
- Intentos sin permisos
- Errores internos

---

## Restricciones de Seguridad

### ✅ Permitido

- Generar custom token temporal
- Leer Firestore para validar owner
- Leer Firebase Auth para validar owner
- Logging de auditoría

### ❌ Prohibido

- Modificar Firestore
- Modificar Firebase Auth
- Persistir estado de impersonación
- Usar contraseñas
- Modificar custom claims del owner

---

## Flujo Completo

```
1. Superdev solicita impersonación
   POST /api/superdev/impersonate
   Headers: Authorization: Bearer <superdev_token>
   Body: { ownerId: "target-uid" }

2. Servidor valida:
   ✓ Token válido y no expirado
   ✓ Custom claim superdev === true
   ✓ ownerId presente y válido
   ✓ Owner existe en apps/auditoria/owners/{ownerId}
   ✓ Owner tiene role: 'admin', appId: 'auditoria', ownerId coincidente
   ✓ Owner existe en Firebase Auth

3. Servidor genera custom token:
   adminAuth.createCustomToken(targetOwnerId, {
     appId: 'auditoria',
     role: 'admin',
     ownerId: targetOwnerId,
   })

4. Servidor registra auditoría:
   logger.info('Superdev impersonation successful', {...})

5. Servidor retorna custom token:
   { customToken: "..." }

6. Cliente usa custom token:
   signInWithCustomToken(auth, customToken)

7. Usuario ahora está autenticado como el owner
   Al hacer logout, se revierte a la sesión original
```

---

## Códigos de Error Completos

| Código HTTP | Código Error | Descripción |
|------------|-------------|-------------|
| 200 | - | Impersonación exitosa |
| 400 | `INVALID_OWNER_ID` | ownerId faltante o inválido |
| 401 | `UNAUTHORIZED` | Token ausente o inválido |
| 401 | `TOKEN_EXPIRED` | Token expirado |
| 401 | `TOKEN_REVOKED` | Token revocado |
| 403 | `FORBIDDEN` | Sin permisos de superdev |
| 403 | `INVALID_OWNER` | El UID no corresponde a un owner válido |
| 404 | `OWNER_NOT_FOUND` | Owner no encontrado en Firestore |
| 404 | `OWNER_AUTH_NOT_FOUND` | Owner no tiene cuenta de autenticación |
| 500 | `INTERNAL_ERROR` | Error interno del servidor |

---

## Ejemplo de Implementación

Ver código fuente completo en:
`app/api/superdev/impersonate/route.ts`

---

## Notas de Seguridad

1. **No persiste estado**: La impersonación es temporal y se revierte al hacer logout
2. **Validación estricta**: Solo owners válidos pueden ser impersonados
3. **Logging completo**: Todas las impersonaciones se registran para auditoría
4. **Claims reforzados**: El custom token incluye los claims necesarios explícitamente
5. **Sin modificación**: No se modifica Firestore ni Firebase Auth

---

## Referencias

- Implementación: `app/api/superdev/impersonate/route.ts`
- Firebase Admin: `lib/firebase-admin.ts`
- Logger: `lib/logger.ts`
- API Reference: `API_REFERENCE.md`
