# 🗂️ Guía de Carpetas en Taskbar - Apps Externas

Esta guía explica cómo las aplicaciones externas pueden crear carpetas que aparezcan automáticamente en el taskbar de ControlFile.

## 📋 Resumen Ejecutivo

**¿Qué es?** Sistema que permite a las apps externas crear carpetas que aparecen como botones en el taskbar de ControlFile.

**¿Para qué?** Acceso rápido a la funcionalidad de cada app desde ControlFile.

**¿Cómo?** Enviando `source: 'taskbar'` al crear carpetas.

## 🎯 Casos de Uso

### ControlAudit
- Carpeta "ControlAudit" en el taskbar
- Al hacer clic → Navega a la carpeta de auditorías del usuario

### ControlDoc
- Carpeta "ControlDoc" en el taskbar  
- Al hacer clic → Navega a la carpeta de documentos del usuario

### ControlGastos
- Carpeta "ControlGastos" en el taskbar
- Al hacer clic → Navega a la carpeta de gastos del usuario

## 🚀 Implementación Rápida

### ⚠️ IMPORTANTE: Colección Unificada
- **Todas las carpetas** se crean en la colección `files` con `type: 'folder'`
- **NO usar** la colección `folders` (deprecated)
- **Consistencia total** entre todos los endpoints

### 1. Crear Carpeta en Taskbar

```typescript
// En tu app externa
const createTaskbarFolder = async (appName: string) => {
  const idToken = await getAuth().currentUser?.getIdToken();
  
  const response = await fetch('https://controlfile.onrender.com/api/folders/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: `${appName.toLowerCase()}-main-${Date.now()}`,
      name: appName,
      source: 'taskbar', // ✅ CLAVE: Aparece en taskbar
      icon: 'Taskbar',
      color: 'text-blue-600'
    })
  });

  if (response.ok) {
    console.log('✅ Carpeta creada en taskbar');
    return await response.json();
  } else {
    throw new Error('Error creando carpeta');
  }
};

// Uso
await createTaskbarFolder('ControlAudit');
```

### 2. Verificar que Aparece en Taskbar

La carpeta aparecerá automáticamente en el taskbar de ControlFile como:

```
┌─────────────────────────────────────────┐
│ [ControlFile] [ControlAudit] [ControlDoc] │
└─────────────────────────────────────────┘
```

### 3. Navegación al Hacer Clic

Cuando el usuario hace clic en la carpeta del taskbar:

1. **ControlFile** navega a la carpeta
2. **Muestra el contenido** de esa carpeta
3. **El usuario puede** subir/descargar archivos normalmente

## 🔧 Configuración Avanzada

### Personalizar Apariencia

```typescript
const folderData = {
  id: 'miapp-main-123',
  name: 'Mi App',
  source: 'taskbar',
  icon: 'Taskbar',           // Icono del botón
  color: 'text-blue-600',    // Color del botón
  metadata: {
    description: 'Carpeta de Mi App',
    isPublic: false
  }
};
```

### Crear Subcarpetas

```typescript
// Crear subcarpeta dentro de la carpeta principal
const createSubfolder = async (parentId: string, subfolderName: string) => {
  const idToken = await getAuth().currentUser?.getIdToken();
  
  const response = await fetch('https://controlfile.onrender.com/api/folders/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: `subfolder-${Date.now()}`,
      name: subfolderName,
      parentId: parentId, // ✅ Carpeta padre
      source: 'navbar',   // Subcarpetas van en navbar
      icon: 'Folder',
      color: 'text-gray-600'
    })
  });

  return await response.json();
};
```

## 📊 Estructura de Datos

### Carpeta en Taskbar
```typescript
{
  id: "controlaudit-main-123",
  userId: "user123",
  name: "ControlAudit",
  type: "folder",
  parentId: null, // ✅ Siempre null para taskbar
  metadata: {
    source: "taskbar", // ✅ CLAVE - Solo esto importa
    isMainFolder: true,
    icon: "Taskbar",
    color: "text-blue-600",
    isPublic: false
  }
}
```

### Subcarpeta
```typescript
{
  id: "auditorias-2025",
  userId: "user123", 
  name: "Auditorías 2025",
  type: "folder",
  parentId: "controlaudit-main-123", // ✅ Referencia a carpeta padre
  metadata: {
    source: "navbar", // Subcarpetas van en navbar
    isMainFolder: false,
    icon: "Folder",
    color: "text-gray-600"
  }
}
```

## 🎨 Personalización Visual

### Colores Disponibles
```typescript
const colors = [
  'text-blue-600',    // Azul (recomendado para taskbar)
  'text-purple-600',  // Morado
  'text-green-600',   // Verde
  'text-red-600',     // Rojo
  'text-yellow-600',  // Amarillo
  'text-indigo-600',  // Índigo
  'text-pink-600',    // Rosa
  'text-gray-600'     // Gris
];
```

### Iconos Disponibles
```typescript
const icons = [
  'Taskbar',    // Para carpetas del taskbar
  'Folder',     // Para carpetas normales
  'Document',   // Para documentos
  'Image',      // Para imágenes
  'Video',      // Para videos
  'Audio'       // Para audio
];
```

## 🔄 Flujo Completo de Integración

### Paso 1: Usuario Inicia Sesión
```typescript
// En tu app
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const auth = getAuth();
const provider = new GoogleAuthProvider();

// Usuario se autentica con Firebase Auth Central
const result = await signInWithPopup(auth, provider);
const idToken = await result.user.getIdToken();
```

