# 🚀 Cloudflare Worker para ControlFile Shares

## 📋 Descripción

Este Worker de Cloudflare maneja las imágenes compartidas de forma optimizada, **minimizando el consumo del backend en Render Free** al servir archivos directamente desde Backblaze B2 sin pasar por el backend.

### ✅ Beneficios

- **💰 Render Free casi sin uso**: El backend solo se usa para subir/gestionar archivos
- **⚡ Más rápido**: Edge computing de Cloudflare
- **🌍 Multi-dominio**: Funciona desde cualquier dominio sin configuración adicional
- **📦 Caché automático**: 1 hora de caché = menos consultas a Firestore
- **🆓 Gratis**: Hasta 100,000 requests/día en el plan Free de Cloudflare

## 🏗️ Arquitectura

```
Usuario → Cloudflare Worker → Firestore (directo) → Redirect a B2
                ↓
         (Opcional) Backend en Render (solo para contador)
```

### Antes (sin Worker):
```
Usuario → Next.js → Backend Render → Firestore → Redirect a B2
💰 Cada imagen = 1 request a Render Free (LIMITADO)
```

### Después (con Worker):
```
Usuario → Cloudflare Worker → Firestore → Redirect a B2
💰 Render = 0 requests para servir imágenes
💰 Cloudflare = 100,000 requests/día gratis
```

## 📦 Prerequisitos

1. **Cuenta de Cloudflare** (gratuita)
2. **Firebase Project ID** (ya lo tienes)
3. **Backblaze B2** configurado (ya lo tienes)
4. **Node.js y npm** instalados

## 🚀 Instalación y Configuración

### Paso 1: Instalar Wrangler CLI

```bash
npm install -g wrangler
```

### Paso 2: Autenticarse en Cloudflare

```bash
wrangler login
```

Se abrirá tu navegador para autorizar el acceso.

### Paso 3: Configurar Variables de Entorno

Edita el archivo `cloudflare/wrangler.toml` y actualiza estas variables:

```toml
[vars]
FIREBASE_PROJECT_ID = "tu-firebase-project-id"  # Reemplazar con tu Project ID
B2_BUCKET_NAME = "tu-bucket-name"               # Reemplazar con tu bucket de B2
B2_ENDPOINT = "s3.us-west-004.backblazeb2.com"  # Tu región de B2
```

### Paso 4: (Opcional) Configurar Backend URL

Si quieres que el Worker incremente el contador de descargas:

```bash
cd cloudflare
wrangler secret put BACKEND_URL
# Cuando pregunte, ingresa: https://tu-backend.onrender.com
```

Si no configuras esto, el Worker funcionará igual pero no incrementará el contador.

### Paso 5: Configurar Firestore Rules

El Worker necesita leer shares y files de Firestore sin autenticación. Esto ya está configurado en `firestore.rules`, pero debes desplegarlo:

```bash
firebase deploy --only firestore:rules
```

O desde Firebase Console → Firestore Database → Rules → Publicar

**Nota de Seguridad**: Esto es seguro porque:
- Solo se pueden leer shares con el token exacto
- Los archivos solo se leen si ya tienes un share válido
- Los archivos en B2 siguen protegidos

### Paso 6: Desplegar el Worker

```bash
cd cloudflare
wrangler deploy --env production
```

**Resultado**: Obtendrás una URL como:
```
https://controlfile-shares-prod.tu-usuario.workers.dev
```

### Paso 7: (Opcional) Configurar Dominio Personalizado

En Cloudflare Dashboard:
1. Ve a Workers & Pages → tu worker
2. Settings → Triggers → Add Custom Domain
3. Agrega: `shares.tudominio.com`

## 🎯 Uso

### Desde cualquier aplicación:

```html
<!-- Formato: https://tu-worker.workers.dev/image/SHARE_TOKEN -->

<!-- HTML -->
<img src="https://controlfile-shares-prod.tu-usuario.workers.dev/image/abc123xyz" />

<!-- React/Next.js -->
<img src={`https://controlfile-shares-prod.tu-usuario.workers.dev/image/${token}`} />

