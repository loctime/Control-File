# 🗂️ Guía: Carpetas en Taskbar con Backblaze B2

## 🎯 **Para Apps que Comparten Firestore y Usan Backblaze B2**

Esta guía es específica para apps que:
- ✅ Comparten Firestore con ControlFile
- ✅ Usan Backblaze B2 para almacenar archivos (requiere APIs)
- ✅ Necesitan crear carpetas en el taskbar
- ✅ Necesitan evitar crear carpetas duplicadas

---

## 📋 **Problema Común**

Cuando subes archivos desde tu app, siempre se crean carpetas nuevas en lugar de usar las existentes. Esto causa:
- ❌ Múltiples carpetas con el mismo nombre
- ❌ Archivos dispersos en diferentes carpetas
- ❌ Las carpetas no aparecen en el taskbar

---

## ✅ **Solución: Verificar Antes de Crear**

### **1. Verificar/Crear Carpeta Principal en Taskbar**

```typescript
import { getFirestore, collection, query, where, getDocs, getDoc, doc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const db = getFirestore();
const auth = getAuth();

/**
 * Obtiene o crea la carpeta principal de la app en el taskbar
 * ✅ Verifica existencia antes de crear
 * ✅ Evita duplicados
 * ✅ Asegura que aparezca en taskbar
 */
export async function ensureTaskbarFolder(appName: string = 'ControlAudit'): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  try {
    // 1. Buscar carpeta existente con:
    //    - userId del usuario actual
    //    - parentId = null (carpeta raíz)
    //    - name = appName (nombre exacto)
    //    - type = 'folder'
    //    - metadata.source = 'taskbar'
    const filesCol = collection(db, 'files');
    const q = query(
      filesCol,
      where('userId', '==', user.uid),
      where('parentId', '==', null),
      where('name', '==', appName),
      where('type', '==', 'folder')
    );

    const snapshot = await getDocs(q);
    
    // 2. Verificar si existe una carpeta con source: 'taskbar'
    let existingFolder = null;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.metadata?.source === 'taskbar' && !data.deletedAt) {
        existingFolder = { id: doc.id, ...data };
      }
    });

    // 3. Si existe, retornar su ID
    if (existingFolder) {
      console.log(`✅ Carpeta ${appName} encontrada en taskbar:`, existingFolder.id);
      return existingFolder.id;
    }

    // 4. Si NO existe, crear nueva carpeta con source: 'taskbar'
    const folderId = `${appName.toLowerCase()}-main-${Date.now()}`;
    const slug = appName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    
    const folderData = {
      id: folderId,
      userId: user.uid,
      name: appName,
      slug: slug,
      parentId: null,
      path: `/${slug}`,
      ancestors: [],
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
        customFields: {
          appName: appName
        }
      }
    };

    // 5. Crear directamente en Firestore
    await setDoc(doc(db, 'files', folderId), folderData);
    
    console.log(`✅ Carpeta ${appName} creada en taskbar:`, folderId);
    return folderId;
  } catch (error) {
    console.error(`❌ Error al asegurar carpeta ${appName}:`, error);
    return null;
  }
}
```

### **2. Verificar/Crear Subcarpeta**

```typescript
/**
 * Obtiene o crea una subcarpeta dentro de una carpeta padre
 * ✅ Verifica existencia antes de crear
 * ✅ Evita duplicados
 */
export async function ensureSubFolder(
  name: string,
  parentId: string
): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  try {
    // 1. Buscar subcarpeta existente
    const filesCol = collection(db, 'files');
    const q = query(
      filesCol,
      where('userId', '==', user.uid),
      where('parentId', '==', parentId),
      where('name', '==', name),
      where('type', '==', 'folder')
    );

    const snapshot = await getDocs(q);
    
    // 2. Si existe y no está eliminada, retornar su ID
    if (!snapshot.empty) {
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (!data.deletedAt) {
          console.log(`✅ Subcarpeta ${name} encontrada:`, docSnap.id);
          return docSnap.id;
        }
      }
    }

    // 3. Si NO existe, crear nueva subcarpeta
    const folderId = `${name.toLowerCase()}-${Date.now()}`;
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    
    // Obtener información de la carpeta padre para construir el path
    const parentDocRef = doc(db, 'files', parentId);
    const parentDocSnap = await getDoc(parentDocRef);
    
    let parentPath = '';
    if (parentDocSnap.exists()) {
      const parentData = parentDocSnap.data();
      parentPath = parentData.path || '';
    }

    const folderData = {
      id: folderId,
      userId: user.uid,
      name: name,
      slug: slug,
      parentId: parentId,
      path: `${parentPath}/${slug}`,
      ancestors: parentId ? [parentId] : [],
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

    await setDoc(doc(db, 'files', folderId), folderData);
    
    console.log(`✅ Subcarpeta ${name} creada:`, folderId);
    return folderId;
  } catch (error) {
    console.error(`❌ Error al crear subcarpeta ${name}:`, error);
    return null;
  }
}
```

