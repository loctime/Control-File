# 🚀 Despliegue en Vercel

## 📋 Variables de Entorno Requeridas

Para que la aplicación funcione correctamente en Vercel, necesitas configurar las siguientes variables de entorno en tu proyecto de Vercel:

### 🔥 Firebase (Requerido)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key_de_firebase
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=controldoc-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=controldoc-app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=controldoc-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id_de_firebase
```

### ☁️ Backblaze B2 (Opcional)

```env
B2_KEY_ID=tu_b2_key_id
B2_APPLICATION_KEY=tu_b2_application_key
B2_BUCKET_ID=tu_b2_bucket_id
B2_BUCKET_NAME=tu_b2_bucket_name
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
```

### 🌐 Configuración de la App

```env
NEXT_PUBLIC_APP_URL=https://files.controldoc.app
```

## 🔧 Cómo Configurar en Vercel

### 1. Ir a la Consola de Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Selecciona tu proyecto
3. Ve a **Settings** > **Environment Variables**

### 2. Agregar Variables de Entorno

Para cada variable de entorno:

1. **Name**: El nombre de la variable (ej: `NEXT_PUBLIC_FIREBASE_API_KEY`)
2. **Value**: El valor de la variable
3. **Environment**: Selecciona:
   - ✅ **Production** (para producción)
   - ✅ **Preview** (para previews)
   - ✅ **Development** (para desarrollo local)

### 3. Variables Específicas por Dominio

Si tienes múltiples dominios, puedes usar variables específicas:

```env
# Para files.controldoc.app
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=controldoc-app.firebaseapp.com

# Para otros dominios
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
```

## 🚨 Solución de Problemas de Build

### Error: "Type error: Argument of type 'Auth | null'"

**Problema**: Firebase Auth puede ser `null` durante el build.

**Solución**: ✅ **Ya arreglado** - Se agregaron verificaciones de nulos en `hooks/useAuth.ts`.

### Error: "getFirebaseConfig is not a function"

**Problema**: La función de configuración dinámica no está disponible en el servidor.

**Solución**: ✅ **Ya arreglado** - Se agregó verificación de `typeof window !== 'undefined'` en `lib/firebase.ts`.

### Error: "Missing required Firebase configuration"

**Problema**: Las variables de entorno de Firebase no están configuradas.

**Solución**:
1. Verifica que todas las variables de Firebase estén configuradas en Vercel
2. Asegúrate de que los valores sean correctos
3. Reinicia el despliegue

## 🔄 Despliegue Automático

### Configuración de Git

El despliegue automático está configurado para:

- **Branch**: `main`
- **Trigger**: Push a `main`
- **Environment**: Production

### Verificar Despliegue

1. Ve a la pestaña **Deployments** en Vercel
2. Verifica que el build sea exitoso
3. Revisa los logs si hay errores

## 📝 Notas Importantes

1. **Variables Públicas**: Las variables que empiezan con `NEXT_PUBLIC_` son accesibles en el cliente
2. **Variables Privadas**: Las variables sin `NEXT_PUBLIC_` solo están disponibles en el servidor
3. **Dominios**: Asegúrate de que `files.controldoc.app` esté configurado en Firebase Console
4. **SSL**: Vercel proporciona SSL automáticamente

## 🎯 Verificación Post-Despliegue

Después del despliegue, verifica:

1. ✅ La aplicación carga correctamente
2. ✅ El login con Google funciona
3. ✅ No hay errores en la consola del navegador
4. ✅ Las funciones de archivos funcionan
5. ✅ El sistema de dominios detecta correctamente `files.controldoc.app`

## 🆘 Soporte

Si tienes problemas:

1. Revisa los logs de build en Vercel
2. Verifica las variables de entorno
3. Comprueba que Firebase esté configurado correctamente
4. Revisa la consola del navegador para errores del cliente
