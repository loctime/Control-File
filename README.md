# ControlFile - Sistema de Almacenamiento en la Nube

Una aplicación de almacenamiento en la nube estilo Windows/OneDrive con Next.js 14, Firebase, Backblaze B2 y arquitectura multi-tenant.

## 🚀 Características Principales

- **Interfaz estilo Windows**: Navegación breadcrumb, vista lista/cuadrícula, panel de detalles
- **Sistema de Taskbar**: Barra de acceso rápido con carpetas favoritas
- **Multi-tenant**: Un sistema, múltiples apps (ControlFile, ControlAudit, ControlDoc)
- **Autenticación Central**: Firebase Auth con SSO entre aplicaciones
- **Almacenamiento**: Backblaze B2 con presigned URLs (75% más barato que S3)
- **Share Links**: Enlaces públicos con expiración y control de acceso
- **Sistema de cuotas**: Control de almacenamiento por usuario y plan
- **Google Sheets Integration**: Gestión de productos con Google Sheets para tiendas
- **Web**: Interfaz web responsive y moderna

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js 14 (App Router), TypeScript, TailwindCSS |
| **Estado** | Zustand, TanStack Query |
| **Autenticación** | Firebase Auth (Central) |
| **Base de datos** | Firestore |
| **Storage** | Backblaze B2 (S3-compatible) |
| **Web** | Responsive Design |
| **Deploy** | Vercel (Frontend), Render (Backend) |

## 📚 Documentación

### 🎯 Guías por Audiencia

| Si eres... | Lee esto |
|------------|----------|
| 👨‍💻 **Desarrollador integrando ControlFile** | [📖 Documentación Simple](./docs/README_SIMPLE.md) ⭐ **RECOMENDADO** |
| 🔗 **Desarrollador consumiendo share links** | [📖 Guía Share Links](./docs/integracion/GUIA_CONSUMIR_SHARE_LINKS.md) |
| 🚀 **DevOps/Admin desplegando** | [📖 Deployment](./docs/deployment/) |
| 🏗️ **Arquitecto/Tech Lead** | [📖 Documentación Técnica](./docs/technical/) |

### 📂 Documentación Completa

Ver **[docs/](./docs/)** para la documentación organizada por categorías:

- **[Integración](./docs/integracion/)** - Integrar ControlFile con apps externas
- **[Deployment](./docs/deployment/)** - Guías de deployment y configuración
- **[Features](./docs/features/)** - Documentación de características
- **[Technical](./docs/technical/)** - Notas técnicas y arquitectura
- **[Auth](./docs/auth/)** - Autenticación y OAuth

### 🔗 Referencias Rápidas

- **[API Reference](./API_REFERENCE.md)** - Documentación completa de endpoints
- **[Scripts](./scripts/)** - Herramientas de administración

## 🚀 Inicio Rápido

### Para Desarrollo Local

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-usuario/controlfile.git
cd controlfile

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp env.example .env.local
# Editar .env.local con tus credenciales

# 4. Ejecutar en desarrollo
npm run dev
```

Ver [documentación de deployment](./docs/deployment/) para configuración completa.

### Para Integración con Tu App

```bash
# 1. Instalar Firebase en tu proyecto
npm install firebase

# 2. Copiar el SDK de ControlFile
# Ver docs/integracion/README_INTEGRACION_RAPIDA.md

# 3. Configurar y usar
import { controlFile } from '@/lib/controlfile-sdk';
await controlFile.upload(file);
```

Ver [guía de integración rápida](./docs/integracion/README_INTEGRACION_RAPIDA.md) para código completo.

## 📋 Prerrequisitos

- **Node.js** 18+
- **Firebase** (proyecto Auth Central + proyecto Data)
- **Backblaze B2** (bucket configurado)
- **Android Studio** (solo para mobile)

## 🏗️ Arquitectura

```
┌──────────────────────────────────────────────────────┐
│                   APLICACIONES                        │
│  ControlFile  │  ControlAudit  │  ControlDoc  │ ...  │
└────────────────────┬─────────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────┐
        │   Firebase Auth        │  ← Auth Central (SSO)
        │   (Single Sign-On)     │
        └────────────┬───────────┘
                     │
          ┬──────────┴──────────┬
          ↓                     ↓
    ┌──────────┐         ┌─────────────┐
    │ Firestore│         │ Backblaze B2│
    │  (Data)  │         │  (Storage)  │
    └──────────┘         └─────────────┘
