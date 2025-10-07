# ✅ Checklist de Configuración para Administrador

> **Para el administrador del backend ControlFile**: Pasos necesarios para permitir que una app externa se integre.

## 📋 Información a Solicitar a la App Externa

Antes de empezar, solicita al equipo de la app externa:

- [ ] **Nombre de la aplicación** (ej: "miapp", "controlaudit", etc.)
- [ ] **Dominios** que usarán (producción y desarrollo)
  - Ejemplo: `https://miapp.com`, `https://www.miapp.com`, `http://localhost:3000`
- [ ] **Emails de usuarios** que necesitan acceso inicial (para pruebas)
- [ ] **Plan/tier** que tendrán los usuarios (basic, pro, premium, etc.)

## 🔧 Pasos de Configuración

### 1. Variables de Entorno del Backend

Verifica que el backend tenga estas variables configuradas en Render/servidor:

```bash
# ✅ Firebase Auth Central (proyecto de identidad compartido)
FB_ADMIN_IDENTITY={"type":"service_account",...}

# ✅ Firebase Firestore (proyecto de datos)
FB_ADMIN_APPDATA={"type":"service_account",...}
FB_DATA_PROJECT_ID=controlfile-data

# ✅ App Code (fijo, no cambiar)
APP_CODE=controlfile

# ✅ CORS: AGREGAR los dominios de la app externa aquí
ALLOWED_ORIGINS=https://files.controldoc.app,https://miapp.com,https://www.miapp.com,http://localhost:3000,http://localhost:5173

# ✅ Backblaze B2
B2_KEY_ID=...
B2_APPLICATION_KEY=...
B2_BUCKET_ID=...
B2_BUCKET_NAME=...
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com

# ✅ Configuración general
PORT=3001
NODE_ENV=production
```

**⚠️ IMPORTANTE sobre ALLOWED_ORIGINS:**
- Separar dominios con comas (sin espacios)
- Incluir protocolo (`https://` o `http://`)
- NO incluir barra final (`/`)
- Incluir todos los subdominios necesarios

Ejemplo correcto:
```
ALLOWED_ORIGINS=https://app.com,https://www.app.com,http://localhost:3000
```

### 2. Configurar Acceso para Usuarios

**Opción A: Usuario nuevo (no existe en el Auth central)**

Los usuarios se crearán automáticamente en el primer login desde la app externa.

Después del primer login, asignar claims:

```bash
cd /path/to/controlfile-backend
node scripts/set-claims.js \
  --email usuario@ejemplo.com \
  --apps controlfile,miapp \
  --plans controlfile=basic;miapp=premium
```

**Opción B: Usuario existente (ya está en Auth central)**

Solo actualizar claims:

```bash
node scripts/set-claims.js \
  --email usuario@ejemplo.com \
  --apps controlfile,miapp \
  --plans controlfile=pro;miapp=premium
```

**Opción C: Dar acceso masivo**

Crear script para múltiples usuarios:

```bash
#!/bin/bash
# batch-set-claims.sh

while IFS=',' read -r email plan
do
  node scripts/set-claims.js \
    --email "$email" \
    --apps miapp \
    --plans miapp="$plan"
done < users.csv
```

Formato de `users.csv`:
```
usuario1@ejemplo.com,basic
usuario2@ejemplo.com,premium
usuario3@ejemplo.com,pro
```

### 3. Verificar Configuración de Claims

Comprobar que un usuario tiene los claims correctos:

```bash
# Verificar claims de un usuario
node scripts/check-user-claims.js --email usuario@ejemplo.com
```

Salida esperada:
```json
{
  "uid": "abc123",
  "email": "usuario@ejemplo.com",
  "customClaims": {
    "allowedApps": ["controlfile", "miapp"],
    "plans": {
      "controlfile": "pro",
      "miapp": "premium"
    }
  }
}
```

### 4. Configurar Reglas de Firestore (si es necesario)

Si usas el mismo Firestore para datos de múltiples apps, las reglas actuales ya deberían funcionar:

