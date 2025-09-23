# ControlAudit - Google Sign-In Nativo (Capacitor + Firebase)

Guía para integrar inicio de sesión con Google nativo en la APK usando Capacitor y Firebase Authentication. Evita redirecciones a localhost y no requiere modificar redirect_uri en el SDK web.

## Resultado esperado
- En Android se abre la cuenta de Google/Chrome Custom Tab.
- Se obtiene idToken y se hace signInWithCredential en Firebase.
- No hay /__/auth/handler ni vuelta a localhost.

## 1) Requisitos en Firebase
1. Proyecto: controlstorage-eb796.
2. Authentication -> Sign-in method -> Google: habilitado.
3. Project settings -> General -> App Android `com.controlaudit.app`:
   - Agrega huellas SHA-1 y SHA-256 (debug y release).
   - Descarga/actualiza `android/app/google-services.json`.

Cómo obtener huellas (ejemplos):
```bash
./gradlew signingReport | cat
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android | cat
keytool -list -v -keystore /ruta/mi-release.keystore -alias MI_ALIAS | cat
```

## 2) Gradle Android
`android/build.gradle` (Proyecto):
```gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.2'
  }
}
```
`android/app/build.gradle`:
```gradle
plugins {
  id 'com.android.application'
  id 'com.google.gms.google-services'
}

dependencies {
  implementation 'com.google.firebase:firebase-auth:23.0.0'
  implementation 'com.google.android.gms:play-services-auth:21.1.1'
}
```
Coloca `google-services.json` en `android/app/`.

## 3) Plugin Capacitor
```bash
npm i @capacitor/google-auth
npx cap sync android
```

## 4) Client ID correcto (Web)
Para `@capacitor/google-auth` en Android usa el Client ID de tipo Web (no Android). Tómalo de:
- `android/app/google-services.json` -> `oauth_client` con `client_type: 3`; o
- Firebase Console -> Authentication -> Google -> “Web client ID”.

Ejemplo:
```
909876364192-akleu8n2p915ovgum0jsnuhcckeavp9t.apps.googleusercontent.com
```

## 5) Inicialización y login nativo
```ts
// auth.native.ts
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@capacitor/google-auth';
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';

const auth = getAuth();

export function initGoogleAuth() {
  if (Capacitor.getPlatform() === 'android') {
    GoogleAuth.initialize({
      clientId: 'REEMPLAZAR_POR_CLIENT_ID_WEB',
      scopes: ['email', 'profile']
    });
  }
}

export async function signInWithGoogleNative() {
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) throw new Error('Solo Android nativo');
  const res = await GoogleAuth.signIn();
  const idToken = res?.authentication?.idToken;
  if (!idToken) throw new Error('Sin idToken de Google');
  const credential = GoogleAuthProvider.credential(idToken);
  return await signInWithCredential(auth, credential);
}

export async function signOutAll() {
  try { await signOut(auth); } catch {}
}
```
Inicializa al arrancar:
```ts
import { initGoogleAuth } from './auth.native';
initGoogleAuth();
```
Usa `signInWithGoogleNative()` en el botón.

## 6) Limpieza del flujo web en APK
- Quita `auth.config.redirectUri` y cualquier override similar.
- Elimina listeners `appUrlOpen/appStateChange` usados para `signInWithRedirect`.
- No inicies el flujo web dentro de una WebView `http://localhost`.

## 7) Manifest y permisos
Solo `INTERNET`. El intent-filter con esquema personalizado no es necesario para el flujo nativo (puede quedar).
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## 8) Errores comunes
- `DEVELOPER_ERROR/12500`: faltan SHA-1/SHA-256 o `google-services.json` no coincide con la firma.
- `Sign in failed`: revisa `clientId` (Web) y que Google esté habilitado.
- “App blocked”: suele indicar `clientId` equivocado.

Checklist:
- [ ] SHA-1 y SHA-256 (debug y release) cargadas
- [ ] `google-services.json` actualizado
- [ ] `@capacitor/google-auth` inicializado con Client ID Web
- [ ] `firebase-auth` y `play-services-auth` instalados
- [ ] En Android se usa `signInWithGoogleNative()`

## 9) Plan de prueba
1. Instalar APK de debug firmada con keystore de debug.
2. Pulsar “Acceder con Google”.
3. Ver que inicia sesión (onAuthStateChanged).
4. Cerrar sesión y reintentar.
5. Repetir con APK de release tras subir huellas de release.

## 10) Ejemplo de botón
```ts
import { signInWithGoogleNative } from './auth.native';

async function handleGoogle() {
  try {
    const userCred = await signInWithGoogleNative();
    console.log('Signed in:', userCred.user.uid);
  } catch (e) {
    console.error('Google sign-in failed', e);
  }
}
```

¿Dudas? Envíen el `clientId` usado, logs de `GoogleAuth.signIn()` y confirmación de huellas.
