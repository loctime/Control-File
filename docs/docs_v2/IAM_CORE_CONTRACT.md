# ControlFile – Contrato IAM/Core

⚠️ Este documento define el rol de ControlFile como **infraestructura de identidad y autenticación** (IAM/Core) para el ecosistema Control*.

---

## 1. Propósito

ControlFile actúa como **capa central de identidad y autenticación** (IAM/Core) para todo el ecosistema Control*.

Su responsabilidad es:
- ✅ Gestionar identidades en Firebase Auth
- ✅ Aplicar custom claims (roles, appId, ownerId)
- ✅ Proporcionar endpoints de identidad para backends de apps

**NO es responsabilidad de ControlFile:**
- ❌ Lógica de negocio de aplicaciones
- ❌ Escritura en Firestore de apps (ControlAudit, ControlDoc, etc.)
- ❌ Validación de límites de negocio
- ❌ Flujos de aplicación específicos

---

## 2. Principio fundamental

> **ControlFile expone solo endpoints de identidad, no de negocio.**

Los endpoints de identidad son:
- **Atomicos**: Solo crean/modifican identidad (Auth + Claims)
- **Sin efectos secundarios**: No escriben Firestore de apps
- **Sin lógica de negocio**: No validan límites, reglas de negocio, etc.

---

## 3. Arquitectura de llamadas

### ❌ INCORRECTO: Frontend llama directamente a ControlFile

```
Frontend → /api/admin/create-user (ControlFile)
```

**Problema**: El frontend está orquestando flujos de negocio directamente con ControlFile.

### ✅ CORRECTO: App backend orquesta, ControlFile solo identidad

```
Frontend → ControlAudit Backend → /api/admin/create-user (ControlFile)
                ↓
         ControlAudit escribe Firestore
         ControlAudit aplica lógica de negocio
         ControlAudit valida límites
```

**Beneficio**: Separación clara de responsabilidades.

---

## 4. Endpoints de identidad

### 4.1 POST `/api/admin/create-user`

**Responsabilidad**: Auth + Claims únicamente

**Contrato fijo**:

**Inputs requeridos**:
- `email` (string): Email del usuario
- `password` (string): Contraseña temporal
- `nombre` (string): Nombre a mostrar (se mapea internamente a `displayName` de Firebase Auth)
- `appId` (string): Identificador de la app (ej: "auditoria")
- `role` (string): Rol del usuario en la app

**Nota sobre naming**:
- El parámetro del contrato es `nombre` (decisión de dominio, más amigable en español)
- Internamente se mapea a `displayName` de Firebase Auth
- **Decisión futura**: Si se abre el endpoint a más apps, considerar estandarizar a `displayName` para alinearse con Firebase Auth

**Output**:
- `uid` (string): UID del usuario creado en Firebase Auth
- `status` (string): "created"
- `source` (string): "controlfile"

**Lo que hace**:
1. ✅ Crea usuario en Firebase Auth
2. ✅ Aplica custom claims: `{ appId, role, ownerId }`
3. ✅ Retorna `uid` y estado

**Lo que NO hace**:
- ❌ NO escribe Firestore de ninguna app
- ❌ NO valida límites de negocio
- ❌ NO aplica reglas de aplicación
- ❌ NO crea documentos de usuario en Firestore

**Autorización requerida**:
- Token Firebase válido en header `Authorization: Bearer <token>`
- Custom claims del token:
  - `appId === 'auditoria'` (o la app correspondiente)
  - `role in ['admin', 'supermax']`

**Quién debe llamarlo**:
- ✅ Backends de apps (ControlAudit, ControlDoc, etc.)
- ❌ Frontends directamente

---

## 5. Flujo completo de creación de usuario

### Ejemplo: Crear operario en ControlAudit

**Paso 1: Frontend llama a ControlAudit**
```typescript
// Frontend (ControlAudit)
POST /api/operarios/create
Body: { email, password, nombre, role }
```