<!-- Markdown -->
![Imagen](https://controlfile-shares-prod.tu-usuario.workers.dev/image/token)
```

### Con dominio personalizado:

```html
<img src="https://shares.tudominio.com/image/abc123xyz" />
```

## 🔍 Verificación

### 1. Probar el Worker:

```bash
# Health check
curl https://tu-worker.workers.dev/health

# Debería responder: "ControlFile Shares Worker - Running ✅"
```

### 2. Probar con un share real:

```bash
# Primero crea un share desde tu app
# Luego prueba:
curl -I https://tu-worker.workers.dev/image/TU_SHARE_TOKEN

# Debería responder con HTTP 302 y Location header a B2
```

### 3. Ver logs en tiempo real:

```bash
cd cloudflare
wrangler tail --env production
```

## 📊 Monitoreo

### Ver estadísticas en Cloudflare Dashboard:

1. Ve a Workers & Pages
2. Selecciona tu worker
3. Pestaña "Metrics":
   - Requests por día
   - Duración promedio
   - Cache hit rate
   - Errores

### Ver logs:

```bash
# Logs en tiempo real
wrangler tail --env production

# Logs con filtros
wrangler tail --env production --format pretty
```

## 🐛 Troubleshooting

### Error: "Share not found"

**Causa**: El share no existe en Firestore o las reglas no permiten lectura pública.

**Solución**:
1. Verifica que el token sea correcto
2. Verifica que las reglas de Firestore estén desplegadas: `firebase deploy --only firestore:rules`
3. Verifica en Firebase Console que el share existe

### Error: "File not found"

**Causa**: El archivo no existe o fue eliminado.

**Solución**:
1. Verifica que el archivo exista en Firestore
2. Verifica que `isDeleted` sea `false`

### Error: El Worker no responde

**Causa**: Problema de configuración o despliegue.

**Solución**:
```bash
# Ver estado del worker
wrangler deployments list

# Ver logs
wrangler tail --env production

# Re-desplegar
wrangler deploy --env production
```

### Cache no funciona correctamente

**Solución**:
```bash
# Limpiar caché del Worker
# En Cloudflare Dashboard:
# Workers & Pages → tu worker → Settings → Cache → Purge Cache
```

## 🔧 Mantenimiento

### Actualizar configuración:

```bash
# Editar wrangler.toml con nuevos valores
nano wrangler.toml

# Re-desplegar
wrangler deploy --env production
```

### Actualizar código del Worker:

```bash
# Editar worker.js
nano worker.js

# Re-desplegar
wrangler deploy --env production
```

### Configurar diferentes entornos:

```bash
# Desarrollo
wrangler deploy --env development

# Staging
wrangler deploy --env staging

# Producción
wrangler deploy --env production
```

## 📈 Optimizaciones Avanzadas

### 1. Usar dominio personalizado

Más profesional y fácil de recordar:
```
shares.controldoc.app en lugar de controlfile-shares-prod.usuario.workers.dev
```

### 2. Configurar B2 público

Si tu bucket de B2 es público, configura en `wrangler.toml`:
```toml
B2_PUBLIC_URL = "https://f004.backblazeb2.com/file/tu-bucket"
```

Esto elimina la necesidad de firmar URLs.

### 3. Usar KV para cache persistente

Para cache que sobreviva entre deploys:

```bash
# Crear KV namespace
wrangler kv:namespace create "CACHE"

# Actualizar wrangler.toml con el ID que te dé
```

## 💰 Límites del Plan Free de Cloudflare

- ✅ **100,000 requests/día** (suficiente para la mayoría)
- ✅ **10ms CPU time** por request
- ✅ Caché ilimitado
- ✅ Sin límite de ancho de banda

Si necesitas más: upgrade a plan Paid ($5/mes) = 10 millones de requests

## 🔐 Seguridad

### ¿Es seguro permitir lectura pública en Firestore?

**SÍ**, porque:

1. **Shares**: Solo se pueden leer con el token exacto (imposible enumerar)
2. **Files**: Solo se leen si ya tienes un share válido
3. **B2**: Los archivos reales siguen protegidos
4. **No se expone**: Información sensible como userIds, emails, etc.

### ¿Qué pasa si alguien adivina un fileId?

- Pueden leer metadata (nombre, tamaño, mime)
- **NO** pueden descargar el archivo (necesitan la URL de B2)
- **NO** pueden modificar nada
- Los fileIds son aleatorios y difíciles de adivinar

## 📚 Recursos Adicionales

- [Documentación de Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Documentación de Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- [Firestore REST API](https://firebase.google.com/docs/firestore/use-rest-api)
- [Backblaze B2 con S3 API](https://www.backblaze.com/b2/docs/s3_compatible_api.html)

## 🤝 Soporte

Si tienes problemas:

1. Revisa los logs: `wrangler tail --env production`
2. Verifica la configuración en `wrangler.toml`
3. Verifica las reglas de Firestore
4. Verifica que el backend esté funcionando (opcional)

## 📝 Changelog

### v1.0.0 (Actual)
- ✅ Implementación inicial
- ✅ Caché de 1 hora
- ✅ Soporte multi-dominio
- ✅ Lectura directa de Firestore
- ✅ Redirect a B2
- ✅ Incremento de contador (opcional)

