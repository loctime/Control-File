# ⚡ Quick Start - Cloudflare Worker

## 🎯 Objetivo

Configurar el Worker de Cloudflare en **menos de 5 minutos** para minimizar el consumo de Render Free.

## 📋 Pre-requisitos

- ✅ Node.js instalado
- ✅ Cuenta de Cloudflare (gratis)
- ✅ Tu Firebase Project ID
- ✅ Tu nombre de bucket de B2

## 🚀 Pasos (5 minutos)

### 1️⃣ Instalar Wrangler (1 min)

```bash
npm install -g wrangler
```

### 2️⃣ Autenticarse (30 seg)

```bash
wrangler login
```

Se abrirá tu navegador → Autorizar

### 3️⃣ Configurar Variables (2 min)

Edita `cloudflare/wrangler.toml`:

```toml
[vars]
FIREBASE_PROJECT_ID = "controlstorage-eb796"  # ← Tu Project ID
B2_BUCKET_NAME = "tu-bucket-name"            # ← Tu bucket de B2
B2_ENDPOINT = "s3.us-west-004.backblazeb2.com"
```

### 4️⃣ Configurar Firestore Rules (30 seg)

```bash
firebase deploy --only firestore:rules
```

Esto ya está en `firestore.rules`, solo desplegas.

### 5️⃣ Desplegar (1 min)

**Opción A - Script automatizado (Windows):**
```powershell
cd cloudflare
.\deploy.ps1
```

**Opción B - Script automatizado (Linux/Mac):**
```bash
cd cloudflare
chmod +x deploy.sh
./deploy.sh
```

**Opción C - Manual:**
```bash
cd cloudflare
wrangler deploy --env production
```

## ✅ ¡Listo!

Tu Worker está en:
```
https://controlfile-shares-prod.tu-usuario.workers.dev
```

## 📝 Uso

### Desde cualquier dominio:

```html
<!-- Reemplaza TU_WORKER_URL con tu URL del Worker -->
<img src="https://TU_WORKER_URL/image/SHARE_TOKEN" />
```

### Ejemplo real:

```html
<img src="https://controlfile-shares-prod.usuario.workers.dev/image/abc123xyz" />
```

## 🧪 Probar

```bash
# Health check
curl https://tu-worker.workers.dev/health

# Debería responder: "ControlFile Shares Worker - Running ✅"
```

## 📊 Resultado

### Antes:
- 🔴 Cada imagen = 1 request a Render Free
- 🔴 Límite de requests muy bajo
- 🔴 Render puede dormirse

### Después:
- ✅ Cada imagen = 0 requests a Render
- ✅ 100,000 requests/día gratis en Cloudflare
- ✅ Caché de 1 hora automático
- ✅ Más rápido (edge computing)

## 🔧 Mantenimiento

### Ver logs:
```bash
wrangler tail --env production
```

### Actualizar configuración:
```bash
# Editar wrangler.toml
nano cloudflare/wrangler.toml

# Re-desplegar
cd cloudflare
wrangler deploy --env production
```

## ❓ Problemas

### "Share not found"
→ Verifica que las reglas de Firestore estén desplegadas

### "B2_BUCKET_NAME no configurado"
→ Edita `wrangler.toml` y configura tu bucket

### "No estás autenticado"
→ Ejecuta `wrangler login`

## 📚 Más información

Ver `cloudflare/README.md` para documentación completa.

## 💡 Tips

### 1. Dominio personalizado (opcional)

En Cloudflare Dashboard → Workers → Settings → Triggers → Add Custom Domain
```
shares.tudominio.com
```

### 2. Ver estadísticas

Cloudflare Dashboard → Workers → tu worker → Metrics

### 3. Múltiples entornos

```bash
# Desarrollo
wrangler deploy --env development

# Producción
wrangler deploy --env production
```

## 🎉 ¡Éxito!

Ahora tu Render Free solo se usa para:
- ✅ Subir archivos
- ✅ Gestionar carpetas
- ✅ Crear shares

**NO** para servir imágenes (ahora lo hace Cloudflare gratis).