### Paso 2: Crear Carpeta en Taskbar
```typescript
// Crear carpeta principal
const mainFolder = await createTaskbarFolder('ControlAudit');

// Crear estructura de subcarpetas
await createSubfolder(mainFolder.folder.id, '2025');
await createSubfolder(mainFolder.folder.id, '2024');
await createSubfolder(mainFolder.folder.id, 'Archivos');
```

### Paso 3: Subir Archivos
```typescript
// Subir archivo a la carpeta
const uploadFile = async (file: File, folderId: string) => {
  const idToken = await getAuth().currentUser?.getIdToken();
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('parentId', folderId);
  
  const response = await fetch('https://controlfile.onrender.com/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`
    },
    body: formData
  });
  
  return await response.json();
};
```

## 🛡️ Seguridad y Permisos

### Validación Automática
- ✅ **Solo usuarios autenticados** pueden crear carpetas
- ✅ **Cada usuario** solo ve sus propias carpetas
- ✅ **Claims de usuario** validan acceso a la app
- ✅ **Aislamiento total** entre usuarios

### Autenticación Requerida
```typescript
// El usuario debe estar autenticado con Firebase Auth
const user = getAuth().currentUser;
const idToken = await user.getIdToken();
```

## 🐛 Troubleshooting

### Error: "No autorizado"
```typescript
// Verificar que el usuario esté autenticado
const user = getAuth().currentUser;
if (!user) {
  console.log('Usuario no autenticado');
  // Redirigir a login
}
```

### Error: "Carpeta ya existe"
```typescript
// Usar ID único
const uniqueId = `${appName.toLowerCase()}-main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

### La carpeta no aparece en taskbar
```typescript
// Verificar que source sea 'taskbar'
const folderData = {
  // ...
  metadata: {
    source: 'taskbar' // ✅ Debe ser exactamente 'taskbar'
  }
};
```

## 📝 Ejemplo Completo

### App de ControlAudit

```typescript
// controlaudit-integration.ts
import { getAuth } from 'firebase/auth';

class ControlAuditIntegration {
  private backendUrl = 'https://controlfile.onrender.com';
  
  async initializeUser() {
    const user = getAuth().currentUser;
    if (!user) throw new Error('Usuario no autenticado');
    
    const idToken = await user.getIdToken();
    
    // Crear carpeta principal en taskbar
    const mainFolder = await this.createMainFolder(idToken);
    
    // Crear estructura de carpetas
    await this.createFolderStructure(idToken, mainFolder.id);
    
    return mainFolder;
  }
  
  private async createMainFolder(idToken: string) {
    const response = await fetch(`${this.backendUrl}/api/folders/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: `controlaudit-main-${Date.now()}`,
        name: 'ControlAudit',
        source: 'taskbar',
        icon: 'Taskbar',
        color: 'text-blue-600'
      })
    });
    
    if (!response.ok) throw new Error('Error creando carpeta principal');
    return await response.json();
  }
  
  private async createFolderStructure(idToken: string, parentId: string) {
    const folders = [
      { name: '2025', icon: 'Folder', color: 'text-gray-600' },
      { name: '2024', icon: 'Folder', color: 'text-gray-600' },
      { name: 'Templates', icon: 'Document', color: 'text-green-600' },
      { name: 'Reports', icon: 'Document', color: 'text-purple-600' }
    ];
    
    for (const folder of folders) {
      await fetch(`${this.backendUrl}/api/folders/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: `audit-${folder.name.toLowerCase()}-${Date.now()}`,
          name: folder.name,
          parentId: parentId,
          source: 'navbar',
          icon: folder.icon,
          color: folder.color
        })
      });
    }
  }
  
  async uploadAuditFile(file: File, folderName: string) {
    const user = getAuth().currentUser;
    const idToken = await user.getIdToken();
    
    // Buscar carpeta por nombre
    const folders = await this.getUserFolders(idToken);
    const targetFolder = folders.find(f => f.name === folderName);
    
    if (!targetFolder) throw new Error('Carpeta no encontrada');
    
    // Subir archivo
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parentId', targetFolder.id);
    
    const response = await fetch(`${this.backendUrl}/api/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}` },
      body: formData
    });
    
    return await response.json();
  }
  
  private async getUserFolders(idToken: string) {
    const response = await fetch(`${this.backendUrl}/api/files`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    
    const data = await response.json();
    return data.folders || [];
  }
}

// Uso
const integration = new ControlAuditIntegration();

// Al inicializar la app
await integration.initializeUser();

// Al subir un archivo
await integration.uploadAuditFile(file, '2025');
```

## 🎯 Mejores Prácticas

### 1. Nombres Únicos
```typescript
// ✅ Bueno
const id = `controlaudit-main-${Date.now()}`;

// ❌ Malo  
const id = 'main-folder'; // Puede duplicarse
```

### 2. Manejo de Errores
```typescript
try {
  await createTaskbarFolder('ControlAudit');
} catch (error) {
  if (error.message.includes('ya existe')) {
    console.log('Carpeta ya existe, continuando...');
  } else {
    console.error('Error:', error);
  }
}
```

### 3. Verificación de Estado
```typescript
const checkFolderExists = async (folderName: string) => {
  const folders = await getUserFolders();
  return folders.some(f => f.name === folderName);
};
```

## 📞 Soporte

**¿Problemas?**
1. Verifica que el usuario esté autenticado
2. Revisa la consola del navegador
3. Verifica que `source: 'taskbar'` esté correcto
4. Contacta: soporte@controldoc.app

**¿Funcionando?**
- ✅ La carpeta aparece en el taskbar
- ✅ Al hacer clic navega correctamente
- ✅ Se pueden subir/descargar archivos
- ✅ Las subcarpetas se crean correctamente

---

**¡Tu app ahora tiene acceso directo desde ControlFile!** 🚀
