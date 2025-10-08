# 🚀 Documentación de Deployment y Configuración

Esta carpeta contiene toda la documentación relacionada con el deployment, configuración de dominios, CORS y servicios cloud.

## 📖 Guías Disponibles

| Documento | Descripción | Audiencia |
|-----------|-------------|-----------|
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Guía general de deployment del proyecto | DevOps |
| **[VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)** | Deployment específico en Vercel | DevOps |
| **[DOMAIN_MANAGEMENT.md](./DOMAIN_MANAGEMENT.md)** | Gestión de dominios y configuración DNS | DevOps/Admins |
| **[DOMAIN_SOLUTION_SUMMARY.md](./DOMAIN_SOLUTION_SUMMARY.md)** | Resumen de soluciones de problemas de dominio | DevOps |
| **[FIREBASE_DOMAIN_SETUP.md](./FIREBASE_DOMAIN_SETUP.md)** | Configuración de dominios en Firebase Auth | DevOps |
| **[CORS_SOLUTION.md](./CORS_SOLUTION.md)** | Solución de problemas CORS | Desarrolladores |
| **[CORS_DEPLOYMENT_STEPS.md](./CORS_DEPLOYMENT_STEPS.md)** | Pasos para configurar CORS en deployment | DevOps |

## 🚀 Inicio Rápido

### Para hacer deploy por primera vez:
1. Lee **DEPLOYMENT.md** - Guía general
2. Si usas Vercel: **VERCEL_DEPLOYMENT.md**
3. Configura dominios: **DOMAIN_MANAGEMENT.md**
4. Configura CORS: **CORS_SOLUTION.md**

### Para resolver problemas:
- **Problemas de dominio:** Ver **DOMAIN_SOLUTION_SUMMARY.md**
- **Errores CORS:** Ver **CORS_SOLUTION.md** y **CORS_DEPLOYMENT_STEPS.md**
- **Firebase Auth domains:** Ver **FIREBASE_DOMAIN_SETUP.md**

## 🏗️ Arquitectura de Deployment

```
Frontend (Next.js)          Backend (Node.js/Express)       Storage
─────────────────          ──────────────────────────      ───────
Vercel/Cloudflare    ───→  Render/Railway/Fly.io    ───→  Backblaze B2
files.controldoc.app       backend.controldoc.app          (Archivos)
                                    │
                                    ↓
                              Firebase Auth Central
                              (Autenticación)
                                    │
                                    ↓
                              Firestore Data
                              (Metadatos)
```

## 🌐 Dominios Configurados

| Servicio | Dominio | Propósito |
|----------|---------|-----------|
| Frontend | files.controldoc.app | Aplicación web principal |
| Backend | backend.controldoc.app | API REST |
| Auth | controlstorage-eb796.firebaseapp.com | Autenticación OAuth |
| Storage | s3.us-west-002.backblazeb2.com | Almacenamiento de archivos |

## 🔒 Variables de Entorno Requeridas

### Frontend (Next.js)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_BACKEND_URL=https://backend.controldoc.app
```

### Backend (Node.js)
```env
FB_ADMIN_IDENTITY=...       # Service account Auth Central
FB_ADMIN_APPDATA=...        # Service account Data Project
FB_DATA_PROJECT_ID=...      # Project ID de datos
ALLOWED_ORIGINS=...         # Dominios permitidos CORS
B2_KEY_ID=...              # Backblaze B2 credentials
B2_APPLICATION_KEY=...
```

## 📝 Checklist de Deployment

- [ ] Variables de entorno configuradas
- [ ] Dominios DNS apuntando correctamente
- [ ] Firebase Auth domains autorizados
- [ ] CORS configurado en backend
- [ ] Backblaze B2 bucket creado y configurado
- [ ] Firestore indexes deployados
- [ ] SSL/HTTPS habilitado en todos los dominios
- [ ] Health check endpoint funcionando

## 🔗 Enlaces Relacionados

- [Firebase Console](https://console.firebase.google.com/)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html)
- [API Reference](../../API_REFERENCE.md)

---

**Volver a:** [📚 Documentación Principal](../README.md) | [🏠 Proyecto](../../README.md)

