# Sistema de Taskbar - ControlFile

## 📋 Descripción General

El sistema de taskbar en ControlFile proporciona un acceso rápido a carpetas específicas, separado del sistema de navegación principal del navbar. Permite crear y gestionar carpetas de acceso rápido con diferenciación visual clara.

## 🎯 Diferencias entre Taskbar y Navbar

### **Navbar (Navegación Principal)**
- **Propósito**: Navegación principal del drive
- **Carpetas mostradas**: Solo carpetas con `metadata.source === 'navbar'` o sin source (compatibilidad)
- **Estilo visual**: Botones con marco morado (`border-purple-500`)
- **Ubicación**: Barra superior de navegación
- **Context menu**: Disponible (renombrar, eliminar, etc.)

### **Taskbar (Acceso Rápido)**
- **Propósito**: Acceso rápido a carpetas específicas
- **Carpetas mostradas**: Solo carpetas con `metadata.source === 'taskbar'`
- **Estilo visual**: Botones con marco azul (`border-blue-500`)
- **Ubicación**: Barra inferior fija
- **Context menu**: No disponible (navegación directa)

## 🔧 Implementación Técnica

### **Estructura de Datos en Firestore**

```typescript
// Colección: files/{fileId}
{
  id: string,
  userId: string,
  name: string,
  slug: string,
  parentId: null, // Siempre null para carpetas principales
  path: string[],
  ancestors: string[],
  createdAt: Date,
  updatedAt: Date,
  type: "folder",
  deletedAt: null,
  metadata: {
    isMainFolder: true,
    isDefault: false,
    icon: string, // "Folder" para navbar, "Taskbar" para taskbar
    color: string, // "text-purple-600" para navbar, "text-blue-600" para taskbar
    description: "",
    tags: [],
    isPublic: false,
    viewCount: 0,
    lastAccessedAt: Date,
    source: "navbar" | "taskbar", // Identifica el origen
    permissions: {
      canEdit: true,
      canDelete: true,
      canShare: true,
      canDownload: true
    },
    customFields: {}
  }
}
```

### **API Endpoints**

#### Crear Carpeta
```typescript
POST /api/folders/create
{
  name: string,
  parentId: null,
  icon: string,
  color: string,
  source: "navbar" | "taskbar" // NUEVO PARÁMETRO
}
```

#### Obtener Carpetas del Usuario
```typescript
GET /api/folders
// Retorna todas las carpetas del usuario
// El filtrado por source se hace en el frontend
```

### **Funciones del Store (Zustand)**

```typescript
// lib/stores/drive.ts
createMainFolder: (name: string, icon: string, color: string, source?: string) => string
```

**Parámetros:**
- `name`: Nombre de la carpeta
- `icon`: Ícono a mostrar ("Folder" o "Taskbar")
- `color`: Color del marco ("text-purple-600" o "text-blue-600")
- `source`: Origen de la carpeta ("navbar" por defecto, "taskbar")

## 🎨 Diferenciación Visual

### **Taskbar**
```css
/* Botones con marco azul */
.variant="outline"
.border-2.border-blue-500
```

### **Navbar**
```css
/* Botones con marco morado */
.variant="outline"
.border-2.border-purple-500
```

## 🔄 Flujo de Uso

### **Crear Carpeta desde Navbar**
1. Usuario hace clic en "+" en el navbar
2. Se llama `createMainFolder(name, "Folder", "text-purple-600", "navbar")`
3. Carpeta se guarda en Firestore con `source: "navbar"`
4. Aparece solo en el navbar (marco morado)

### **Crear Carpeta desde Taskbar**
1. Usuario hace clic en "+" en el taskbar
2. Se llama `createMainFolder(name, "Taskbar", "text-blue-600", "taskbar")`
3. Carpeta se guarda en Firestore con `source: "taskbar"`
4. Aparece solo en el taskbar (marco azul)

### **Navegación**
- Ambas carpetas funcionan igual para navegación
- Al hacer clic se navega a la carpeta correspondiente
- Solo difieren en su origen y visualización

## 📁 Filtros de Carpetas

### **Taskbar Filter**
```typescript
const taskbarFolders = items.filter(item => 
  item.type === 'folder' && 
  item.parentId === null && // Solo carpetas principales (sin padre)
  item.metadata?.isMainFolder &&
  item.userId === userId &&
  !item.deletedAt &&
  item.metadata?.source === 'taskbar' // Solo carpetas del taskbar
);
```

### **Navbar Filter**
```typescript
const navbarFolders = items.filter(item => 
  item.type === 'folder' && 
  item.parentId === null &&
  item.metadata?.isMainFolder &&
  item.userId === userId &&
  !item.deletedAt &&
  (item.metadata?.source === 'navbar' || !item.metadata?.source) // navbar o sin source (compatibilidad)
);
```

## 🔄 Sincronización

### **useAllFolders Hook**
- El hook `useAllFolders` carga todas las carpetas principales desde Firestore
- Se ejecuta en `FileExplorer` para poblar el store global
- Todas las carpetas se almacenan en `useDriveStore.items`
- Los componentes `Taskbar` y `Navbar` filtran directamente del store

### **Reactividad**
- Los filtros son reactivos a cambios en `items` y `user`
- Las carpetas aparecen inmediatamente después de crearse
- No requiere recarga de página
- Actualización automática cuando se crean nuevas carpetas

## 🚀 Beneficios del Sistema

1. **Separación clara**: Navegación principal vs acceso rápido
2. **Diferenciación visual**: Colores de marco distintos
3. **Flexibilidad**: Usuario decide dónde crear cada carpeta
4. **Compatibilidad**: Carpetas existentes sin source funcionan en navbar
5. **Escalabilidad**: Fácil agregar nuevos tipos de fuente
6. **Consistencia**: Misma lógica de navegación para ambos

## 🔧 Mantenimiento

### **Migración de Carpetas Existentes**
Las carpetas creadas antes de este sistema no tienen el campo `source` y aparecen automáticamente en el navbar por compatibilidad.

### **Futuras Mejoras**
- Sistema de favoritos (marcar carpetas existentes como favoritas)
- Drag & drop entre navbar y taskbar
- Personalización de colores por usuario
- Agrupación de carpetas por categorías

## 📝 Notas de Desarrollo

- El campo `source` es opcional en la API (default: "navbar")
- Los filtros manejan tanto carpetas con source como sin source
- La sincronización usa el mismo sistema que FileExplorer
- Los estilos son consistentes con el design system de la app