**Paso 2: ControlAudit Backend orquesta**
```typescript
// ControlAudit Backend
async function createOperario(data) {
  // 1. Llamar a ControlFile para crear identidad
  const identityResponse = await fetch('https://controlfile-backend/api/admin/create-user', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: data.email,
      password: data.password,
      nombre: data.nombre,  // Se mapea internamente a displayName de Firebase Auth
      appId: 'auditoria',
      role: data.role
    })
  });
  
  const { uid } = await identityResponse.json();
  
  // 2. ControlAudit escribe Firestore con lógica de negocio
  await firestore.collection('apps/auditoria/operarios').doc(uid).set({
    nombre: data.nombre,
    email: data.email,
    role: data.role,
    ownerId: adminUser.uid,
    createdAt: FieldValue.serverTimestamp(),
    // ... otros campos de negocio
  });
  
  // 3. ControlAudit aplica validaciones de negocio
  await validateLimits(adminUser.uid);
  
  return { uid, success: true };
}
```

**Separación de responsabilidades**:
- ✅ ControlFile: Solo identidad (Auth + Claims)
- ✅ ControlAudit: Lógica de negocio (Firestore + Validaciones)

---

## 6. Reglas de uso

### 6.1 Frontends

**NO deben**:
- ❌ Llamar directamente a `/api/admin/create-user` de ControlFile
- ❌ Orquestar flujos de creación de usuarios
- ❌ Gestionar identidades directamente

**Deben**:
- ✅ Llamar solo a endpoints de su propia app (ControlAudit, ControlDoc, etc.)
- ✅ Dejar que el backend de la app orqueste la creación

### 6.2 Backends de apps

**Deben**:
- ✅ Llamar a ControlFile solo para operaciones de identidad
- ✅ Orquestar flujos completos (identidad + negocio)
- ✅ Escribir Firestore de su propia app
- ✅ Aplicar validaciones de negocio

**NO deben**:
- ❌ Asumir que ControlFile escribe Firestore de su app
- ❌ Depender de efectos secundarios de ControlFile

---

## 7. Documentación de endpoints

Todos los endpoints de identidad deben documentarse explícitamente con:

1. **Responsabilidad**: Qué hace (solo identidad)
2. **Contrato fijo**: Inputs y outputs exactos
3. **Lo que NO hace**: Lista explícita de exclusiones
4. **Quién debe llamarlo**: Backends de apps, no frontends

---

## 8. Beneficios de esta arquitectura

- ✅ **Separación clara**: Identidad vs. Negocio
- ✅ **Reutilizable**: ControlFile sirve a múltiples apps
- ✅ **Mantenible**: Cambios de negocio no afectan identidad
- ✅ **Testeable**: Identidad y negocio se prueban por separado
- ✅ **Escalable**: Apps pueden evolucionar independientemente

---

## 9. Decisiones de diseño

### 9.1 Naming: `nombre` vs `displayName`

**Estado actual**:
- El contrato del endpoint usa `nombre` como parámetro (decisión de dominio, más amigable en español)
- Internamente se mapea a `displayName` de Firebase Auth
- El código acepta `nombre` en el body y lo convierte a `displayName` al crear el usuario

**Razón**:
- `nombre` es más natural en el contexto del dominio (español)
- Mantiene consistencia con otros endpoints que usan español

**Consideración futura**:
Si se abre el endpoint a más apps o se estandariza la API:
- **Opción A**: Mantener `nombre` como decisión de dominio (actual)
- **Opción B**: Estandarizar a `displayName` para alinearse con Firebase Auth

**Nota**: Esta es una decisión de diseño, no un bug. El mapeo funciona correctamente.

---

## 10. Referencias

- **TRUTH.md**: Documento fuente de verdad del sistema
- **CONTRACT.md**: Contrato técnico de integración de apps
- **API_REFERENCE.md**: Referencia completa de endpoints
