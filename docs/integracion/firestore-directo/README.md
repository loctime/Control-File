# Integración Directa con Firestore

## Descripción
Integración directa con Firestore para apps que comparten el mismo proyecto de base de datos que ControlFile. Sin APIs, acceso directo a la base de datos.

## 🚀 Características

- ✅ **Sin APIs** - Directo a Firestore
- ✅ **Sin complicaciones** - Estructura exacta
- ✅ **Control total** - Tu app maneja todo
- ✅ **Más rápido** - Sin API calls
- ✅ **Más simple** - Menos código
- ✅ **Más confiable** - Sin dependencias externas

## 📚 Documentación Disponible

- **[Guía Completa](./GUIA_FIRESTORE_DIRECTO.md)** - Todo lo que necesitas saber
- **[Ejemplos Prácticos](./ejemplos/)** - Código listo para usar

## 🎯 Funcionalidades

- **📁 Carpetas** - Crear en taskbar/navbar
- **📤 Archivos** - Subir y gestionar
- **🔗 Enlaces** - Compartir y descargar
- **🔍 Búsqueda** - Encontrar archivos
- **👥 Permisos** - Control de acceso

## 🚀 **Inicio Rápido:**

```typescript
// 1. Instalar Firebase
npm install firebase

// 2. Configurar Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Tu configuración de Firebase
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 3. Crear carpeta en taskbar
const folderData = {
  id: `miapp-main-${Date.now()}`,
  userId: user.uid,
  name: 'Mi App',
  type: 'folder',
  parentId: null,
  metadata: {
    source: 'taskbar', // ✅ Aparece en taskbar
    icon: 'Taskbar',
    color: 'text-blue-600'
  }
};

await setDoc(doc(db, 'files', folderData.id), folderData);
```

## 🎯 **Apps que Usan Esta Integración:**

- **ControlBio** - Análisis de datos
- **ControlAudit** - Auditorías
- **ControlDoc** - Documentos
- **ControlGastos** - Gastos
- **ControlStock** - Inventario

---

# 🎉 **¡Integración Simple y Directa!**



