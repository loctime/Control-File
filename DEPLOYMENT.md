# 🚀 Guía de Deploy - Vercel + Render

## 📋 Checklist Pre-Deploy

### ✅ Frontend (Vercel)
- [x] `vercel.json` configurado
- [x] `package.json` con scripts correctos
- [x] `next.config.js` optimizado
- [x] Variables de entorno documentadas

### ✅ Backend (Render)
- [x] `render.yaml` configurado
- [x] `backend/package.json` con scripts correctos
- [x] Variables de entorno documentadas
- [x] Configuración de CORS

## 🔧 Deploy en Vercel (Frontend)

### 1. Conectar repositorio
```bash
# Instalar Vercel CLI
npm i -g vercel

# Login y deploy
vercel login
vercel
```

### 2. Configurar variables de entorno en Vercel Dashboard

**Variables requeridas:**
```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com

# Backblaze B2
B2_KEY_ID=your_b2_key_id
B2_APPLICATION_KEY=your_b2_application_key
B2_BUCKET_ID=your_b2_bucket_id
B2_BUCKET_NAME=your_b2_bucket_name
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com

# Cloudflare Worker (opcional)
NEXT_PUBLIC_CLOUDFLARE_WORKER_URL=https://your-worker.your-subdomain.workers.dev

# App URLs (actualizar después del deploy)
NEXT_PUBLIC_APP_URL=https://tu-app.vercel.app
NEXT_PUBLIC_BACKEND_URL=https://tu-backend.onrender.com
```

### 3. Deploy automático
- Conectar GitHub a Vercel
- Configurar auto-deploy en push a `main`

## 🔧 Deploy en Render (Backend)

### 1. Conectar repositorio
1. Ir a [Render Dashboard](https://dashboard.render.com/)
2. Crear nuevo "Web Service"
3. Conectar repositorio de GitHub

### 2. Configurar servicio
- **Name**: `controlfile-backend`
- **Environment**: `Node`
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`

### 3. Configurar variables de entorno

**Variables requeridas:**
```env
# Firebase Admin
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTu_private_key_aqui\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PROJECT_ID=tu-proyecto-id

# Backblaze B2
B2_KEY_ID=tu_b2_key_id
B2_APPLICATION_KEY=tu_b2_application_key
B2_BUCKET_NAME=tu_bucket_name
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com

# Server
PORT=10000
NODE_ENV=production

# CORS (actualizar después del deploy del frontend)
FRONTEND_URL=https://tu-app.vercel.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔄 Orden de Deploy

### 1. Deploy Backend primero
1. Deploy en Render
2. Obtener URL del backend (ej: `https://controlfile-backend.onrender.com`)

### 2. Actualizar Frontend
1. Actualizar `NEXT_PUBLIC_BACKEND_URL` en Vercel
2. Deploy frontend en Vercel
3. Obtener URL del frontend (ej: `https://controlfile.vercel.app`)

### 3. Actualizar Backend
1. Actualizar `FRONTEND_URL` en Render con la URL del frontend
2. Redeploy backend

## 🧪 Testing Post-Deploy

### Verificar Frontend
```bash
# Verificar build
npm run build

# Verificar linting
npm run lint

# Verificar que las variables de entorno estén disponibles
curl https://tu-app.vercel.app/api/health
```

### Verificar Backend
```bash
# Verificar que el backend responda
curl https://tu-backend.onrender.com/health

# Verificar CORS
curl -H "Origin: https://tu-app.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS https://tu-backend.onrender.com/
```

## 🚨 Troubleshooting

### Problemas comunes:

1. **CORS errors**
   - Verificar que `FRONTEND_URL` esté configurado correctamente
   - Verificar que el backend esté configurado para aceptar la URL del frontend

2. **Build failures**
   - Verificar que todas las variables de entorno estén configuradas
   - Verificar que las dependencias estén en `package.json`

3. **Runtime errors**
   - Verificar logs en Vercel/Render
   - Verificar que las credenciales de Firebase y B2 sean correctas

### Logs útiles:
```bash
# Vercel logs
vercel logs

# Render logs (desde dashboard)
# Ir a tu servicio > Logs
```

## 📊 Monitoreo

### Vercel Analytics
- Habilitar Vercel Analytics para monitoreo de performance
- Configurar alertas para errores

### Render Monitoring
- Configurar health checks
- Monitorear uso de recursos

## 🔐 Seguridad

### Variables sensibles
- ✅ Nunca commitear `.env` files
- ✅ Usar variables de entorno en Vercel/Render
- ✅ Rotar credenciales regularmente

### CORS
- ✅ Configurar solo dominios permitidos
- ✅ No usar `*` en producción

### Rate Limiting
- ✅ Configurado en backend
- ✅ Monitorear uso de API

---

**¡Listo para deploy! 🎉**
