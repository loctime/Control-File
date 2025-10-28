# 🔥 **Guía de Integración - ControlFile**

## 🎯 **¿Cómo integrar tu app con ControlFile?**

**ControlFile ofrece dos formas de integración dependiendo de tu situación:**

## 🚀 **Opción 1: Integración Directa con Firestore (RECOMENDADA)**

### ✅ **Usa esta opción si:**
- Tu app comparte el mismo proyecto de Firestore que ControlFile
- Quieres simplicidad y control total
- No necesitas validaciones complejas del backend

### 📁 **Documentación:**
- **[Integración Directa](./firestore-directo/)** - Sin APIs, directo a Firestore
- **Ventajas:** Más simple, más rápido, más confiable

---

## 🔌 **Opción 2: Integración con APIs Externas**

### ✅ **Usa esta opción si:**
- Tu app NO comparte Firestore con ControlFile
- Necesitas validaciones complejas del backend
- Quieres que ControlFile maneja la lógica de negocio

### 📁 **Documentación:**
- **[Integración con APIs](./api-externa/)** - Con APIs de ControlFile
- **Ventajas:** Validaciones del backend, pero más complejo

---

## 🎯 **¿Cuál Elegir?**

### 🚀 **Integración Directa (Recomendada):**
```typescript
// ✅ SIMPLE - Directo a Firestore
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

### 🔌 **Integración con APIs:**
```typescript
// ⚠️ COMPLEJO - Con APIs
const response = await fetch(`${BACKEND_URL}/api/folders/create`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    id: `miapp-main-${Date.now()}`,
    name: 'Mi App',
    source: 'taskbar',
    // ... más campos
  }),
});
```

## 🎯 **Apps que Ya Usan ControlFile:**

### 🔥 **Integración Directa:**
- **ControlBio** - Análisis de datos
- **ControlAudit** - Auditorías  
- **ControlDoc** - Documentos
- **ControlGastos** - Gastos
- **ControlStock** - Inventario

### 🔌 **Integración con APIs:**
- **Apps externas** - Que no comparten Firestore
- **Apps legacy** - Que ya usan APIs
- **Apps de terceros** - Que se integran con ControlFile

---

## 🚀 **Inicio Rápido:**

1. **¿Compartes Firestore?** → [Integración Directa](./firestore-directo/)
2. **¿No compartes Firestore?** → [Integración con APIs](./api-externa/)

---

# 🎉 **¡Elige tu Integración y Empieza!**
