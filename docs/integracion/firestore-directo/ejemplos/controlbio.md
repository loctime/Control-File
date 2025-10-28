# 🔬 **Ejemplo: ControlBio - Integración Directa**

## 🎯 **ControlBio crea carpetas en el taskbar de ControlFile**

### 🚀 **Código Completo:**

```typescript
import { getFirestore, collection, doc, setDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

// 📁 CREAR CARPETA PRINCIPAL EN TASKBAR
export async function getControlBioFolder(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  const folderId = `controlbio-main-${Date.now()}`;
  
  const folderData = {
    id: folderId,
    userId: user.uid,
    name: 'ControlBio',
    slug: 'controlbio',
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
      description: 'Análisis de datos biológicos',
      tags: ['biologia', 'analisis', 'datos'],
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
      customFields: {
        appName: 'ControlBio',
        version: '1.0.0',
        category: 'biologia'
      }
    }
  };

  // ✅ CREAR DIRECTAMENTE EN FIRESTORE
  await setDoc(doc(db, 'files', folderId), folderData);
  
  console.log('✅ Carpeta ControlBio creada en taskbar:', folderId);
  return folderId;
}

// 📤 SUBIR ARCHIVO DE ANÁLISIS
export async function uploadAnalysisFile(file: File, parentId: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  // 1. Subir archivo a Storage
  const fileRef = ref(storage, `files/${user.uid}/${Date.now()}-${file.name}`);
  const snapshot = await uploadBytes(fileRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);

  // 2. Crear registro en Firestore
  const fileId = `analysis-${Date.now()}`;
  const fileData = {
    id: fileId,
    userId: user.uid,
    name: file.name,
    slug: file.name.toLowerCase().replace(/\s+/g, '-'),
    parentId: parentId,
    path: [parentId],
    type: 'file',
    mime: file.type,
    size: file.size,
    downloadURL: downloadURL,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    metadata: {
      icon: 'File',
      color: 'text-green-600',
      isMainFolder: false,
      isDefault: false,
      description: 'Archivo de análisis biológico',
      tags: ['analisis', 'biologia', 'datos'],
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
      customFields: {
        appName: 'ControlBio',
        fileType: 'analysis',
        category: 'biologia'
      }
    }
  };

  // ✅ CREAR DIRECTAMENTE EN FIRESTORE
  await setDoc(doc(db, 'files', fileId), fileData);
  
  console.log('✅ Archivo de análisis subido:', fileId);
  return fileId;
}

// 📁 CREAR SUBCARPETA DE ANÁLISIS
export async function createAnalysisFolder(name: string, parentId: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  const folderId = `analysis-${name.toLowerCase()}-${Date.now()}`;
  
  const folderData = {
    id: folderId,
    userId: user.uid,
    name: name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    parentId: parentId,
    path: [parentId],
    type: 'folder',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    metadata: {
      icon: 'Folder',
      color: 'text-green-600',
      isMainFolder: false,
      isDefault: false,
      description: `Carpeta de análisis: ${name}`,
      tags: ['analisis', 'biologia', 'datos'],
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
      customFields: {
        appName: 'ControlBio',
        folderType: 'analysis',
        category: 'biologia'
      }
    }
  };

  // ✅ CREAR DIRECTAMENTE EN FIRESTORE
  await setDoc(doc(db, 'files', folderId), folderData);
  
  console.log('✅ Carpeta de análisis creada:', folderId);
  return folderId;
}

// 📋 LISTAR ARCHIVOS DE ANÁLISIS
export async function listAnalysisFiles(parentId: string | null = null) {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  const q = query(
    collection(db, 'files'),
    where('userId', '==', user.uid),
    where('parentId', '==', parentId),
    where('deletedAt', '==', null),
    where('metadata.customFields.appName', '==', 'ControlBio'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const files = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return files;
}

// 🔍 BUSCAR ARCHIVOS DE ANÁLISIS
export async function searchAnalysisFiles(searchTerm: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  const q = query(
    collection(db, 'files'),
    where('userId', '==', user.uid),
    where('deletedAt', '==', null),
    where('metadata.customFields.appName', '==', 'ControlBio'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const files = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Filtrar por término de búsqueda
  return files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.metadata?.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
}
```

## 🚀 **Uso:**

```typescript
// 1. Crear carpeta principal en taskbar
const mainFolderId = await getControlBioFolder();

// 2. Crear subcarpeta de análisis
const analysisFolderId = await createAnalysisFolder('Análisis Genéticos', mainFolderId);

// 3. Subir archivo de análisis
const file = new File(['contenido'], 'analisis-genetico.csv');
const fileId = await uploadAnalysisFile(file, analysisFolderId);

// 4. Listar archivos
const files = await listAnalysisFiles(analysisFolderId);

// 5. Buscar archivos
const results = await searchAnalysisFiles('genético');
```

## 🎯 **Resultado:**

- **✅ Carpeta "ControlBio"** aparece en el taskbar de ControlFile
- **✅ Marco azul** (`border-blue-600`)
- **✅ Al hacer clic** navega a la carpeta
- **✅ Archivos de análisis** se guardan en subcarpetas
- **✅ Búsqueda** funciona correctamente

---

# 🎉 **¡ControlBio integrado con ControlFile!**
