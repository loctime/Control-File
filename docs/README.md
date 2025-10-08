# 📚 Documentación de ControlFile

Bienvenido a la documentación completa de ControlFile, un sistema de almacenamiento en la nube con integración a Backblaze B2 y Firebase.

## 📂 Documentación por Categoría

### 🔗 [Integración con Apps Externas](./integracion/)
Guías completas para integrar ControlFile con aplicaciones externas (ControlAudit, ControlDoc, etc.)

**Documentos principales:**
- **[README_INTEGRACION_RAPIDA.md](./integracion/README_INTEGRACION_RAPIDA.md)** ⭐ - Guía práctica de 5 minutos
- **[GUIA_CONSUMIR_SHARE_LINKS.md](./integracion/GUIA_CONSUMIR_SHARE_LINKS.md)** 🔗 - Descargar archivos compartidos sin autenticación
- **[GUIA_BACKEND.md](./integracion/GUIA_BACKEND.md)** - Crear carpetas desde backend
- **[MIGRACION_USUARIOS.md](./integracion/MIGRACION_USUARIOS.md)** - Migrar usuarios existentes

**Audiencia:** Desarrolladores que integran ControlFile en sus apps

---

### 📱 [Mobile (Android/iOS)](./mobile/)
Documentación para construir y deployar la aplicación móvil

**Documentos principales:**
- **[BUILD_APK_GUIDE.md](./mobile/BUILD_APK_GUIDE.md)** - Construir APK de producción
- **[MOBILE_SETUP.md](./mobile/MOBILE_SETUP.md)** - Configuración inicial
- **[CAPACITOR_MOBILE_DOCS.md](./mobile/CAPACITOR_MOBILE_DOCS.md)** - Documentación de Capacitor

**Audiencia:** Desarrolladores móvil, DevOps

---

### 🚀 [Deployment y Configuración](./deployment/)
Guías de deployment, dominios, CORS y configuración de servicios

**Documentos principales:**
- **[DEPLOYMENT.md](./deployment/DEPLOYMENT.md)** - Guía general de deployment
- **[VERCEL_DEPLOYMENT.md](./deployment/VERCEL_DEPLOYMENT.md)** - Deployment en Vercel
- **[DOMAIN_MANAGEMENT.md](./deployment/DOMAIN_MANAGEMENT.md)** - Gestión de dominios
- **[CORS_SOLUTION.md](./deployment/CORS_SOLUTION.md)** - Configuración CORS

**Audiencia:** DevOps, Administradores

---

### ✨ [Features del Sistema](./features/)
Documentación de las características y funcionalidades

**Documentos principales:**
- **[TASKBAR_SYSTEM.md](./features/TASKBAR_SYSTEM.md)** - Sistema de barra de tareas
- **[MENU_CONTEXTUAL.md](./features/MENU_CONTEXTUAL.md)** - Menú contextual
- **[PAPELERA_RECICLAJE.md](./features/PAPELERA_RECICLAJE.md)** - Sistema de papelera
- **[NOTIFICACIONES_MEJORADAS.md](./features/NOTIFICACIONES_MEJORADAS.md)** - Sistema de notificaciones

**Audiencia:** Desarrolladores, Product Managers

---

### 🔧 [Documentación Técnica](./technical/)
Notas técnicas, fixes y decisiones arquitectónicas

**Documentos principales:**
- **[BUILD_FIXES.md](./technical/BUILD_FIXES.md)** - Soluciones a problemas de build
- **[FIREBASE_INDEX_FIX.md](./technical/FIREBASE_INDEX_FIX.md)** - Configuración de índices
- **[PROXY_SOLUTION.md](./technical/PROXY_SOLUTION.md)** - Implementación del proxy
- **[REFACTORING_FILEEXPLORER.md](./technical/REFACTORING_FILEEXPLORER.md)** - Refactorización

**Audiencia:** Desarrolladores senior, Arquitectos

---

### 🔐 [Autenticación y OAuth](./auth/)
Configuración de autenticación y OAuth para apps externas

**Documentos principales:**
- **[ControlAuditAuth.md](./auth/ControlAuditAuth.md)** - Auth para ControlAudit
- **[ControlAuditOAuth.md](./auth/ControlAuditOAuth.md)** - Flujo OAuth

**Audiencia:** Desarrolladores, Admins

---

## 🚀 Guías de Inicio Rápido

### Para Desarrolladores que Integran ControlFile
1. Lee [README_INTEGRACION_RAPIDA.md](./integracion/README_INTEGRACION_RAPIDA.md)
2. Configura Firebase Auth Central
3. Copia el código del SDK
4. ¡Listo para subir/descargar archivos!

