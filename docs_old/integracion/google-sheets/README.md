# Google Sheets Integration - Control Store

## Descripción
Integración completa con Google Sheets para gestionar productos de tiendas en Control Store. Permite crear hojas de cálculo automáticamente, sincronizar productos y crear backups.

## 🚀 Características

- ✅ **Creación automática** de hojas con template de productos
- ✅ **OAuth2** para autenticación de usuarios
- ✅ **Service Account** para operaciones server-to-server
- ✅ **Caché inteligente** (5 minutos TTL)
- ✅ **Sincronización** con Firestore
- ✅ **Backup automático** en Google Drive
- ✅ **Manejo de errores** robusto

## 📋 Endpoints Disponibles

### 1. Crear Hoja de Productos
```http
POST /api/stores/:storeId/sheets/create
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json

{
  "authCode": "4/0AX4XfWh..." // Del OAuth popup
}
```

**Respuesta:**
```json
{
  "success": true,
  "sheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "editUrl": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
}
```

### 2. Obtener Productos
```http
GET /api/stores/:storeId/products?forceRefresh=true
Authorization: Bearer <ID_TOKEN>
```

**Respuesta:**
```json
{
  "products": [
    {
      "id": "row_2",
      "nombre": "Producto 1",
      "descripcion": "Descripción del producto",
      "variedades1": "S,M,L",
      "variedades1Titulo": "Tallas",
      "categoria": "Ropa",
      "precio": 29.99,
      "precioAnterior": 39.99,
      "imagenUrl": "https://ejemplo.com/imagen.jpg"
    }
  ],
  "categories": ["Ropa", "Accesorios"],
  "cached": false
}
```

### 3. Sincronizar con Firestore
```http
POST /api/stores/:storeId/sheets/sync
Authorization: Bearer <ID_TOKEN>
```

**Respuesta:**
```json
{
  "success": true,
  "count": 25,
  "products": 25,
  "categories": 5
}
```

### 4. Crear Backup
```http
POST /api/stores/:storeId/backup
Authorization: Bearer <ID_TOKEN>
```

**Respuesta:**
```json
{
  "success": true,
  "backupUrl": "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view"
}
```

## 🔧 Configuración Requerida

### Variables de Entorno
```bash
# OAuth para autenticación de usuarios
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui

# Service Account para operaciones server-to-server
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-service-account@proyecto.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

### Scopes de Google
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/drive.file`

## 📊 Template de la Hoja

La hoja se crea automáticamente con estas columnas:

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| A - Nombre | Nombre del producto | "Camiseta Básica" |
| B - Descripción | Descripción detallada | "Camiseta de algodón 100%" |
| C - Variedades 1 | Opciones de variedad 1 | "S,M,L,XL" |
| D - Variedades 1 Título | Título para variedad 1 | "Tallas" |
| E - Variedades 2 | Opciones de variedad 2 | "Rojo,Azul,Verde" |
| F - Variedades 2 Título | Título para variedad 2 | "Colores" |
| G - Categoría | Categoría del producto | "Ropa" |
| H - Precio | Precio actual | "29.99" |
| I - Precio anterior | Precio anterior (opcional) | "39.99" |
| J - Imagen (URL) | URL de la imagen | "https://ejemplo.com/imagen.jpg" |

## 🔄 Flujo de Integración

1. **Configuración OAuth**: El frontend obtiene un `authCode` del OAuth popup
2. **Crear Hoja**: Se llama a `/api/stores/:storeId/sheets/create` con el `authCode`
3. **Configurar Permisos**: La hoja se comparte automáticamente con el service account
4. **Leer Productos**: Se usa `/api/stores/:storeId/products` para obtener productos
5. **Sincronizar**: Se usa `/api/stores/:storeId/sheets/sync` para actualizar Firestore
6. **Backup**: Se usa `/api/stores/:storeId/backup` para crear copias de seguridad

## 💡 Ejemplo de Uso

```javascript
// 1. Crear hoja de productos
const createResponse = await fetch('/api/stores/store123/sheets/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    authCode: '4/0AX4XfWh...' // Del OAuth popup
  })
});

const { sheetId, editUrl } = await createResponse.json();

// 2. Obtener productos
const productsResponse = await fetch('/api/stores/store123/products', {
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});

const { products, categories } = await productsResponse.json();

// 3. Sincronizar con Firestore
const syncResponse = await fetch('/api/stores/store123/sheets/sync', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});

// 4. Crear backup
const backupResponse = await fetch('/api/stores/store123/backup', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});
```

## 🛡️ Seguridad

- Todos los endpoints requieren autenticación Bearer token
- La hoja se comparte con el service account como "Lector"
- Los permisos de escritura quedan con el usuario original
- Validación de permisos en cada operación

## 📚 Documentación Adicional

- [API Completa](../../backend/GOOGLE_SHEETS_API.md) - Documentación técnica detallada
- [Ejemplo de Integración](../../examples/google-sheets-integration.js) - Código de ejemplo
- [Variables de Entorno](../deployment/ENVIRONMENT_VARIABLES.md) - Configuración completa