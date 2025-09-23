# ControlFile - Documentación Móvil con Capacitor

## 📱 Resumen

ControlFile ahora tiene soporte completo para dispositivos móviles Android mediante Capacitor, permitiendo generar APKs nativas que mantienen todas las funcionalidades de la aplicación web.

## ✅ Implementación Completada

### **Configuración Base:**
- ✅ Capacitor instalado y configurado
- ✅ Plataforma Android agregada
- ✅ Plugins esenciales instalados
- ✅ Configuración de red local para desarrollo
- ✅ Scripts de build automatizados

### **Plugins Capacitor Instalados:**
- 📷 **@capacitor/camera** - Acceso a cámara
- 📁 **@capacitor/filesystem** - Acceso a archivos locales
- 🔗 **@capacitor/share** - Compartir archivos
- 📱 **@capacitor/device** - Información del dispositivo
- 🌐 **@capacitor/network** - Estado de conexión
- 🎨 **@capacitor/splash-screen** - Pantalla de carga
- 📊 **@capacitor/status-bar** - Barra de estado

## 🛠️ Configuración Técnica

### **Archivos Principales:**

#### `capacitor.config.ts`
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.controlfile.files.controldoc.app',
  appName: 'ControlFile',
  webDir: '.next',
  server: {
    androidScheme: 'https',
    url: 'http://localhost:3000', // URL local para desarrollo
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1f2937",
      showSpinner: false
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1f2937'
    }
  }
};

export default config;
```

#### `lib/domain-config.ts` (Configuración de Dominios)
```typescript
export const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  'files.controldoc.app': {
    domain: 'files.controldoc.app',
    firebaseConfig: { /* configuración de producción */ }
  },
  'localhost': {
    domain: 'localhost',
    firebaseConfig: { /* configuración de desarrollo */ }
  },
  'local-dev': {
    domain: 'local-dev',
    firebaseConfig: { /* configuración para desarrollo móvil */ }
  }
};
```

#### `package.json` (Scripts Agregados)
```json
{
  "scripts": {
    "build:mobile": "npx cap sync",
    "dev:mobile": "npm run dev:frontend & npx cap run android",
    "android:build": "npm run build:mobile && npx cap build android",
    "android:open": "npx cap open android",
    "android:sync": "npx cap sync android"
  }
}
```

## 🚀 Comandos de Desarrollo

### **Desarrollo Local:**
```bash
# Iniciar servidor Next.js
npm run dev:frontend

# Sincronizar cambios con Android
npm run build:mobile

# Abrir proyecto en Android Studio
npm run android:open
```

### **Generar APK:**
```bash
# Build completo para Android
npm run android:build

# O manualmente:
cd android
.\gradlew assembleDebug
```

## 📱 Proceso de Build

### **1. Desarrollo:**
1. Ejecutar `npm run dev:frontend` (servidor en puerto 3000)
2. Configurar IP local en `capacitor.config.ts`
3. Ejecutar `npm run build:mobile` para sincronizar
4. Abrir en Android Studio con `npm run android:open`

### **2. Generar APK:**
1. Configurar variables de entorno en `.env.local`
2. Ejecutar `npm run android:build`
3. APK generada en: `android/app/build/outputs/apk/debug/app-debug.apk`

### **3. Ubicación de APK:**
```
android/app/build/outputs/apk/
├── debug/
│   └── app-debug.apk          # Versión de desarrollo (236 MB)
└── release/
    └── app-release.apk        # Versión de producción (requiere firma)
```

## 🔧 Configuración de Red

### **Desarrollo Local:**
- **PC IP**: `YOUR_LOCAL_IP` (detectar con `ipconfig`)
- **Puerto**: `3000` (Next.js)
- **Configuración**: Actualizada en `capacitor.config.ts`
- **Dominio**: Agregado en `lib/domain-config.ts`

### **Variables de Entorno Requeridas:**
```bash
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=controldoc-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=controldoc-app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=controldoc-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

NEXT_PUBLIC_APP_URL=http://YOUR_LOCAL_IP:3000
NEXT_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:3001
```

## 🐛 Problemas Resueltos

### **1. Error de Memoria Java:**
- **Problema**: `Out of memory. Java heap space`
- **Solución**: Aumentar memoria en `android/gradle.properties`
```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
org.gradle.parallel=true
org.gradle.daemon=true
```

### **2. Conexión de Red:**
- **Problema**: `ERR_CONNECTION_REFUSED` en móvil
- **Solución**: Configurar IP local en lugar de `localhost`
```typescript
server: {
  url: 'http://YOUR_LOCAL_IP:3000',
  cleartext: true
}
```

### **3. Dominio Incorrecto:**
- **Problema**: App mostraba `stock.controldoc.app` en lugar de `files.controldoc.app`
- **Solución**: Agregar configuración de dominio para IP local en `domain-config.ts`

## 📊 Estadísticas del Build

### **APK Debug:**
- **Tamaño**: 236 MB
- **Tiempo de Build**: ~30 segundos
- **Plugins**: 7 Capacitor plugins
- **Estado**: ✅ Funcionando correctamente

### **Logs de Funcionamiento:**
```
✅ Capacitor funcionando: App restarted, App started, App resumed
✅ Red detectada: NetworkPlugin activo
✅ Cámara disponible: CameraInjector funcionando
✅ App pausa/reanuda: Comportamiento normal de Android
```

## 🚀 Próximos Pasos para Producción

### **1. Build de Producción:**
```bash
# Generar APK firmada para Play Store
cd android
.\gradlew assembleRelease
```

### **2. Configuración de Producción:**
- Cambiar `server.url` a URL de producción
- Configurar firma digital
- Optimizar tamaño de APK
- Configurar CI/CD con GitHub Actions

### **3. Distribución:**
- Subir a Google Play Store
- Configurar actualizaciones automáticas
- Implementar analytics móvil

## 📚 Referencias

### **Documentación Oficial:**
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Development](https://developer.android.com/)
- [Next.js Mobile](https://nextjs.org/docs/advanced-features/static-html-export)

### **Archivos de Configuración:**
- `capacitor.config.ts` - Configuración principal
- `lib/domain-config.ts` - Configuración de dominios
- `android/gradle.properties` - Configuración de build
- `.env.local` - Variables de entorno

## ✅ Estado Final

ControlFile ahora tiene:
- ✅ **APK funcional** para Android
- ✅ **Todas las funcionalidades** de la app web
- ✅ **Autenticación Firebase** funcionando
- ✅ **Subida de archivos** a Backblaze B2
- ✅ **Interfaz responsive** optimizada para móvil
- ✅ **Configuración de desarrollo** completa

La implementación está lista para uso y futuras mejoras de producción.