### Para Consumir Share Links Públicos
1. Lee [GUIA_CONSUMIR_SHARE_LINKS.md](./integracion/GUIA_CONSUMIR_SHARE_LINKS.md)
2. Copia la clase `ControlFileShareClient`
3. Usa `downloadFile(shareToken)` sin autenticación

### Para Build Móvil (Android)
1. Lee [MOBILE_SETUP.md](./mobile/MOBILE_SETUP.md)
2. Configura Android Studio
3. Sigue [BUILD_APK_GUIDE.md](./mobile/BUILD_APK_GUIDE.md)

### Para Deployment en Producción
1. Lee [DEPLOYMENT.md](./deployment/DEPLOYMENT.md)
2. Configura variables de entorno
3. Configura dominios en [DOMAIN_MANAGEMENT.md](./deployment/DOMAIN_MANAGEMENT.md)

---

## 📖 Referencias Rápidas

### API Reference
Ver [API_REFERENCE.md](../API_REFERENCE.md) para la documentación completa de todos los endpoints.

### Scripts Útiles
Ver [scripts/](../scripts/) para herramientas de administración:
- `set-claims.js` - Asignar permisos a usuarios
- `init-user.js` - Inicializar nuevo usuario
- `deploy-firestore-indexes.js` - Deploy de índices

### Casos de Uso Específicos
Ver [gastos/](../gastos/) para ejemplos de integración específica (ControlGastos).

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     CONTROLFILE SYSTEM                       │
└─────────────────────────────────────────────────────────────┘

Frontend (Next.js 14)          Backend (Node.js/Express)
──────────────────────         ─────────────────────────
   App Router                    RESTful API
   React Query                   Firebase Admin SDK
   Zustand Store                 B2 SDK
   TailwindCSS                   Express Middleware
        │                              │
        └──────────┬───────────────────┘
                   ↓
         ┌─────────────────────┐
         │   Firebase Auth     │  ← Auth Central (SSO)
         │  (Auth Central)     │
         └─────────────────────┘
                   │
         ┌─────────┴─────────┐
         ↓                   ↓
   ┌──────────┐      ┌─────────────┐
   │ Firestore│      │ Backblaze B2│
   │  (Data)  │      │  (Storage)  │
   └──────────┘      └─────────────┘
```

---

## 🎯 Recursos por Rol

### 👨‍💻 Desarrollador Frontend
- [Integración Rápida](./integracion/README_INTEGRACION_RAPIDA.md)
- [Share Links](./integracion/GUIA_CONSUMIR_SHARE_LINKS.md)
- [Features](./features/)
- [API Reference](../API_REFERENCE.md)

### 👨‍💻 Desarrollador Backend
- [Guía Backend](./integracion/GUIA_BACKEND.md)
- [API Integration](./technical/API_INTEGRATION.md)
- [Technical Docs](./technical/)

### 📱 Desarrollador Móvil
- [Mobile Setup](./mobile/MOBILE_SETUP.md)
- [Build APK](./mobile/BUILD_APK_GUIDE.md)
- [Debug Guide](./mobile/DEBUG_MOBILE_BUILD.md)

### 🔧 DevOps / Admins
- [Deployment](./deployment/DEPLOYMENT.md)
- [Domain Management](./deployment/DOMAIN_MANAGEMENT.md)
- [Checklist Admin](./integracion/CHECKLIST_ADMIN_INTEGRACION.md)

### 🏗️ Arquitecto / Tech Lead
- [Technical](./technical/)
- [Integration Guide](./integracion/GUIA_INTEGRACION_APPS_EXTERNAS.md)
- [Auth](./auth/)

---

## 📊 Estado del Proyecto

| Componente | Estado | Versión |
|------------|--------|---------|
| Frontend (Next.js) | ✅ Producción | 14.x |
| Backend (Node.js) | ✅ Producción | 18.x |
| Mobile (Android) | ✅ Producción | Capacitor 6 |
| iOS | 🚧 En desarrollo | - |
| API | ✅ Estable | v1 |
| Documentación | ✅ Completa | - |

---

## 🆘 Soporte

### Problemas Comunes
- **Build errors:** Ver [BUILD_FIXES.md](./technical/BUILD_FIXES.md)
- **CORS issues:** Ver [CORS_SOLUTION.md](./deployment/CORS_SOLUTION.md)
- **Auth problems:** Ver [Auth](./auth/)
- **Mobile build:** Ver [DEBUG_MOBILE_BUILD.md](./mobile/DEBUG_MOBILE_BUILD.md)

### Contacto
- **Issues:** GitHub Issues
- **Docs:** Este repositorio
- **Scripts:** `/scripts` folder

---

**Última actualización:** Octubre 2025

**Volver a:** [🏠 README Principal](../README.md)

