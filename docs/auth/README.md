# 🔐 Documentación de Autenticación y OAuth

Esta carpeta contiene documentación específica sobre autenticación, OAuth y configuración de acceso para aplicaciones como ControlAudit.

## 📖 Documentos Disponibles

| Documento | Descripción | Audiencia |
|-----------|-------------|-----------|
| **[ControlAuditAuth.md](./ControlAuditAuth.md)** | Configuración de autenticación para ControlAudit | Desarrolladores |
| **[ControlAuditOAuth.md](./ControlAuditOAuth.md)** | Flujo OAuth para ControlAudit | Desarrolladores |

## 🎯 Sistema de Autenticación

### Arquitectura de Auth Central

```
┌─────────────────────┐
│  Firebase Auth      │
│  (Auth Central)     │  ← UN SOLO PROYECTO
│  controlstorage-... │
└──────────┬──────────┘
           │
     ┌─────┴─────┬─────────┬──────────┐
     │           │         │          │
     ↓           ↓         ↓          ↓
ControlFile  ControlAudit ControlDoc  ...
```

**Ventajas:**
- ✅ Single Sign-On (SSO) entre apps
- ✅ Un solo login para todo
- ✅ Gestión centralizada de usuarios
- ✅ Menor costo (un solo proyecto Firebase)

### Custom Claims

Cada usuario tiene claims que definen a qué apps puede acceder:

```json
{
  "allowedApps": ["controlfile", "controlaudit", "controldoc"],
  "plans": {
    "controlfile": "pro",
    "controlaudit": "basic",
    "controldoc": "trial"
  }
}
```

### Configuración de Claims

Usar el script `scripts/set-claims.js`:

```bash
npm run set-claims -- \
  --email usuario@ejemplo.com \
  --apps controlfile,controlaudit,controldoc \
  --plans controlfile=pro;controlaudit=basic
```

## 🔑 Flujo de Autenticación

### 1. Login con Firebase Auth

```typescript
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const auth = getAuth();
const provider = new GoogleAuthProvider();

const result = await signInWithPopup(auth, provider);
const user = result.user;
```

### 2. Obtener ID Token

```typescript
const idToken = await user.getIdToken();
```

### 3. Llamar API Backend

```typescript
const response = await fetch('https://backend.controldoc.app/api/files/list', {
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});
```

### 4. Backend Verifica Token y Claims

```javascript
// Backend valida el token
const decodedToken = await adminAuth.verifyIdToken(idToken);

// Verifica claims
if (!decodedToken.allowedApps?.includes('controlfile')) {
  throw new Error('No autorizado');
}
```

## 🔒 Providers Configurados

| Provider | Configurado | Notas |
|----------|-------------|-------|
| Google | ✅ Sí | OAuth 2.0 |
| Email/Password | ✅ Sí | Login tradicional |
| Microsoft | ⚠️ Opcional | Requiere Azure AD |
| Apple | ⚠️ Opcional | Para iOS |

## 🌐 Dominios Autorizados

Dominios que pueden hacer login con Firebase Auth:

- ✅ files.controldoc.app
- ✅ auditoria.controldoc.app
- ✅ localhost (desarrollo)

**Agregar nuevo dominio:**
1. Firebase Console → Authentication → Settings
2. Authorized domains → Add domain
3. Esperar propagación DNS

## 🛠️ Scripts de Administración

### Ver claims de usuario
```bash
node scripts/check-firebase-config.js --email usuario@ejemplo.com
```

### Asignar permisos
```bash
npm run set-claims -- --email usuario@ejemplo.com --apps controlfile,controlaudit
```

### Inicializar usuario
```bash
npm run init-user -- --email usuario@ejemplo.com
```

## 🔐 Seguridad

### Token Refresh
- Tokens expiran cada **1 hora**
- Firebase SDK renueva automáticamente
- Forzar refresh: `getIdToken(true)`

### Logout
```typescript
import { getAuth, signOut } from 'firebase/auth';

await signOut(getAuth());
```

### Protección de Rutas (Next.js)

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }
  
  return NextResponse.next();
}
```

## 🔗 Integración con Apps Externas

### Para ControlAudit
Ver **ControlAuditAuth.md** y **ControlAuditOAuth.md**

### Para otras apps
Ver [Guía de Integración](../integracion/README_INTEGRACION_RAPIDA.md)

## ⚠️ Troubleshooting

### Error 401: Unauthorized
- ❌ Token expirado → Refresh token
- ❌ Token inválido → Re-login
- ❌ Header faltante → Agregar `Authorization: Bearer {token}`

### Error 403: Forbidden
- ❌ Usuario sin claims → Asignar con `set-claims.js`
- ❌ App no en allowedApps → Actualizar claims
- ❌ Plan insuficiente → Upgrade plan

### Login Loop
- ❌ Cookie no se guarda → Verificar dominio
- ❌ CORS bloqueado → Agregar dominio a ALLOWED_ORIGINS
- ❌ Redirect URI → Verificar Firebase Console

## 📚 Recursos

- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Custom Claims Guide](https://firebase.google.com/docs/auth/admin/custom-claims)
- [OAuth 2.0 Spec](https://oauth.net/2/)

## 🔗 Enlaces Relacionados

- [Guía de Integración](../integracion/) - Integrar apps externas
- [Backend Guide](../integracion/GUIA_BACKEND.md) - Configuración backend
- [API Reference](../../API_REFERENCE.md) - Endpoints de API

---

**Volver a:** [📚 Documentación Principal](../README.md) | [🏠 Proyecto](../../README.md)

