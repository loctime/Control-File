# 🔄 Integración: App con Firestore Separado

## 📋 Escenario

Tu aplicación:
- ✅ Usa el **Firebase Auth** de ControlFile (compartido)
- ✅ Usa el **backend** de ControlFile para subir archivos
- ✅ Tiene su **propio Firestore** (separado del de ControlFile)
- ❓ Quiere tener archivos en **ambos sistemas** (ControlFile + su propio Firestore)

## 🎯 ¿Es Posible?

**¡Sí! Es totalmente posible.** Aquí te explicamos cómo hacerlo.

## 🏗️ Arquitectura Actual de ControlFile

### Componentes del Sistema

1. **Archivos Físicos** → Almacenados en **Backblaze B2** (almacenamiento de objetos)
2. **Metadatos** → Almacenados en **Firestore de ControlFile** (colección `files`)
3. **Autenticación** → **Firebase Auth compartido** (proyecto central)
4. **Backend** → Procesa uploads, genera URLs presignadas, actualiza cuotas

### Flujo de Upload Actual

```
1. App → POST /api/uploads/presign (obtiene URL para subir)
2. App → PUT directo a B2 (sube el archivo físico)
3. App → POST /api/uploads/confirm (crea metadatos en Firestore de ControlFile)
```

## 🔄 Estrategias de Sincronización

Hay varias formas de mantener archivos sincronizados entre ambos sistemas. Elige la que mejor se adapte a tu caso:

---

## 📊 Opción 1: Sincronización Manual Post-Upload (RECOMENDADA)

**Mejor para:** Apps que necesitan control total sobre cuándo sincronizar

### Cómo Funciona

Después de subir un archivo a ControlFile, tu app sincroniza manualmente los metadatos a su propio Firestore.

### Implementación

```typescript
// 1. Subir archivo a ControlFile (flujo normal)
const uploadResponse = await uploadToControlFile(file);

// 2. Obtener información del archivo creado
const fileInfo = await getFileInfoFromControlFile(uploadResponse.fileId);

// 3. Sincronizar a tu propio Firestore
await syncToMyFirestore(fileInfo);
```

### Ejemplo Completo