```

**Características:**
- ✅ **Single Sign-On:** Un login para todas las apps
- ✅ **Multi-tenant:** Control de acceso por app con custom claims
- ✅ **Escalable:** Arquitectura desacoplada
- ✅ **Económico:** B2 cuesta 1/4 que S3

## 🔐 Seguridad

- **Autenticación:** Firebase Auth con JWT tokens
- **Autorización:** Custom claims + Firestore rules
- **Storage:** Presigned URLs con expiración (5 min)
- **CORS:** Configurado por dominio
- **Share Links:** Tokens aleatorios + expiración configurable

## 📊 Planes y Cuotas

| Plan | Storage | Precio |
|------|---------|--------|
| Free | 5 GB | Gratis |
| Basic | 50 GB | $5/mes |
| Pro | 500 GB | $25/mes |
| Enterprise | Ilimitado | Custom |

Ver [lib/plans.ts](./lib/plans.ts) para configuración.

## 🔧 Scripts Útiles

```bash
# Asignar permisos a usuario
npm run set-claims -- --email user@example.com --apps controlfile,controlaudit

# Inicializar nuevo usuario
npm run init-user -- --email user@example.com

# Reconciliar cuotas
npm run reconcile

# Deploy índices de Firestore
npm run deploy-indexes

# Build APK (Android)
npm run build:android
```

Ver [scripts/](./scripts/) para más herramientas.

## 📱 Mobile

Aplicación nativa para Android/iOS usando Capacitor:

```bash
# Setup inicial
npm run mobile:setup

# Build APK
npm run build:android

# Build iOS
npm run build:ios
```

Ver [documentación móvil](./docs/mobile/) para guía completa.

## 🚀 Deploy en Producción

### Frontend (Vercel)
```bash
vercel --prod
```

### Backend (Render)
```bash
# Configurar en render.yaml
git push origin main
```

Ver [guía de deployment](./docs/deployment/DEPLOYMENT.md) para instrucciones completas.

## 📁 Estructura del Proyecto

```
controlFile/
├── app/                     # Next.js App Router
│   ├── api/                # API Routes (proxy al backend)
│   ├── auth/               # Autenticación
│   └── share/              # Archivos compartidos
├── components/             # Componentes React
│   ├── drive/             # Explorador de archivos
│   ├── ui/                # Componentes shadcn/ui
│   └── common/            # Componentes compartidos
├── hooks/                  # Custom React hooks
├── lib/                    # Librerías y utilidades
│   ├── stores/            # Zustand stores
│   ├── firebase.ts        # Config Firebase
│   └── b2.ts              # Cliente B2
├── backend/                # Backend Node.js/Express
│   └── src/
│       ├── routes/        # Rutas de API
│       └── services/      # Servicios (B2, metadata)
├── docs/                   # 📚 Documentación organizada
│   ├── integracion/       # Guías de integración
│   ├── mobile/            # Docs móvil
│   ├── deployment/        # Deployment
│   ├── features/          # Features
│   ├── technical/         # Docs técnica
│   └── auth/              # Autenticación
├── scripts/                # Scripts de administración
├── android/                # Proyecto Android (Capacitor)
└── gastos/                 # Ejemplo: integración ControlGastos
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## 🆘 Soporte y Troubleshooting

| Problema | Solución |
|----------|----------|
| Build errors | Ver [BUILD_FIXES.md](./docs/technical/BUILD_FIXES.md) |
| CORS issues | Ver [CORS_SOLUTION.md](./docs/deployment/CORS_SOLUTION.md) |
| Auth problems | Ver [docs/auth/](./docs/auth/) |
| Mobile build | Ver [DEBUG_MOBILE_BUILD.md](./docs/mobile/DEBUG_MOBILE_BUILD.md) |

## 🙏 Agradecimientos

- [Next.js](https://nextjs.org/) - React Framework
- [Firebase](https://firebase.google.com/) - Auth + Database
- [Backblaze B2](https://www.backblaze.com/b2/) - Affordable Storage
- [shadcn/ui](https://ui.shadcn.com/) - UI Components
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

**📚 [Ver Documentación Completa](./docs/)** | **🔗 [API Reference](./API_REFERENCE.md)** | **🚀 [Deployment Guide](./docs/deployment/)**

Hecho con ❤️ para la comunidad de desarrolladores