---

## 📤 **Subir Archivos con Backblaze B2**

### **Flujo Completo: Carpeta → Subir Archivo**

```typescript
import { uploadEvidence } from './controlFileB2Service'; // Tu servicio B2

/**
 * Sube un archivo asegurando que esté en la carpeta correcta del taskbar
 */
export async function uploadFileToTaskbarFolder({
  file,
  appName = 'ControlAudit',
  subfolderName,
  auditId,
  companyId,
  seccionId,
  preguntaId,
  fecha
}: {
  file: File;
  appName?: string;
  subfolderName?: string; // Opcional: subcarpeta dentro de la carpeta principal
  auditId: string;
  companyId: string;
  seccionId?: string;
  preguntaId?: string;
  fecha?: Date | string;
}): Promise<{ fileId: string }> {
  try {
    // 1. Asegurar que existe la carpeta principal en taskbar
    const mainFolderId = await ensureTaskbarFolder(appName);
    if (!mainFolderId) {
      throw new Error(`No se pudo crear/obtener la carpeta ${appName}`);
    }

    // 2. Si hay subcarpeta, asegurar que existe
    let targetFolderId = mainFolderId;
    if (subfolderName) {
      const subFolderId = await ensureSubFolder(subfolderName, mainFolderId);
      if (subFolderId) {
        targetFolderId = subFolderId;
      }
    }

    // 3. Subir archivo usando el servicio B2 con el parentId correcto
    const { fileId } = await uploadEvidence({
      file,
      auditId,
      companyId,
      seccionId,
      preguntaId,
      fecha,
      parentId: targetFolderId // ✅ Usar la carpeta verificada/creada
    });

    console.log(`✅ Archivo subido a carpeta ${targetFolderId}:`, fileId);
    return { fileId };
  } catch (error) {
    console.error('❌ Error al subir archivo:', error);
    throw error;
  }
}

// Uso:
await uploadFileToTaskbarFolder({
  file: myFile,
  appName: 'ControlAudit',
  subfolderName: 'Auditoría 2024', // Opcional
  auditId: 'audit-123',
  companyId: 'company-456'
});
```

---

## 🔍 **Verificación: ¿Aparece en Taskbar?**

Para que una carpeta aparezca en el taskbar, debe cumplir:

1. ✅ `type: 'folder'`
2. ✅ `parentId: null` (carpeta raíz)
3. ✅ `metadata.source: 'taskbar'`
4. ✅ `deletedAt: null` (no eliminada)
5. ✅ `userId` coincide con el usuario actual

### **Función de Verificación**

```typescript
/**
 * Verifica si una carpeta aparecerá en el taskbar
 */
export async function verifyTaskbarFolder(folderId: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    const folderDocRef = doc(db, 'files', folderId);
    const folderDocSnap = await getDoc(folderDocRef);

    if (!folderDocSnap.exists()) return false;

    const folderData = folderDocSnap.data();
    
    const isTaskbarFolder = 
      folderData.type === 'folder' &&
      folderData.parentId === null &&
      folderData.metadata?.source === 'taskbar' &&
      !folderData.deletedAt &&
      folderData.userId === user.uid;

    return isTaskbarFolder;
  } catch (error) {
    console.error('Error verificando carpeta:', error);
    return false;
  }
}
```

---

