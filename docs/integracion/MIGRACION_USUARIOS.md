# 🔄 Guía de Migración de Usuarios

> **Para apps externas que integran con ControlFile**: Cómo migrar tus usuarios existentes al Auth Central de ControlFile.

## 🎯 Resumen Ejecutivo

**Problema:** Tu app ya tiene usuarios en tu proyecto Firebase. ¿Qué pasa con ellos al integrar con ControlFile?

**Solución:** Migración completa de usuarios al Auth Central (15-30 minutos)

**Resultado:** 
- ✅ Usuarios mantienen sus passwords
- ✅ Usuarios mantienen sus UIDs
- ✅ Usuarios NO notan ningún cambio
- ✅ Cero fricción para los usuarios

---

## ⭐ Opción Recomendada: Migración Completa

### ¿Por qué esta opción?

| Ventaja | Detalle |
|---------|---------|
| **Sin cambios para usuarios** | Siguen usando el mismo email y password |
| **UIDs preservados** | Sus datos en Firestore siguen vinculados correctamente |
| **Passwords funcionan** | Los hashes se migran, no necesitan resetear |
| **Una sola vez** | Se hace antes del lanzamiento, no hay migración "lazy" |
| **Soporte OAuth** | Google, Facebook, etc. se migran automáticamente |
| **Cero código extra** | No requiere lógica de migración en la app |

### ¿Qué se migra?

- ✅ Email y password (hash completo)
- ✅ Métodos de autenticación (Google, Facebook, etc.)
- ✅ UIDs (mantienen el mismo)
- ✅ Email verificado (status)
- ✅ Nombre y foto de perfil
- ✅ Fecha de creación
- ✅ Metadata personalizada

### ¿Qué NO se migra?

- ❌ Datos de Firestore (no es necesario, se quedan en tu proyecto)
- ❌ Storage (Firebase Storage de tu proyecto)
- ❌ Configuraciones de la app

---

## 📋 Proceso de Migración (Paso a Paso)

### Tiempo estimado: 15-30 minutos

### Prerequisitos

- [ ] Acceso admin a tu proyecto Firebase actual
- [ ] Credenciales del Auth Central de ControlFile (solicitadas al admin)
- [ ] Firebase CLI instalado
- [ ] Backup de seguridad (recomendado)

---

## 🚀 Paso 1: Preparación

### 1.1 Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

### 1.2 Login en Firebase

```bash
firebase login
```

### 1.3 Verificar acceso a tu proyecto

```bash
firebase projects:list
```

Deberías ver tu proyecto en la lista.

---

## 📤 Paso 2: Exportar Usuarios

### 2.1 Seleccionar tu proyecto actual

```bash
firebase use tu-proyecto-actual
```

### 2.2 Exportar todos los usuarios

```bash
firebase auth:export users.json
```

**Salida esperada:**
```
Exporting accounts to users.json
Exported 1,523 account(s) successfully.
```

### 2.3 Verificar el archivo exportado

```bash
# Ver primeras líneas del archivo
head -20 users.json
```

El archivo debe contener algo como:
```json
{
  "users": [
    {
      "localId": "uid_abc123",
      "email": "usuario@ejemplo.com",
      "emailVerified": true,
      "passwordHash": "...",
      "salt": "...",
      "createdAt": "1633024800000",
      "lastSignedInAt": "1696464000000",
      "displayName": "Juan Pérez",
      "photoUrl": "https://..."
    },
    {
      "localId": "uid_def456",
      "email": "maria@ejemplo.com",
      "emailVerified": true,
      "providerUserInfo": [
        {
          "providerId": "google.com",
          "rawId": "1234567890",
          "email": "maria@ejemplo.com",
          "displayName": "María García",
          "photoUrl": "https://..."
        }
      ]
    }
  ]
}
```

### 2.4 (Opcional) Filtrar usuarios

Si solo quieres migrar algunos usuarios:

```bash
# Ejemplo: solo usuarios verificados
cat users.json | jq '.users[] | select(.emailVerified == true)' > users-verified.json
```

---

## 📥 Paso 3: Importar al Auth Central

### 3.1 Cambiar al proyecto Auth Central de ControlFile

```bash
firebase use controlstorage-eb796
# O el ID del proyecto que te proporcionó el admin de ControlFile
```

### 3.2 Importar usuarios

```bash
firebase auth:import users.json --hash-algo SCRYPT
```

**⚠️ Importante:** El flag `--hash-algo SCRYPT` es crucial para que los passwords funcionen.

**Salida esperada:**
```
Processing users.json
Importing users...
Successfully imported 1,523 users.
Failed to import 0 users.
```

### 3.3 Verificar importación

```bash
# Listar usuarios en Auth Central
firebase auth:export verify.json

# Comparar cantidad
wc -l users.json
wc -l verify.json
# Deberían ser iguales (o muy similares)
```

---

## 🔐 Paso 4: Asignar Claims de Acceso

Cada usuario necesita el claim `allowedApps` para acceder a tu aplicación.

### 4.1 Contactar al admin de ControlFile