```typescript
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// Tu propia configuración de Firebase
const myFirebaseConfig = {
  // ... tu configuración
};

const myApp = initializeApp(myFirebaseConfig, 'myApp');
const myDb = getFirestore(myApp);

// Función para subir y sincronizar
async function uploadAndSync(file: File) {
  const auth = getAuth(); // Auth compartido de ControlFile
  const token = await auth.currentUser?.getIdToken();
  const userId = auth.currentUser?.uid;

  if (!token || !userId) {
    throw new Error('Usuario no autenticado');
  }

  const BACKEND_URL = 'https://controlfile.onrender.com';

  // 1. Obtener URL presignada de ControlFile
  const presignResponse = await fetch(`${BACKEND_URL}/api/uploads/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mime: file.type,
      parentId: null,
    }),
  });

  const presignData = await presignResponse.json();
  const { uploadSessionId, url, bucketKey } = presignData;

  // 2. Subir archivo físico a B2
  await fetch(url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  // 3. Confirmar upload en ControlFile
  const confirmResponse = await fetch(`${BACKEND_URL}/api/uploads/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uploadSessionId,
    }),
  });

  const confirmData = await confirmResponse.json();
  const { fileId } = confirmData;

  // 4. Obtener información completa del archivo
  const fileInfoResponse = await fetch(
    `${BACKEND_URL}/api/files/${fileId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  const fileInfo = await fileInfoResponse.json();

  // 5. Sincronizar a tu propio Firestore
  await setDoc(doc(myDb, 'files', fileId), {
    // Campos básicos
    id: fileId,
    userId,
    name: fileInfo.name,
    size: fileInfo.size,
    mime: fileInfo.mime,
    bucketKey: fileInfo.bucketKey, // ✅ Mismo archivo físico
    parentId: fileInfo.parentId,
    
    // Metadatos adicionales para tu app
    syncedAt: new Date(),
    source: 'controlfile', // Indica que viene de ControlFile
    controlFileId: fileId, // Referencia al ID en ControlFile
    
    // Campos específicos de tu app (opcional)
    customFields: {
      // ... tus campos personalizados
    },
  });

  return { fileId, synced: true };
}
```

### Ventajas

- ✅ Control total sobre cuándo sincronizar
- ✅ Puedes agregar campos personalizados
- ✅ No requiere acceso al Firestore de ControlFile
- ✅ Funciona inmediatamente sin configuración adicional

### Desventajas

- ⚠️ Requiere código adicional en tu app
- ⚠️ Si olvidas sincronizar, los datos no estarán en tu Firestore

---

## 📊 Opción 2: Sincronización Automática con Firestore Listeners

**Mejor para:** Apps que necesitan sincronización en tiempo real

### Cómo Funciona

Usas Firestore listeners para escuchar cambios en el Firestore de ControlFile y replicarlos automáticamente a tu Firestore.

### ⚠️ Requisitos

- Necesitas acceso de lectura al Firestore de ControlFile
- Debes tener permisos configurados en las reglas de Firestore

### Implementación

```typescript
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';

// Firestore de ControlFile (necesitas acceso)
const controlFileDb = getFirestore(controlFileApp);
// Tu propio Firestore
const myDb = getFirestore(myApp);

// Escuchar archivos nuevos del usuario actual
function syncFilesFromControlFile(userId: string) {
  const filesRef = collection(controlFileDb, 'files');
  const q = query(
    filesRef,
    where('userId', '==', userId),
    where('type', '==', 'file')
  );

  const unsubscribe = onSnapshot(q, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added' || change.type === 'modified') {
        const fileData = change.doc.data();
        
        // Sincronizar a tu Firestore
        await setDoc(doc(myDb, 'files', change.doc.id), {
          ...fileData,
          syncedAt: new Date(),
          source: 'controlfile',
        });
      } else if (change.type === 'removed') {
        // Eliminar de tu Firestore si se elimina en ControlFile
        await deleteDoc(doc(myDb, 'files', change.doc.id));
      }
    }
  });

  return unsubscribe;
}
```

### Ventajas

- ✅ Sincronización automática en tiempo real
- ✅ Maneja actualizaciones y eliminaciones
- ✅ No requiere código manual en cada upload

### Desventajas

- ⚠️ Requiere acceso al Firestore de ControlFile
- ⚠️ Puede generar mucho tráfico si hay muchos archivos
- ⚠️ Necesitas manejar permisos y autenticación

---

## 📊 Opción 3: Sincronización Bidireccional

**Mejor para:** Apps que también crean archivos en su propio Firestore y quieren sincronizarlos a ControlFile

### Cómo Funciona

Sincronizas en ambas direcciones:
- Archivos de ControlFile → Tu Firestore (usando Opción 1 o 2)
- Archivos de tu Firestore → ControlFile (usando APIs de ControlFile)

### Implementación

```typescript
// Subir archivo a tu propio Firestore primero
async function uploadToMyFirestore(file: File) {
  const myFileId = `my_${Date.now()}_${Math.random().toString(36)}`;
  
  // 1. Crear documento en tu Firestore
  await setDoc(doc(myDb, 'files', myFileId), {
    id: myFileId,
    userId,
    name: file.name,
    size: file.size,
    mime: file.type,
    status: 'pending',
    createdAt: new Date(),
  });

  // 2. Subir a ControlFile usando APIs
  const controlFileId = await uploadToControlFile(file);

  // 3. Actualizar tu Firestore con el ID de ControlFile
  await updateDoc(doc(myDb, 'files', myFileId), {
    controlFileId,
    bucketKey: controlFileBucketKey, // Del response de ControlFile
    status: 'synced',
    syncedAt: new Date(),
  });

  return { myFileId, controlFileId };
}
```

---

## 🔑 Puntos Clave

### Archivos Físicos

- Los archivos físicos se almacenan **una sola vez** en B2
- El `bucketKey` es la referencia única al archivo físico
- Puedes compartir el mismo `bucketKey` entre ambos Firestores

### Metadatos

- Los metadatos se almacenan en **ambos Firestores** (ControlFile + el tuyo)
- Puedes tener campos diferentes en cada uno
- Mantén una referencia cruzada usando el `fileId` de ControlFile

### Autenticación

- Usa el mismo token de Firebase Auth para ambas operaciones
- El backend de ControlFile valida el token automáticamente

---

## 📝 Ejemplo de Estructura de Datos

### En Firestore de ControlFile

```typescript
{
  id: "file_abc123",
  userId: "user_xyz",
  name: "documento.pdf",
  size: 1024000,
  mime: "application/pdf",
  bucketKey: "uploads/user_xyz/1234567890_documento.pdf",
  parentId: null,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### En Tu Propio Firestore

```typescript
{
  // Campos básicos (sincronizados)
  id: "file_abc123", // Mismo ID o referencia
  controlFileId: "file_abc123", // Referencia al ID de ControlFile
  userId: "user_xyz",
  name: "documento.pdf",
  size: 1024000,
  mime: "application/pdf",
  bucketKey: "uploads/user_xyz/1234567890_documento.pdf", // ✅ Mismo archivo
  
  // Metadatos de sincronización
  syncedAt: Timestamp,
  source: "controlfile",
  
  // Campos personalizados de tu app
  customFields: {
    category: "documentos",
    tags: ["importante", "legal"],
    // ... tus campos
  },
}
```

---

## 🚀 Recomendación Final

Para la mayoría de casos, **recomendamos la Opción 1 (Sincronización Manual)** porque:

1. ✅ No requiere acceso especial al Firestore de ControlFile
2. ✅ Te da control total sobre cuándo y qué sincronizar
3. ✅ Es más simple de implementar y mantener
4. ✅ Funciona inmediatamente sin configuración adicional

---

## ❓ Preguntas Frecuentes

### ¿Puedo tener archivos solo en mi Firestore sin ControlFile?

Sí, pero entonces no puedes usar el backend de ControlFile. Tendrías que:
- Subir archivos directamente a tu propio storage
- Manejar tu propia lógica de cuotas y permisos

### ¿Los archivos físicos se duplican?

No. Los archivos físicos se almacenan una sola vez en B2. Ambos Firestores referencian el mismo `bucketKey`.

### ¿Puedo eliminar un archivo de ControlFile sin eliminarlo de mi Firestore?

Sí, pero el archivo físico seguirá en B2 ocupando espacio. Si quieres eliminar el archivo físico, debes eliminarlo desde ControlFile o usar las APIs de B2 directamente.

### ¿Cómo manejo la cuota de almacenamiento?

La cuota se gestiona en ControlFile. Si quieres tener tu propio sistema de cuotas, puedes:
- Consultar la cuota de ControlFile via API
- Mantener tu propia contabilidad en paralelo
- Sincronizar los valores periódicamente

---

## 📚 Recursos Adicionales

- [API Reference](../../API_REFERENCE.md) - Documentación completa de APIs
- [Integración con APIs](./../api-externa/README.md) - Guía de APIs externas
- [Firestore Directo](./../firestore-directo/README.md) - Integración directa con Firestore
- [Ejemplo Completo](./ejemplo-completo.ts) - Código TypeScript listo para usar

---

## 💻 Ejemplo de Código

Puedes ver un ejemplo completo y funcional en [`ejemplo-completo.ts`](./ejemplo-completo.ts) que incluye:

- ✅ Función `uploadAndSync()` lista para usar
- ✅ Manejo de autenticación
- ✅ Sincronización automática
- ✅ Hooks para React
- ✅ Funciones de gestión (eliminar, actualizar)

---

¿Necesitas ayuda con la implementación? Contacta al equipo de ControlFile.

