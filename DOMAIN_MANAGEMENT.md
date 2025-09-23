# 🚀 Gestión Automática de Dominios

Este sistema permite manejar múltiples dominios automáticamente sin necesidad de configurar cada uno manualmente en Firebase.

## 🔧 Características

- ✅ **Configuración automática de dominios**
- ✅ **Autenticación con redirección** (evita problemas de dominios no autorizados)
- ✅ **Script automatizado** para agregar nuevos dominios
- ✅ **Configuración dinámica** basada en el dominio actual
- ✅ **Fallback automático** a configuración por defecto

## 📋 Configuración Inicial

### 1. Configurar Firebase

Asegúrate de tener configurado Firebase en tu proyecto:

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Autenticarse
firebase login

# Inicializar proyecto (si no está inicializado)
firebase init
```

### 2. Configurar variables de entorno

Crea un archivo `.env.local` con tu configuración de Firebase:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

# Backblaze B2 (opcional)
B2_KEY_ID=tu_b2_key_id
B2_APPLICATION_KEY=tu_b2_application_key
B2_BUCKET_ID=tu_b2_bucket_id
B2_BUCKET_NAME=tu_b2_bucket_name
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
```

## 🆕 Agregar un Nuevo Dominio

### Opción 1: Script Automático (Recomendado)

```bash
# Agregar un nuevo dominio
npm run add-domain files.controldoc.app

# O directamente con node
node scripts/add-domain.js files.controldoc.app
```

El script automáticamente:
- ✅ Agrega el dominio a Firebase Auth
- ✅ Actualiza la configuración en `lib/domain-config.ts`
- ✅ Crea un archivo de configuración específico
- ✅ Proporciona instrucciones para los próximos pasos

### Opción 2: Manual

1. **Agregar el dominio en Firebase Console:**
   - Ve a Firebase Console > Authentication > Settings > Authorized domains
   - Agrega tu nuevo dominio

2. **Actualizar la configuración en `lib/domain-config.ts`:**
   ```typescript
   'files.controldoc.app': {
     domain: 'files.controldoc.app',
     firebaseConfig: {
       apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
       authDomain: 'tu-proyecto.firebaseapp.com',
       projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
       storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
       messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
       appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
     },
   },
   ```

## 🔄 Cómo Funciona

### 1. Detección Automática de Dominio

El sistema detecta automáticamente el dominio actual y busca la configuración correspondiente:

```typescript
// lib/domain-config.ts
export function getCurrentDomainConfig(): DomainConfig | null {
  const currentDomain = window.location.hostname;
  
  // Buscar configuración exacta
  if (DOMAIN_CONFIGS[currentDomain]) {
    return DOMAIN_CONFIGS[currentDomain];
  }
  
  // Buscar configuración por subdominio
  const subdomainMatch = Object.keys(DOMAIN_CONFIGS).find(domain => 
    currentDomain.endsWith(domain) && domain !== 'localhost'
  );
  
  return subdomainMatch ? DOMAIN_CONFIGS[subdomainMatch] : null;
}
```

### 2. Autenticación con Redirección

En lugar de usar popups (que requieren dominios autorizados), el sistema usa redirección:

```typescript
// hooks/useAuth.ts
const signInWithGoogle = async () => {
  // Usar redirección en lugar de popup
  await signInWithRedirect(auth, googleProvider);
};
```

### 3. Manejo de Errores

El sistema maneja automáticamente los errores de dominios no autorizados:

```typescript
// Manejo de errores de dominio no autorizado
if (error.code === 'auth/unauthorized-domain') {
  console.warn('⚠️ Dominio no autorizado, pero continuando...');
}
```

## 🛠️ Estructura de Archivos

```
lib/
├── domain-config.ts          # Configuración de dominios
├── firebase.ts              # Configuración de Firebase
└── ...

components/common/
└── DomainConfigProvider.tsx # Proveedor de configuración

scripts/
└── add-domain.js           # Script para agregar dominios

DOMAIN_MANAGEMENT.md        # Esta documentación
```

## 🚨 Solución de Problemas

### Error: "auth/unauthorized-domain"

**Problema:** El dominio no está autorizado en Firebase.

**Solución:**
1. Ve a Firebase Console > Authentication > Settings > Authorized domains
2. Agrega tu dominio a la lista
3. O usa el script automático: `npm run add-domain tu-dominio.com`

### Error: "No se encontró configuración para el dominio"

**Problema:** El dominio no está configurado en `lib/domain-config.ts`.

**Solución:**
1. Ejecuta: `npm run add-domain tu-dominio.com`
2. O agrega manualmente la configuración en `lib/domain-config.ts`

### Error: "Firebase no está configurado"

**Problema:** Las variables de entorno no están configuradas.

**Solución:**
1. Verifica que el archivo `.env.local` existe
2. Asegúrate de que todas las variables de Firebase estén configuradas
3. Reinicia el servidor de desarrollo

## 📝 Notas Importantes

1. **Dominio Principal:** Siempre usa el dominio principal de Firebase (`tu-proyecto.firebaseapp.com`) en `authDomain`
2. **Variables de Entorno:** Las variables de entorno deben estar configuradas en el servidor de producción
3. **Subdominios:** El sistema soporta automáticamente subdominios si el dominio principal está configurado
4. **Desarrollo Local:** Para desarrollo local, usa la configuración de `localhost`

## 🔮 Próximas Mejoras

- [ ] API para agregar dominios dinámicamente
- [ ] Panel de administración para gestionar dominios
- [ ] Configuración automática de DNS
- [ ] Monitoreo de dominios activos
- [ ] Backup automático de configuraciones

## 📞 Soporte

Si tienes problemas con la configuración de dominios:

1. Revisa los logs en la consola del navegador
2. Verifica que el dominio esté en Firebase Console
3. Asegúrate de que las variables de entorno estén configuradas
4. Ejecuta el script de diagnóstico: `npm run add-domain --help`