```javascript
// firestore.rules - Las reglas actuales ya manejan múltiples apps
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Archivos: solo el propietario puede acceder
    match /files/{fileId} {
      allow read, write: if request.auth != null 
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
    
    // Usuarios: solo su propia info
    match /users/{userId} {
      allow read, write: if request.auth != null 
        && request.auth.uid == userId;
    }
    
    // ... resto de reglas
  }
}
```

**No es necesario modificar** las reglas para agregar una nueva app. El control de acceso se hace mediante claims en el backend.

### 5. Probar la Integración

**a) Crear usuario de prueba:**

```bash
# En Firebase Console del proyecto Auth central:
# 1. Ir a Authentication > Users
# 2. Add user
# 3. Email: test@miapp.com, Password: Test123!

# Luego asignar claims:
node scripts/set-claims.js \
  --email test@miapp.com \
  --apps miapp \
  --plans miapp=basic
```

**b) Probar endpoint de salud:**

```bash
curl https://tu-backend.onrender.com/api/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-10-07T12:00:00.000Z",
  "environment": "production"
}
```

**c) Probar autenticación desde la app externa:**

Pedir al equipo de la app externa que prueben login y luego:

```bash
# Obtener el ID token de Firebase en la consola del browser
# const token = await auth.currentUser.getIdToken();
# console.log(token);

# Probar listado de archivos
curl -H "Authorization: Bearer <TOKEN>" \
  https://tu-backend.onrender.com/api/files/list?parentId=null&pageSize=10
```

Respuesta esperada (aunque esté vacío):
```json
{
  "items": [],
  "nextPage": null
}
```

**❌ Si hay error 403:**
```json
{
  "error": "Acceso no permitido para esta app",
  "code": "APP_FORBIDDEN"
}
```
→ Verificar que el usuario tenga el claim `allowedApps` correcto

**❌ Si hay error 401:**
```json
{
  "error": "Token de autorización requerido",
  "code": "AUTH_TOKEN_MISSING"
}
```
→ Verificar que el header `Authorization: Bearer <token>` esté presente

**❌ Si hay error CORS:**
```
Access to fetch at 'https://...' from origin 'https://miapp.com' has been blocked by CORS policy
```
→ Agregar el dominio a `ALLOWED_ORIGINS` y reiniciar el backend

### 6. Documentación a Entregar

Proporciona al equipo de la app externa:

- [ ] **Credenciales del Firebase Auth Central:**
  ```
  Project ID: controlstorage-eb796
  API Key: AIza...
  Auth Domain: controlstorage-eb796.firebaseapp.com
  App ID: 1:123456789:web:abc...
  ```

- [ ] **URL del Backend:**
  ```
  https://tu-backend.onrender.com
  ```

- [ ] **Nombre de la app** para identificación:
  ```
  App code: miapp
  ```

- [ ] **Documentación:**
  - `README_INTEGRACION_RAPIDA.md` (para developers)
  - `GUIA_INTEGRACION_APPS_EXTERNAS.md` (documentación completa)
  - `API_REFERENCE.md` (referencia de endpoints)

### 7. Monitoreo Post-Integración

Después de la integración, monitorear:

- [ ] **Logs del backend** para errores de autenticación
  ```bash
  # En Render/servidor
  pm2 logs controlfile --lines 100
  # o
  heroku logs --tail --app tu-app
  ```

- [ ] **Uso de cuotas** por usuarios
  ```bash
  node scripts/reconcile.js --check
  ```

- [ ] **Métricas de uso:**
  - Número de uploads por día
  - Tamaño total almacenado
  - Errores comunes

## 🔧 Script de Verificación Completa

Crea `scripts/verify-integration.js`:

