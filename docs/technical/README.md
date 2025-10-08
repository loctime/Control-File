# 🔧 Documentación Técnica

Esta carpeta contiene documentación técnica, notas de implementación, fixes y decisiones arquitectónicas.

## 📖 Documentos Disponibles

| Documento | Descripción | Tipo |
|-----------|-------------|------|
| **[BUILD_FIXES.md](./BUILD_FIXES.md)** | Soluciones a problemas de build | Fix |
| **[FIREBASE_INDEX_FIX.md](./FIREBASE_INDEX_FIX.md)** | Configuración de índices de Firestore | Fix |
| **[PROXY_SOLUTION.md](./PROXY_SOLUTION.md)** | Implementación del proxy de upload | Feature |
| **[CONNECTION_IMPROVEMENTS.md](./CONNECTION_IMPROVEMENTS.md)** | Mejoras en manejo de conexión | Feature |
| **[REFACTORING_FILEEXPLORER.md](./REFACTORING_FILEEXPLORER.md)** | Refactorización del explorador de archivos | Refactor |
| **[API_INTEGRATION.md](./API_INTEGRATION.md)** | Integración con API externa | Integration |
| **[estructura.md](./estructura.md)** | Estructura del proyecto | Architecture |

## 🏗️ Arquitectura

### Stack Tecnológico

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS
- Zustand (State Management)
- React Query (Data Fetching)
- Sonner (Notifications)

**Backend:**
- Node.js 18+
- Express.js
- Firebase Admin SDK
- Backblaze B2 SDK

**Infraestructura:**
- Firebase Auth (Autenticación)
- Firestore (Base de datos)
- Backblaze B2 (Storage)
- Vercel (Frontend hosting)
- Render (Backend hosting)

### Flujo de Datos

```
Usuario
  ↓
React UI (Next.js)
  ↓
React Query (Cache)
  ↓
API Routes (/api/*)
  ↓
Backend (Express)
  ↓
Firebase Admin SDK
  ↓
Firestore + B2
```

### Patrón de Upload

```
1. Cliente solicita presigned URL → Backend
2. Backend genera URL → Backblaze B2
3. Cliente sube archivo directo → B2
4. Cliente confirma upload → Backend
5. Backend crea metadata → Firestore
```

## 🔍 Decisiones Técnicas

### ¿Por qué Backblaze B2?
- **Costo:** 1/4 del precio de AWS S3
- **Compatibilidad:** API compatible con S3
- **Confiabilidad:** 99.9% uptime SLA
- **Bandwidth:** Gratis hasta 3x storage

### ¿Por qué Firebase Auth?
- **OAuth integrado:** Google, Microsoft, etc.
- **Custom claims:** Control de acceso granular
- **Multi-tenancy:** Un auth para múltiples apps
- **Tokens JWT:** Estándar industria

### ¿Por qué Proxy Upload?
- **CORS:** Evitar problemas con navegadores
- **Progress:** Tracking más preciso
- **Retry:** Manejo de errores automático
- **Simplicidad:** Menos configuración cliente

### ¿Por qué Zustand?
- **Simplicidad:** Menos boilerplate que Redux
- **Performance:** Re-renders optimizados
- **TypeScript:** Excelente soporte
- **Persistencia:** localStorage out-of-the-box

## 🐛 Problemas Conocidos y Soluciones

### Build Errors
Ver **BUILD_FIXES.md** para:
- Errores de TypeScript en build
- Problemas de Capacitor
- Variables de entorno

### Firestore Queries
Ver **FIREBASE_INDEX_FIX.md** para:
- Índices compuestos requeridos
- Deploy de índices
- Optimización de queries

### Upload CORS
Ver **PROXY_SOLUTION.md** para:
- Configuración CORS
- Implementación de proxy
- Fallback strategies

### Conexión Intermitente
Ver **CONNECTION_IMPROVEMENTS.md** para:
- Retry automático
- Offline detection
- Cache strategies

## 📊 Performance

### Métricas Objetivo
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3s
- **Largest Contentful Paint:** < 2.5s
- **Upload Speed:** > 50 MB/s (red local)
- **API Response:** < 200ms (p95)

### Optimizaciones
- React Query para caching
- Virtual scrolling en listas grandes
- Lazy loading de componentes
- Image optimization con Next.js
- Code splitting por ruta

## 🔒 Seguridad

### Autenticación
- Firebase ID Tokens (JWT)
- Refresh automático cada hora
- Custom claims para autorización

### Autorización
- Verificación de ownership en backend
- Claims verificados en cada request
- Firestore rules como segunda capa

### Storage
- URLs presignadas (temporal)
- No acceso directo a buckets
- Expiración de share links

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

## 🔗 Enlaces Relacionados

- [Features](../features/) - Documentación de features
- [Deployment](../deployment/) - Guías de deployment
- [API Reference](../../API_REFERENCE.md) - API completa

---

**Volver a:** [📚 Documentación Principal](../README.md) | [🏠 Proyecto](../../README.md)