Proporciona la lista de emails o UIDs:

```bash
# Extraer solo emails
cat users.json | jq -r '.users[].email' > emails.txt
```

### 4.2 El admin ejecuta (Backend de ControlFile)

**Para un usuario:**
```bash
node scripts/set-claims.js \
  --email usuario@ejemplo.com \
  --apps miapp \
  --plans miapp=basic
```

**Para múltiples usuarios (batch):**

Crear archivo `users-claims.csv`:
```csv
email,plan
usuario1@ejemplo.com,basic
usuario2@ejemplo.com,premium
usuario3@ejemplo.com,basic
```

Script de batch:
```bash
#!/bin/bash
# batch-claims.sh

APP_NAME="miapp"

while IFS=',' read -r email plan
do
  if [ "$email" != "email" ]; then  # Skip header
    echo "Asignando claims a: $email"
    node scripts/set-claims.js \
      --email "$email" \
      --apps "$APP_NAME" \
      --plans "$APP_NAME=$plan"
  fi
done < users-claims.csv

echo "✅ Claims asignados a todos los usuarios"
```

Ejecutar:
```bash
chmod +x batch-claims.sh
./batch-claims.sh
```

---

## 🔧 Paso 5: Actualizar tu Aplicación

### 5.1 Cambiar configuración de Firebase

**Antes (`lib/firebase.ts`):**
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIza_tu_api_key_antigua",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto-antiguo",
  appId: "1:123:web:abc"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

**Después (`lib/firebase-auth.ts`):**
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// ⭐ Configuración del Auth Central de ControlFile
const authConfig = {
  apiKey: "AIza...", // Del proyecto central
  authDomain: "controlstorage-eb796.firebaseapp.com",
  projectId: "controlstorage-eb796",
  appId: "1:456:web:xyz"
};

export const authApp = initializeApp(authConfig);
export const auth = getAuth(authApp);
```

### 5.2 (Opcional) Mantener tu Firestore separado

Si tienes datos en tu Firestore, mantenlo:

```typescript
// lib/my-firestore.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Tu proyecto de datos (diferente del Auth)
const dataConfig = {
  apiKey: "tu-api-key",
  projectId: "tu-proyecto-datos",
  // ...
};

const dataApp = initializeApp(dataConfig, 'myData');
export const db = getFirestore(dataApp);
```

### 5.3 Variables de entorno

`.env.local`:
```env
# Auth Central (ControlFile)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=controlstorage-eb796.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=controlstorage-eb796
NEXT_PUBLIC_FIREBASE_APP_ID=1:456:web:xyz

# Backend ControlFile
NEXT_PUBLIC_CONTROLFILE_BACKEND=https://tu-backend.onrender.com

# Tu Firestore (si lo mantienes separado)
NEXT_PUBLIC_MY_FIRESTORE_PROJECT_ID=tu-proyecto-datos
NEXT_PUBLIC_MY_FIRESTORE_API_KEY=...
```

---

## ✅ Paso 6: Probar

### 6.1 Prueba con usuario de desarrollo

```typescript
// En consola del navegador o app de prueba
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase-auth';

const user = await signInWithEmailAndPassword(
  auth, 
  "test@ejemplo.com", 
  "password_original"
);

console.log('✅ Login exitoso:', user.uid);
console.log('✅ Email:', user.email);
console.log('✅ Token:', await user.getIdToken());
```

### 6.2 Probar llamadas a ControlFile

```typescript
import { uploadFile, listFiles } from './storage';

// Subir archivo
const fileId = await uploadFile(testFile);
console.log('✅ Archivo subido:', fileId);

// Listar archivos
const files = await listFiles();
console.log('✅ Archivos:', files);
```

### 6.3 Verificar acceso a tu Firestore

```typescript
import { db } from './my-firestore';
import { collection, getDocs } from 'firebase/firestore';

const docs = await getDocs(collection(db, 'facturas'));
console.log('✅ Tus datos siguen accesibles:', docs.size);
```

---

## 🚀 Paso 7: Desplegar

### 7.1 Build de producción

```bash
npm run build
```

### 7.2 Probar build localmente

```bash
npm run start
# Probar login con usuarios reales
```

### 7.3 Desplegar

```bash
# Vercel
vercel --prod

# O el método que uses
npm run deploy
```

---

## 📊 Verificación Post-Migración

### Checklist de Validación

- [ ] Usuarios pueden hacer login con sus passwords originales
- [ ] Usuarios con Google OAuth pueden autenticarse
- [ ] Los UIDs son los mismos que antes
- [ ] Los datos en tu Firestore siguen accesibles
- [ ] Los archivos se pueden subir a ControlFile
- [ ] Los archivos se pueden descargar
- [ ] No hay errores 403 "App no permitida"

### Script de verificación

```bash
#!/bin/bash
# verify-migration.sh

echo "🔍 Verificando migración..."

# 1. Contar usuarios en Auth Central
firebase use controlstorage-eb796
firebase auth:export temp-verify.json
USERS_COUNT=$(cat temp-verify.json | jq '.users | length')
echo "✅ Usuarios migrados: $USERS_COUNT"
rm temp-verify.json

