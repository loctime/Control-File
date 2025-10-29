# Changelog - Google Sheets Integration

## [2025-10-29] - Google Sheets Integration para Control Store

### ✨ Nuevas Características

#### 🔧 Backend
- **Nuevos endpoints** para integración con Google Sheets:
  - `POST /api/stores/:storeId/sheets/create` - Crear hoja de productos
  - `GET /api/stores/:storeId/products` - Obtener productos con caché
  - `POST /api/stores/:storeId/sheets/sync` - Sincronizar con Firestore
  - `POST /api/stores/:storeId/backup` - Crear backup en Drive

#### 📚 Utilidades
- **`backend/src/utils/googleAuth.js`** - Utilidades para autenticación con Google
  - OAuth2 para autenticación de usuarios
  - Service Account para operaciones server-to-server
  - Clientes de Sheets y Drive API
  - Funciones de permisos y compartición

#### 🛣️ Rutas
- **`backend/src/routes/stores/sheets.js`** - Endpoints de Google Sheets
  - Manejo de caché en memoria (5 minutos TTL)
  - Validación de permisos y errores
  - Sincronización con Firestore
  - Creación automática de backups

### 📋 Template de Productos

La hoja se crea automáticamente con columnas predefinidas:

| Columna | Descripción |
|---------|-------------|
| A - Nombre | Nombre del producto |
| B - Descripción | Descripción detallada |
| C - Variedades 1 | Opciones (ej: "S,M,L") |
| D - Variedades 1 Título | Título (ej: "Tallas") |
| E - Variedades 2 | Opciones (ej: "Rojo,Azul") |
| F - Variedades 2 Título | Título (ej: "Colores") |
| G - Categoría | Categoría del producto |
| H - Precio | Precio actual |
| I - Precio anterior | Precio anterior |
| J - Imagen (URL) | URL de la imagen |

### 🔐 Variables de Entorno Requeridas

```bash
# OAuth para autenticación de usuarios
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui

# Service Account para operaciones server-to-server
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-service-account@proyecto.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

### 📚 Documentación

#### Nuevos Archivos de Documentación
- **`backend/GOOGLE_SHEETS_API.md`** - Documentación técnica completa de la API
- **`docs/integracion/GOOGLE_SHEETS_STORE.md`** - Guía de integración para desarrolladores
- **`examples/google-sheets-integration.js`** - Ejemplo de uso en el frontend

#### Archivos Actualizados
- **`README.md`** - Agregada característica "Google Sheets Integration"
- **`API_REFERENCE.md`** - Agregados endpoints de Google Sheets
- **`docs/integracion/README_INTEGRACION.md`** - Agregada sección de Google Sheets

### 🚀 Dependencias

#### Nuevas Dependencias
- **`googleapis`** - Cliente oficial de Google APIs para Node.js

### 🔄 Flujo de Integración

1. **Configuración OAuth**: El frontend obtiene un `authCode` del OAuth popup
2. **Crear Hoja**: Se llama a `/api/stores/:storeId/sheets/create` con el `authCode`
3. **Configurar Permisos**: La hoja se comparte automáticamente con el service account
4. **Leer Productos**: Se usa `/api/stores/:storeId/products` para obtener productos
5. **Sincronizar**: Se usa `/api/stores/:storeId/sheets/sync` para actualizar Firestore
6. **Backup**: Se usa `/api/stores/:storeId/backup` para crear copias de seguridad

### 🛡️ Seguridad

- Todos los endpoints requieren autenticación Bearer token
- La hoja se comparte con el service account como "Lector"
- Los permisos de escritura quedan con el usuario original
- Validación de permisos en cada operación

### 🎯 Casos de Uso

- **Control Store**: Gestión de productos de tiendas
- **Inventarios**: Sincronización de stock desde hojas de cálculo
- **Catálogos**: Actualización automática de productos
- **Backups**: Respaldo automático de datos importantes

### 📝 Notas de Despliegue

1. **Agregar variables de entorno** en Render:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_KEY`

2. **Reiniciar el backend** para cargar las nuevas rutas

3. **Configurar OAuth** en Google Cloud Console:
   - Habilitar Google Sheets API
   - Habilitar Google Drive API
   - Configurar redirect URI

### 🔧 Configuración de Google Cloud

1. **Crear Service Account**:
   - Ir a Google Cloud Console
   - Crear Service Account
   - Descargar JSON de credenciales
   - Configurar como `GOOGLE_SERVICE_ACCOUNT_KEY`

2. **Configurar OAuth**:
   - Crear credenciales OAuth 2.0
   - Configurar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`
   - Agregar redirect URI: `postmessage` (para popup)

3. **Habilitar APIs**:
   - Google Sheets API
   - Google Drive API

### 🐛 Correcciones

- **Corregido require path** en `backend/src/routes/stores/sheets.js`
  - Cambiado de `../utils/googleAuth` a `../../utils/googleAuth`

### 📈 Próximas Mejoras

- [ ] Integración con Redis para caché distribuido
- [ ] Webhooks para sincronización en tiempo real
- [ ] Soporte para múltiples hojas por tienda
- [ ] Validación de datos más robusta
- [ ] Métricas y logging mejorados
