# 🔥 Configuración de Dominio en Firebase Console

## 🚨 Problema Actual

El error `auth/unauthorized-domain` indica que `files.controldoc.app` no está autorizado en Firebase Authentication.

## ✅ Solución Manual

### 1. **Ir a Firebase Console**

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona el proyecto: **controldoc-a25a9** (controldocadm)

### 2. **Navegar a Authentication**

1. En el menú lateral, haz clic en **Authentication**
2. Ve a la pestaña **Settings** (Configuración)
3. Busca la sección **Authorized domains** (Dominios autorizados)

### 3. **Agregar el Dominio**

1. Haz clic en **Add domain** (Agregar dominio)
2. Escribe: `files.controldoc.app`
3. Haz clic en **Add** (Agregar)

### 4. **Verificar**

El dominio debería aparecer en la lista de dominios autorizados junto con:
- `controldoc-a25a9.firebaseapp.com` (dominio por defecto)
- `localhost` (para desarrollo)

## 🔧 Configuración Alternativa

Si no puedes acceder a Firebase Console, también puedes:

### Opción 1: Usar Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Selecciona el proyecto: `controldoc-a25a9`
3. Ve a **APIs & Services** > **Credentials**
4. Busca la configuración de OAuth 2.0
5. Agrega `https://files.controldoc.app` a los dominios autorizados

### Opción 2: Verificar Variables de Entorno

Asegúrate de que las variables de entorno en Vercel estén configuradas correctamente:

```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=controldoc-a25a9.firebaseapp.com
```

## 🎯 Verificación

Después de agregar el dominio:

1. **Espera 5-10 minutos** para que los cambios se propaguen
2. **Reinicia la aplicación** en Vercel
3. **Prueba el login** con Google nuevamente

## 🚨 Si el Problema Persiste

### Verificar Configuración de Firebase

1. Ve a **Project Settings** en Firebase Console
2. Verifica que el **Project ID** sea: `controldoc-a25a9`
3. Verifica que el **Web app** esté configurado correctamente

### Verificar Variables de Entorno en Vercel

1. Ve a tu proyecto en Vercel
2. Ve a **Settings** > **Environment Variables**
3. Verifica que todas las variables de Firebase estén configuradas:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=controldoc-a25a9.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=controldoc-a25a9
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=controldoc-a25a9.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id
```

## 📞 Soporte

Si necesitas ayuda:

1. Verifica que tienes permisos de administrador en el proyecto Firebase
2. Asegúrate de estar usando el proyecto correcto (`controldoc-a25a9`)
3. Revisa los logs de Firebase Console para más detalles