## 📝 **Ejemplo Completo: ControlAudit**

```typescript
// controlAuditService.ts
import { ensureTaskbarFolder, ensureSubFolder } from './folderUtils';
import { uploadEvidence } from './controlFileB2Service';

export class ControlAuditService {
  /**
   * Sube evidencia asegurando estructura de carpetas correcta
   */
  async uploadEvidence({
    file,
    auditId,
    companyId,
    seccionId,
    preguntaId,
    fecha
  }: {
    file: File;
    auditId: string;
    companyId: string;
    seccionId?: string;
    preguntaId?: string;
    fecha?: Date | string;
  }) {
    // 1. Asegurar carpeta principal "ControlAudit" en taskbar
    const mainFolderId = await ensureTaskbarFolder('ControlAudit');
    if (!mainFolderId) {
      throw new Error('No se pudo crear/obtener carpeta ControlAudit');
    }

    // 2. Crear subcarpeta por empresa (opcional, pero recomendado)
    const companyFolderId = await ensureSubFolder(
      `Empresa ${companyId}`,
      mainFolderId
    );

    // 3. Crear subcarpeta por auditoría (opcional)
    const auditFolderId = companyFolderId 
      ? await ensureSubFolder(`Auditoría ${auditId}`, companyFolderId)
      : await ensureSubFolder(`Auditoría ${auditId}`, mainFolderId);

    // 4. Subir archivo a la carpeta correcta
    const { fileId } = await uploadEvidence({
      file,
      auditId,
      companyId,
      seccionId,
      preguntaId,
      fecha,
      parentId: auditFolderId || companyFolderId || mainFolderId
    });

    return { fileId, folderId: auditFolderId || companyFolderId || mainFolderId };
  }
}
```

---

## ⚠️ **Errores Comunes y Soluciones**

### **Error 1: Siempre crea carpetas nuevas**

**Problema:** No verifica existencia antes de crear.

**Solución:** Usar `ensureTaskbarFolder()` en lugar de `createTaskbarFolder()`.

```typescript
// ❌ MAL: Siempre crea nueva
const folderId = await createTaskbarFolder('ControlAudit');

// ✅ BIEN: Verifica antes de crear
const folderId = await ensureTaskbarFolder('ControlAudit');
```

### **Error 2: Las carpetas no aparecen en taskbar**

**Problema:** Falta `metadata.source: 'taskbar'`.

**Solución:** Asegurar que todas las carpetas principales tengan `source: 'taskbar'`.

```typescript
// ❌ MAL: Sin source o source incorrecto
metadata: {
  source: 'navbar' // No aparecerá en taskbar
}

// ✅ BIEN: Con source: 'taskbar'
metadata: {
  source: 'taskbar' // Aparecerá en taskbar
}
```

### **Error 3: Archivos en carpetas incorrectas**

**Problema:** No se pasa `parentId` al subir archivo.

**Solución:** Siempre pasar el `parentId` de la carpeta verificada/creada.

```typescript
// ❌ MAL: Sin parentId
await uploadEvidence({ file, auditId, companyId });

// ✅ BIEN: Con parentId de carpeta verificada
const folderId = await ensureTaskbarFolder('ControlAudit');
await uploadEvidence({ file, auditId, companyId, parentId: folderId });
```

---

## 📚 **Referencias**

- **[Guía Backblaze B2](./BACKBLAZE_B2_IMPLEMENTACION.md)** - Documentación completa de B2
- **[Guía Firestore Directo](./GUIA_FIRESTORE_DIRECTO.md)** - Integración directa con Firestore
- **[Sistema Taskbar](../../features/TASKBAR_SYSTEM.md)** - Cómo funciona el taskbar

---

## ✅ **Checklist de Implementación**

- [ ] Función `ensureTaskbarFolder()` implementada
- [ ] Función `ensureSubFolder()` implementada
- [ ] Verificación de existencia antes de crear
- [ ] `metadata.source: 'taskbar'` en carpetas principales
- [ ] `parentId` correcto al subir archivos
- [ ] Manejo de errores implementado
- [ ] Logs para debugging

---

**Última actualización:** Basado en el código actual de ControlFile y Backblaze B2

