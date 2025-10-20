# 🧱 ControlFile

**Tu Solución de Almacenamiento en la Nube Profesional**

---

## 🎯 Descripción general

**ControlFile** es una plataforma de almacenamiento en la nube tipo Windows/OneDrive, diseñada para equipos y empresas que buscan una solución económica, escalable y con control total de sus datos. Con una interfaz familiar y moderna, integra Firebase Auth para autenticación robusta y Backblaze B2 para almacenamiento de alta capacidad a precios accesibles (75% más barato que AWS S3).

---

## ⚙️ Principales funcionalidades

### 🖥️ **Interfaz Moderna y Familiar**
- Navegación estilo Windows con breadcrumbs, vista lista/cuadrícula y panel de detalles
- Sistema de Taskbar con acceso rápido a carpetas favoritas
- Drag & drop, selección múltiple y menús contextuales

### 🔒 **Seguridad y Control**
- Autenticación centralizada con Firebase Auth (SSO)
- Sistema de cuotas por usuario y plan
- Enlaces compartidos con control de expiración y acceso
- Presigned URLs con expiración de seguridad (5 min)

### 🏢 **Multi-tenant y Escalable**
- Arquitectura multi-app: un sistema para múltiples aplicaciones (ControlFile, ControlAudit, ControlDoc)
- Single Sign-On: un login para todas tus apps
- Custom claims para control granular de permisos

### 📱 **Aplicación Móvil Nativa**
- App para Android/iOS con Capacitor
- Sincronización en tiempo real
- Indicador de estado de conexión y modo offline

### 🔗 **Share Links Públicos**
- Comparte archivos sin requerir autenticación
- Control de expiración y límites de descarga
- URLs limpias y personalizables

---

## 🧩 Stack tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Frontend** | Next.js (App Router) | 14.2.5 |
| **Lenguaje** | TypeScript | 5.x |
| **UI/UX** | TailwindCSS + shadcn/ui | Latest |
| **Estado** | Zustand + TanStack Query | 4.5 / 5.45 |
| **Autenticación** | Firebase Auth (Central) | 10.12+ |
| **Base de datos** | Cloud Firestore | Latest |
| **Storage** | Backblaze B2 (S3-compatible) | - |
| **Backend** | Node.js + Express | 18+ |
| **Mobile** | Capacitor | 7.4+ |
| **Deploy** | Vercel (Frontend) + Render (Backend) | - |
| **Pagos** | Stripe | 18.5+ |

**Ventaja competitiva:** Backblaze B2 ofrece el mismo rendimiento que AWS S3 a 1/4 del precio.

---

## 🧑‍💻 Estructura del proyecto

```
controlFile/
├── app/                     # 🖥️ Next.js App Router
│   ├── api/                # API Routes (proxy al backend)
│   ├── auth/               # Páginas de autenticación
│   ├── profile/            # Perfil de usuario
│   ├── settings/           # Configuración
│   └── share/              # Archivos compartidos públicos
│
├── components/             # ⚛️ Componentes React
│   ├── drive/             # Explorador de archivos (28 componentes)
│   │   ├── FileExplorer   # Vista principal del explorador
│   │   ├── Taskbar        # Barra de acceso rápido
│   │   └── ContextMenu    # Menú contextual
│   ├── ui/                # shadcn/ui (22 componentes)
│   └── common/            # Componentes compartidos (Theme, Offline, etc.)
│
├── hooks/                  # 🪝 Custom React Hooks
│   ├── useAuth.ts         # Autenticación
│   ├── useFiles.ts        # Gestión de archivos
│   ├── useUpload.ts       # Carga de archivos con progreso
│   └── useTaskbar.ts      # Sistema de taskbar
│
├── lib/                    # 📚 Librerías y utilidades
│   ├── firebase.ts        # Configuración Firebase Client
│   ├── firebase-admin.ts  # Firebase Admin SDK
│   ├── b2.ts              # Cliente Backblaze B2
│   ├── controlfile-sdk.ts # SDK para integraciones externas
│   ├── plans.ts           # Sistema de planes y cuotas
│   ├── stores/            # Zustand state management
│   └── schemas/           # Validaciones con Zod
│
├── backend/                # 🔧 Backend Node.js/Express
│   └── src/
│       ├── routes/        # 8 rutas de API (files, folders, shares, etc.)
│       ├── services/      # 5 servicios (B2, metadata, etc.)
│       └── middleware/    # Auth middleware
│
├── docs/                   # 📚 Documentación completa
│   ├── integracion/       # Guías de integración con apps externas
│   ├── mobile/            # Build y deployment móvil
│   ├── deployment/        # Deployment y configuración
│   ├── features/          # Documentación de características
│   ├── technical/         # Notas técnicas y fixes
│   └── auth/              # Autenticación y OAuth
│
├── scripts/                # 🔨 Scripts de administración
│   ├── set-claims.js      # Asignar permisos a usuarios
│   ├── init-user.js       # Inicializar nuevo usuario
│   ├── reconcile.js       # Reconciliar cuotas de storage
│   └── add-domain.js      # Agregar dominios permitidos
│
├── android/                # 📱 Proyecto Android (Capacitor)
│   └── app/               # Código nativo Android
│
└── config/                 # ⚙️ Configuración
    └── plans.json         # Planes de suscripción
```