# 2. Verificar algunos usuarios manualmente
echo "📧 Probando login con usuarios de prueba..."
# (aquí puedes agregar lógica de prueba)

echo "✅ Verificación completa"
```

---

## ⚠️ Troubleshooting

### "Failed to import users: invalid password hash"

**Causa:** Falta el flag `--hash-algo SCRYPT`

**Solución:**
```bash
firebase auth:import users.json --hash-algo SCRYPT
```

### "Error 403: App no permitida"

**Causa:** Usuario no tiene el claim `allowedApps`

**Solución:** Asignar claims (ver Paso 4)

### "Usuario no puede hacer login con password original"

**Causa:** El hash no se importó correctamente

**Solución:** 
1. Verificar que usaste `--hash-algo SCRYPT`
2. Pedir al usuario que resetee su password:
   ```typescript
   await sendPasswordResetEmail(auth, email);
   ```

### "Los datos en mi Firestore no se ven"

**Causa:** UIDs cambiaron durante la importación

**Solución:**
1. Verificar que los UIDs son iguales:
   ```bash
   # Original
   cat users.json | jq -r '.users[0].localId'
   
   # Después de importar
   firebase auth:export verify.json
   cat verify.json | jq -r '.users[0].localId'
   ```

2. Si son diferentes, la importación tuvo un problema. Re-exportar e importar.

---

## 🔄 Rollback (Si algo sale mal)

### Opción 1: Volver a la config anterior

```typescript
// Cambiar de vuelta a tu proyecto original
const firebaseConfig = {
  projectId: "tu-proyecto-antiguo", // ← Restaurar
  // ...
};
```

Desplegar de nuevo.

### Opción 2: Eliminar usuarios importados

**⚠️ CUIDADO:** Solo si algo salió muy mal

```bash
# No hay comando automático, contactar al admin de ControlFile
# Ellos pueden eliminar los usuarios del Auth Central si es necesario
```

---

## 📈 Mejores Prácticas

### Antes de la migración:

1. ✅ **Backup completo** de tu proyecto Firebase
2. ✅ **Comunicar a usuarios** (opcional): "Estamos mejorando el sistema..."
3. ✅ **Probar en entorno de staging** primero
4. ✅ **Ventana de mantenimiento** (opcional, si quieres ser extra cauteloso)

### Durante la migración:

5. ✅ **Exportar usuarios** en horario de bajo tráfico
6. ✅ **Verificar el archivo** `users.json` antes de importar
7. ✅ **Importar con `--hash-algo SCRYPT`**
8. ✅ **Probar con usuarios de prueba** antes del deploy

### Después de la migración:

9. ✅ **Monitorear errores** de login las primeras 24-48h
10. ✅ **Soporte prioritario** para usuarios con problemas
11. ✅ **Verificar métricas** de autenticación

---

## 📞 Soporte

### Durante la migración:

**Antes de empezar:**
- Contactar al admin de ControlFile para coordinar
- Obtener credenciales del Auth Central
- Alinear horarios si es necesario

**Si tienes problemas:**
- Email: soporte@controldoc.com
- Documentación: Ver `README_INTEGRACION_RAPIDA.md`

### Datos útiles para reportar problemas:

```bash
# Cantidad de usuarios a migrar
cat users.json | jq '.users | length'

# Tipos de autenticación
cat users.json | jq -r '.users[].providerUserInfo[]?.providerId' | sort | uniq -c

# Usuarios con email verificado
cat users.json | jq '[.users[] | select(.emailVerified == true)] | length'
```

---

## 🎯 Resumen de Comandos

```bash
# 1. Instalar CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Exportar (desde tu proyecto)
firebase use tu-proyecto-actual
firebase auth:export users.json

# 4. Importar (al Auth Central)
firebase use controlstorage-eb796
firebase auth:import users.json --hash-algo SCRYPT

# 5. Verificar
firebase auth:export verify.json
cat verify.json | jq '.users | length'

# 6. Asignar claims (admin de ControlFile)
node scripts/set-claims.js --email usuario@ejemplo.com --apps miapp
```

---

## ✅ Checklist Final

- [ ] Usuarios exportados correctamente
- [ ] Archivo `users.json` verificado
- [ ] Usuarios importados al Auth Central
- [ ] Claims asignados a todos los usuarios
- [ ] Configuración de la app actualizada
- [ ] Variables de entorno configuradas
- [ ] Login probado con usuarios de prueba
- [ ] Integración con ControlFile probada
- [ ] Datos en tu Firestore accesibles
- [ ] Aplicación desplegada
- [ ] Monitoreo activo post-migración

---

**¿Listo para migrar?** Sigue los 7 pasos y en menos de 30 minutos tus usuarios estarán migrados sin que noten ningún cambio. 🚀

**Tiempo total estimado:** 15-30 minutos  
**Dificultad:** ⭐⭐ Baja-Media  
**Impacto en usuarios:** ✅ Cero (transparente)

