# 📚 ControlFile - Documentación

## 🎯 ¿Qué es ControlFile?

**ControlFile** es un sistema de archivos en la nube que permite:
- ✅ **Subir archivos** de forma segura
- ✅ **Descargar archivos** cuando los necesites
- ✅ **Crear carpetas** para organizar contenido
- ✅ **Eliminar archivos** (van a papelera para recuperar)
- ✅ **Compartir archivos** con enlaces temporales

## 🚀 Para Desarrolladores

### **Integración Súper Simple (10 minutos)**

```typescript
// 1. Usuario se autentica
const user = getAuth().currentUser;
const idToken = await user.getIdToken();

// 2. Crear carpeta en taskbar
const response = await fetch('https://controlfile.onrender.com/api/folders/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: 'miapp-main-123',
    name: 'Mi App',
    source: 'taskbar', // ✅ Aparece en taskbar
    icon: 'Taskbar',
    color: 'text-blue-600'
  })
});

// 3. ¡Listo! La carpeta aparece en el taskbar
```

### **Resultado Visual**
```
┌─────────────────────────────────────────┐
│ [ControlFile] [ControlAudit] [Mi App]   │
└─────────────────────────────────────────┘
```

## 🔐 Seguridad

- ✅ **Firebase Auth** (token válido)
- ✅ **Aislamiento por usuario** (`userId`)
- ✅ **CORS** (control de dominios)

## 📊 Estructura de Datos

```typescript
// Colección: files/{itemId}
{
  id: "miapp-main-123",
  userId: "user123",           // ✅ Seguridad real
  name: "Mi App",
  type: "folder",
  parentId: null,              // ✅ Taskbar = null
  metadata: {
    source: "taskbar",         // ✅ Solo esto importa
    isMainFolder: true,
    icon: "Taskbar",
    color: "text-blue-600"
  }
}
```

## 🎨 Personalización

### **Colores Disponibles**
- `text-blue-600` (recomendado)
- `text-purple-600`
- `text-green-600`
- `text-red-600`
- `text-yellow-600`
- `text-indigo-600`
- `text-pink-600`
- `text-gray-600`

### **Iconos Disponibles**
- `Taskbar` (para taskbar)
- `Folder` (para carpetas)
- `Document` (para documentos)
- `Image` (para imágenes)
- `Video` (para videos)
- `Audio` (para audio)

## 🔄 Flujo Completo

### **1. Inicialización**
```typescript
class MiAppIntegration {
  async initializeUser() {
    const user = getAuth().currentUser;
    if (!user) throw new Error('Usuario no autenticado');
    
    const idToken = await user.getIdToken();
    const mainFolder = await this.createMainFolder(idToken);
    return mainFolder;
  }
}
```

### **2. Subir Archivos**
```typescript
async uploadFile(file: File, folderId: string) {
  const user = getAuth().currentUser;
  const idToken = await user.getIdToken();
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('parentId', folderId);
  
  const response = await fetch('https://controlfile.onrender.com/api/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}` },
    body: formData
  });
  
  return await response.json();
}
```

## 🎯 Casos de Uso

### **ControlAudit**
- Carpeta "ControlAudit" en taskbar
- Subcarpetas: "2025", "2024", "Templates"
- Archivos de auditoría por año

### **ControlDoc**
- Carpeta "ControlDoc" en taskbar
- Subcarpetas: "Contratos", "Facturas", "Recibos"
- Documentos organizados por tipo

### **ControlGastos**
- Carpeta "ControlGastos" en taskbar
- Subcarpetas: "Enero", "Febrero", "Marzo"
- Comprobantes por mes

## 🚀 Beneficios

### **Para Desarrolladores**
- ✅ **Implementación**: 10 minutos
- ✅ **Código**: 5 líneas
- ✅ **Mantenimiento**: Cero
- ✅ **Confusión**: Cero

### **Para Usuarios**
- ✅ **Un solo lugar** para todos los archivos
- ✅ **Navegación fluida** entre apps
- ✅ **Gestión unificada** de contenido

## 📝 Documentación Técnica

- 📖 [Guía de Carpetas en Taskbar](./integracion/GUIA_CARPETAS_TASKBAR.md)
- 📋 [Resumen Ejecutivo](./integracion/RESUMEN_CARPETAS_TASKBAR.md)
- 🗑️ [Eliminación de appCode](./integracion/ELIMINACION_APPCODE.md)
- 🎉 [Sistema Final Simplificado](./integracion/SISTEMA_FINAL_SIMPLIFICADO.md)

## 🎉 Conclusión

**ControlFile** es el sistema más simple para integración de apps externas:

1. ✅ **Solo Firebase Auth** (sin claims)
2. ✅ **Solo `userId`** (sin appCode)
3. ✅ **Solo `source`** (sin confusión)
4. ✅ **Solo 10 minutos** para integrar

**¡Tu app puede tener acceso directo desde ControlFile en minutos!** 🚀

---

**¿Preguntas?** Contacta: soporte@controldoc.app