```javascript
// scripts/verify-integration.js
const admin = require('firebase-admin');

async function verifyIntegration(email, appName) {
  try {
    // Verificar que el usuario existe
    const user = await admin.auth().getUser(await admin.auth().getUserByEmail(email).then(u => u.uid));
    console.log('✅ Usuario encontrado:', user.email);
    
    // Verificar claims
    const claims = user.customClaims || {};
    console.log('📋 Claims:', JSON.stringify(claims, null, 2));
    
    if (!claims.allowedApps || !claims.allowedApps.includes(appName)) {
      console.log('❌ ERROR: El usuario NO tiene acceso a la app:', appName);
      console.log('   Ejecutar: node scripts/set-claims.js --email', email, '--apps', appName);
      return false;
    }
    
    console.log('✅ Usuario tiene acceso a:', claims.allowedApps.join(', '));
    
    // Verificar Firestore
    const userDoc = await admin.firestore().collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      console.log('✅ Documento de usuario existe en Firestore');
      console.log('   Cuota:', userDoc.data().planQuotaBytes, 'bytes');
      console.log('   Usado:', userDoc.data().usedBytes, 'bytes');
    } else {
      console.log('⚠️  Documento de usuario NO existe (se creará en primer upload)');
    }
    
    console.log('\n✅ Integración verificada correctamente para', email);
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Uso
const email = process.argv[2];
const app = process.argv[3];

if (!email || !app) {
  console.log('Uso: node scripts/verify-integration.js <email> <app-name>');
  process.exit(1);
}

verifyIntegration(email, app).then(success => {
  process.exit(success ? 0 : 1);
});
```

Uso:
```bash
node scripts/verify-integration.js test@miapp.com miapp
```

## 📊 Checklist Final

Antes de dar luz verde a la integración:

### Backend
- [ ] Variables de entorno configuradas
- [ ] CORS configurado con dominios de la app externa
- [ ] Backend responde correctamente a `/api/health`
- [ ] Firebase Auth Central funcionando
- [ ] Firebase Firestore conectado

### Usuarios
- [ ] Al menos un usuario de prueba creado
- [ ] Claims configurados correctamente (`allowedApps`)
- [ ] Usuario puede autenticarse desde la app externa
- [ ] Script `verify-integration.js` pasa para el usuario de prueba

### Pruebas
- [ ] Listado de archivos funciona (aunque esté vacío)
- [ ] Subida de archivo funciona
- [ ] Descarga de archivo funciona
- [ ] Eliminación de archivo funciona
- [ ] Compartir archivo funciona

### Documentación
- [ ] Credenciales entregadas al equipo externo
- [ ] README_INTEGRACION_RAPIDA.md proporcionado
- [ ] API_REFERENCE.md proporcionado
- [ ] Canal de soporte establecido (email/Slack/etc)

## 🆘 Problemas Comunes

### "No se pueden asignar claims"

**Síntoma:** Error al ejecutar `set-claims.js`

**Solución:**
```bash
# Verificar que tienes permisos de Admin SDK
# Verificar que FB_ADMIN_IDENTITY está correctamente configurada
node scripts/check-firebase-config.js
```

### "CORS sigue bloqueando"

**Síntoma:** Error de CORS a pesar de estar en `ALLOWED_ORIGINS`

**Soluciones:**
1. Verificar que no hay espacios en `ALLOWED_ORIGINS`
2. Verificar que el dominio es exacto (con/sin `www`)
3. Reiniciar el backend después de cambiar la variable
4. Verificar en los logs que la variable se cargó:
   ```bash
   console.log('ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);
   ```

### "Usuario no puede subir archivos"

**Síntoma:** Error 413 o "Sin espacio"

**Solución:**
```bash
# Verificar/ajustar cuota del usuario
node scripts/reconcile.js <uid>

# O manualmente en Firestore:
# users/<uid> -> planQuotaBytes = 5368709120 (5GB)
```

## 📞 Contacto

Para dudas sobre la configuración:
- **Admin del sistema**: admin@controldoc.app
- **Documentación**: Ver carpeta `/docs`
- **Issues**: GitHub issues del proyecto

---

**Versión**: 1.0.0  
**Actualizado**: Octubre 2025

