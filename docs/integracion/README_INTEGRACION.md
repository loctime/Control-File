# 🔥 **Guía de Integración - ControlFile**

## 🎯 **¿Cómo integrar tu app con ControlFile?**

**ControlFile ofrece dos formas de integración dependiendo de tu situación:**

## 📚 **Documentación Disponible:**

### 🚀 **Integración Directa con Firestore (RECOMENDADA)**
- **[Integración Directa](./firestore-directo/)** - Sin APIs, directo a Firestore
- **Ventajas:** Más simple, más rápido, más confiable

### 🔌 **Integración con APIs Externas**
- **[Integración con APIs](./api-externa/)** - Con APIs de ControlFile
- **Ventajas:** Validaciones del backend, pero más complejo

## 🎯 **¿Cuál Usar?**

### ✅ **Usa Integración Directa si:**
- Tu app comparte el mismo Firestore que ControlFile
- Quieres simplicidad y control total
- No necesitas validaciones complejas del backend

### ⚠️ **Usa APIs si:**
- Tu app NO comparte Firestore con ControlFile
- Necesitas validaciones complejas del backend
- Quieres que ControlFile maneje la lógica de negocio

## 🚀 **Inicio Rápido - Integración Directa**

```typescript
// 1. Instalar Firebase
npm install firebase

// 2. Configurar Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  // Tu configuración de Firebase
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

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

## 🎯 **Estructura de Datos**

### **Carpetas en Taskbar:**
```typescript
{
  type: 'folder',
  parentId: null,
  metadata: {
    source: 'taskbar', // ✅ CLAVE
    icon: 'Taskbar',
    color: 'text-blue-600'
  }
}
```

### **Carpetas en Navbar:**
```typescript
{
  type: 'folder',
  parentId: null,
  metadata: {
    source: 'navbar', // ✅ CLAVE
    icon: 'Folder',
    color: 'text-purple-600'
  }
}
```

## 🚀 **Ejemplos Completos**

- **[ControlBio - Integración Directa](./GUIA_FIRESTORE_DIRECTO.md#controlbio)**
- **[ControlAudit - Integración Directa](./GUIA_FIRESTORE_DIRECTO.md#controlaudit)**
- **[ControlDoc - Integración Directa](./GUIA_FIRESTORE_DIRECTO.md#controldoc)**

---

# 🎉 **¡Integración Simple y Directa!**

**No más APIs complicadas. Solo Firestore directo.**