**Arquitectura:** Frontend desacoplado del backend con API RESTful, autenticación centralizada y storage escalable.

---

## 🔐 Autenticación / Roles

### Sistema de Autenticación Central

**ControlFile** implementa un sistema de **Auth Central** con Firebase Auth que permite:

- **Single Sign-On (SSO):** Un solo login para múltiples aplicaciones
- **Custom Claims:** Control de acceso por aplicación mediante JWT tokens
- **Multi-tenant:** Usuarios pueden acceder a múltiples apps (ControlFile, ControlAudit, ControlDoc)

### Flujo de Autenticación

```
Usuario → Firebase Auth Central → JWT con Custom Claims → App Específica
```

### Roles y Permisos

| Claim | Descripción |
|-------|-------------|
| `apps` | Array de apps a las que tiene acceso (`["controlfile", "controlaudit"]`) |
| `roles` | Roles dentro de cada app (`admin`, `user`, `viewer`) |
| `plan` | Plan de suscripción (`FREE_5GB`, `STORAGE_50GB`, etc.) |
| `quotaBytes` | Cuota de almacenamiento asignada |

### Scripts de Administración

```bash
# Asignar acceso a un usuario
npm run set-claims -- --email user@example.com --apps controlfile,controlaudit

# Inicializar un nuevo usuario
npm run init-user -- --email user@example.com --plan STORAGE_50GB
```

**Documentación completa:** Ver `/docs/auth/`

---

## 🔗 Integraciones

### 🔥 Firebase Ecosystem

- **Firebase Auth:** Autenticación centralizada con soporte para Google, Email/Password
- **Cloud Firestore:** Base de datos NoSQL para metadata de archivos y carpetas
- **Firebase Admin SDK:** Operaciones administrativas del lado del servidor

### 💾 Backblaze B2 (S3-Compatible)

- **Storage principal:** Todos los archivos se almacenan en B2
- **Presigned URLs:** URLs temporales de 5 min para descarga segura
- **Costo:** 75% más económico que AWS S3
- **API:** Totalmente compatible con S3 SDK de AWS

### 💳 Stripe

- **Suscripciones:** Gestión de planes mensuales y anuales
- **Webhooks:** Sincronización automática de suscripciones
- **Portal del cliente:** Los usuarios pueden gestionar sus suscripciones

### 📱 Capacitor

- **Apps nativas:** Android e iOS desde una misma base de código
- **Plugins nativos:** Cámara, Filesystem, Network, Share, etc.
- **Sincronización:** Comunicación bidireccional entre web y native

### 🔗 API Externa (Integraciones)

**ControlFile SDK** permite a otras aplicaciones integrar almacenamiento:

```typescript
import { controlFile } from '@/lib/controlfile-sdk';

// Subir archivo
await controlFile.upload(file, {
  folderId: 'optional-folder-id',
  onProgress: (progress) => console.log(`${progress}%`)
});

// Crear carpeta
await controlFile.createFolder('Mi Carpeta', parentFolderId);

// Obtener archivos
const files = await controlFile.listFiles(folderId);
```

**Apps integradas:**
- ✅ **ControlAudit:** Auditorías y documentos de cumplimiento
- ✅ **ControlDoc:** Gestión documental empresarial
- 🚧 **ControlGastos:** Gestión de gastos con recibos digitales

**Documentación:** Ver `/docs/integracion/README_INTEGRACION_RAPIDA.md`

---

## 🧾 Planes / Modelo de uso

### 💰 Planes de Suscripción

| Plan | Storage | Precio Mensual | Precio Anual | Ahorro |
|------|---------|----------------|--------------|--------|
| **Gratis** | 5 GB | $0 | $0 | - |
| **50 GB** | 50 GB | $0.99 | $9.99 | 17% |
| **100 GB** | 100 GB | $1.99 | $19.49 | 18% |
| **250 GB** | 250 GB | $3.99 | $38.99 | 19% |
| **500 GB** | 500 GB | $6.99 | $67.90 | 19% |
| **1 TB** | 1 TB | $12.99 | $125.00 | 20% |

### 🎯 Modelo de Negocio

**ControlFile** puede operarse en tres modalidades:

1. **SaaS Público:** Ofrecer planes de almacenamiento a usuarios finales
2. **White-Label:** Licenciar la plataforma a otras empresas
3. **Interno:** Usar como sistema de almacenamiento corporativo

### 📊 Sistema de Cuotas

- **Control en tiempo real:** Tracking de uso por usuario
- **Límites automáticos:** Bloqueo al alcanzar el límite
- **Papelera inteligente:** Limpieza automática después de 30 días
- **Reconciliación:** Script para sincronizar cuotas con uso real

```bash
# Reconciliar cuotas de todos los usuarios
npm run reconcile
```

### 🔄 Ciclo de Facturación

- **Pago automático:** Stripe maneja la renovación mensual/anual
- **Webhooks:** Actualización instantánea de cuotas al renovar
- **Portal del cliente:** Los usuarios gestionan sus suscripciones

**Configuración:** Ver `config/plans.json`

---

## 🚀 Pendientes o mejoras planificadas

### En Desarrollo 🚧

- [ ] **App iOS:** Completar build y publicación en App Store
- [ ] **Sincronización Desktop:** Cliente de escritorio para Windows/Mac
- [ ] **Versionado de archivos:** Historial de cambios y restauración
- [ ] **Colaboración en tiempo real:** Edición simultánea de documentos
- [ ] **Vista previa de archivos:** PDF, imágenes, videos in-app

### Próximas Características 📋

- [ ] **Búsqueda avanzada:** Búsqueda por contenido, metadatos y OCR
- [ ] **Integración con Office 365:** Editar documentos directamente
- [ ] **API Pública v2:** RESTful API con rate limiting y webhooks
- [ ] **Audit logs:** Registro completo de acciones de usuarios
- [ ] **Cifrado end-to-end:** Opción de cifrado en el cliente

### Optimizaciones 🔧

- [ ] **Lazy loading de thumbnails:** Carga progresiva de miniaturas
- [ ] **Compresión de imágenes:** Reducir tamaño automáticamente
- [ ] **CDN para assets estáticos:** Mejorar velocidad de carga
- [ ] **Caché inteligente:** Reducir llamadas a Firebase/B2
- [ ] **Paginación infinita:** Mejor UX en carpetas grandes

### Integraciones Planificadas 🔗

- [ ] **Google Drive Sync:** Sincronización bidireccional
- [ ] **Dropbox Integration:** Migración de archivos
- [ ] **Slack/Teams:** Notificaciones de actividad
- [ ] **Zapier/Make:** Automatizaciones sin código
- [ ] **Webhooks:** Notificaciones en tiempo real de eventos

### DevOps y Monitoreo 📊

- [ ] **Monitoring con Sentry:** Tracking de errores en producción
- [ ] **Analytics avanzado:** Uso de la app y comportamiento de usuarios
- [ ] **CI/CD mejorado:** Tests automatizados y deployment progresivo
- [ ] **Backups automáticos:** Respaldo diario de Firestore
- [ ] **Disaster recovery plan:** Plan de recuperación ante desastres

---

## 📞 Contacto y Recursos

### 📚 Documentación

- **[Documentación Completa](./docs/)** - Guías organizadas por categoría
- **[API Reference](./API_REFERENCE.md)** - Documentación de endpoints
- **[Integración Rápida](./docs/integracion/README_INTEGRACION_RAPIDA.md)** - Empezar en 5 minutos

### 🛠️ Para Desarrolladores

- **GitHub:** [github.com/tu-usuario/controlfile](https://github.com)
- **Issues:** Reporta bugs o solicita features
- **Pull Requests:** Contribuye al proyecto

### 🚀 Deploy y Soporte

- **Frontend:** Vercel
- **Backend:** Render
- **Guía de deployment:** Ver `/docs/deployment/DEPLOYMENT.md`

---

## 🏆 Por qué elegir ControlFile

✅ **Económico:** 75% más barato que soluciones tradicionales  
✅ **Escalable:** Arquitectura probada que crece con tu negocio  
✅ **Seguro:** Firebase Auth + presigned URLs + Firestore rules  
✅ **Moderno:** Next.js 14, TypeScript, React Query, TailwindCSS  
✅ **Mobile-ready:** Apps nativas para Android e iOS  
✅ **Multi-tenant:** Un sistema, múltiples aplicaciones  
✅ **Open-source ready:** Código documentado y extensible  

---

## 📄 Licencia

Este proyecto está bajo la **Licencia MIT** - Ver el archivo LICENSE para detalles.

---

<div align="center">

**🌟 ControlFile - Almacenamiento en la nube hecho simple 🌟**

[Documentación](./docs/) • [API Reference](./API_REFERENCE.md) • [Demo](https://demo.controlfile.com)

</div>



