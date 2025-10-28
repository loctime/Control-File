# 🔥 **Guía de Integración Directa con Firestore**

## 🎯 **Para Apps que Comparten Firestore con ControlFile**

**Si tu app comparte el mismo proyecto de Firestore que ControlFile, NO necesitas APIs. Crea directamente en Firestore.**

## 🚀 **Crear Carpeta en Taskbar (SIMPLE)**

```typescript
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const db = getFirestore();
const auth = getAuth();

export async function createTaskbarFolder(appName: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  const folderId = `${appName.toLowerCase()}-main-${Date.now()}`;
  
  const folderData = {
    id: folderId,
    userId: user.uid,
    name: appName,
    slug: appName.toLowerCase(),
    parentId: null,
    path: [],
    type: 'folder',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    metadata: {
      icon: 'Taskbar',
      color: 'text-blue-600',
      isMainFolder: true,
      isDefault: false,
      description: '',
      tags: [],
      isPublic: false,
      viewCount: 0,
      lastAccessedAt: new Date(),
      source: 'taskbar', // ✅ CLAVE: Aparece en taskbar
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true,
        canDownload: true
      },
      customFields: {}
    }
  };

  // ✅ CREAR DIRECTAMENTE EN FIRESTORE
  await setDoc(doc(db, 'files', folderId), folderData);
  
  console.log(`✅ Carpeta ${appName} creada en taskbar`);
  return folderId;
}

// Uso
await createTaskbarFolder('ControlBio');
```

## 🚀 **Crear Carpeta en Navbar (SIMPLE)**

```typescript
export async function createNavbarFolder(appName: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  const folderId = `${appName.toLowerCase()}-main-${Date.now()}`;
  
  const folderData = {
    id: folderId,
    userId: user.uid,
    name: appName,
    slug: appName.toLowerCase(),
    parentId: null,
    path: [],
    type: 'folder',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    metadata: {
      icon: 'Folder',
      color: 'text-purple-600',
      isMainFolder: true,
      isDefault: false,
      description: '',
      tags: [],
      isPublic: false,
      viewCount: 0,
      lastAccessedAt: new Date(),
      source: 'navbar', // ✅ CLAVE: Aparece en navbar
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true,
        canDownload: true
      },
      customFields: {}
    }
  };

  // ✅ CREAR DIRECTAMENTE EN FIRESTORE
  await setDoc(doc(db, 'files', folderId), folderData);
  
  console.log(`✅ Carpeta ${appName} creada en navbar`);
  return folderId;
}
```

## 🚀 **Crear Subcarpeta (SIMPLE)**

```typescript
export async function createSubFolder(name: string, parentId: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  const folderId = `${name.toLowerCase()}-${Date.now()}`;
  
  const folderData = {
    id: folderId,
    userId: user.uid,
    name: name,
    slug: name.toLowerCase(),
    parentId: parentId,
    path: [parentId], // Path de la carpeta padre
    type: 'folder',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    metadata: {
      icon: 'Folder',
      color: 'text-gray-600',
      isMainFolder: false,
      isDefault: false,
      description: '',
      tags: [],
      isPublic: false,
      viewCount: 0,
      lastAccessedAt: new Date(),
      source: 'navbar', // Subcarpetas van en navbar
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true,
        canDownload: true
      },
      customFields: {}
    }
  };

  // ✅ CREAR DIRECTAMENTE EN FIRESTORE
  await setDoc(doc(db, 'files', folderId), folderData);
  
  console.log(`✅ Subcarpeta ${name} creada`);
  return folderId;
}
```

## 🚀 **Subir Archivo (SIMPLE)**

```typescript
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const storage = getStorage();

export async function uploadFile(file: File, parentId: string | null = null): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  // 1. Subir archivo a Storage
  const fileRef = ref(storage, `files/${user.uid}/${Date.now()}-${file.name}`);
  const snapshot = await uploadBytes(fileRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);

  // 2. Crear registro en Firestore
  const fileId = `file-${Date.now()}`;
  const fileData = {
    id: fileId,
    userId: user.uid,
    name: file.name,
    slug: file.name.toLowerCase().replace(/\s+/g, '-'),
    parentId: parentId,
    path: parentId ? [parentId] : [],
    type: 'file',
    mime: file.type,
    size: file.size,
    downloadURL: downloadURL,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    metadata: {
      icon: 'File',
      color: 'text-gray-600',
      isMainFolder: false,
      isDefault: false,
      description: '',
      tags: [],
      isPublic: false,
      viewCount: 0,
      lastAccessedAt: new Date(),
      source: 'navbar',
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true,
        canDownload: true
      },
      customFields: {}
    }
  };

  // ✅ CREAR DIRECTAMENTE EN FIRESTORE
  await setDoc(doc(db, 'files', fileId), fileData);
  
  console.log(`✅ Archivo ${file.name} subido`);
  return fileId;
}
```

## 🚀 **Listar Archivos (SIMPLE)**

```typescript
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

export async function listFiles(parentId: string | null = null) {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  const q = query(
    collection(db, 'files'),
    where('userId', '==', user.uid),
    where('parentId', '==', parentId),
    where('deletedAt', '==', null),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const files = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return files;
}
```

## 🎯 **Ventajas de este Enfoque:**

1. **✅ Sin APIs** - Directo a Firestore
2. **✅ Sin complicaciones** - Estructura exacta
3. **✅ Control total** - Tu app maneja todo
4. **✅ Más rápido** - Sin API calls
5. **✅ Más simple** - Menos código
6. **✅ Más confiable** - Sin dependencias externas

## 🚀 **Configuración Requerida:**

```typescript
// firebase-config.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  // Tu configuración de Firebase
  apiKey: "tu-api-key",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "tu-app-id"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
```

---

# 🎉 **¡ESTO ES TODO!**

**No necesitas APIs, no necesitas backends, no necesitas complicaciones. Solo Firestore directo.**
