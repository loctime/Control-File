# 🔌 **Ejemplo: App Externa - Integración con APIs**

## 🎯 **App externa que se integra con ControlFile via APIs**

### 🚀 **Código Completo:**

```typescript
import { getAuth } from 'firebase/auth';

const BACKEND_URL = 'https://controlfile.onrender.com';

async function getToken() {
  const user = getAuth().currentUser;
  if (!user) throw new Error('No autenticado');
  return user.getIdToken();
}

// 📁 CREAR CARPETA PRINCIPAL EN TASKBAR
export async function createTaskbarFolder(appName: string): Promise<string> {
  const token = await getToken();
  
  const response = await fetch(`${BACKEND_URL}/api/folders/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: `${appName.toLowerCase()}-main-${Date.now()}`,
      name: appName,
      parentId: null,
      source: 'taskbar', // ✅ CLAVE: Aparece en taskbar
      icon: 'Taskbar',
      color: 'text-blue-600',
      metadata: {
        isMainFolder: true,
        isPublic: false,
        description: `Carpeta principal de ${appName}`,
        tags: [appName.toLowerCase()],
        customFields: {
          appName: appName,
          version: '1.0.0'
        }
      }
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Error HTTP ${response.status}`);
  }
  
  const result = await response.json();
  console.log('✅ Carpeta creada en taskbar:', result.folderId);
  return result.folderId;
}

// 📁 CREAR CARPETA PRINCIPAL EN NAVBAR
export async function createNavbarFolder(appName: string): Promise<string> {
  const token = await getToken();
  
  const response = await fetch(`${BACKEND_URL}/api/folders/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: `${appName.toLowerCase()}-main-${Date.now()}`,
      name: appName,
      parentId: null,
      source: 'navbar', // ✅ CLAVE: Aparece en navbar
      icon: 'Folder',
      color: 'text-purple-600',
      metadata: {
        isMainFolder: true,
        isPublic: false,
        description: `Carpeta principal de ${appName}`,
        tags: [appName.toLowerCase()],
        customFields: {
          appName: appName,
          version: '1.0.0'
        }
      }
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Error HTTP ${response.status}`);
  }
  
  const result = await response.json();
  console.log('✅ Carpeta creada en navbar:', result.folderId);
  return result.folderId;
}

// 📁 CREAR SUBCARPETA
export async function createSubFolder(name: string, parentId: string): Promise<string> {
  const token = await getToken();
  
  const response = await fetch(`${BACKEND_URL}/api/folders/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: `${name.toLowerCase()}-${Date.now()}`,
      name: name,
      parentId: parentId,
      source: 'navbar', // Subcarpetas van en navbar
      icon: 'Folder',
      color: 'text-gray-600',
      metadata: {
        isMainFolder: false,
        isPublic: false,
        description: `Subcarpeta: ${name}`,
        tags: [name.toLowerCase()],
        customFields: {
          appName: 'App Externa',
          folderType: 'subfolder'
        }
      }
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Error HTTP ${response.status}`);
  }
  
  const result = await response.json();
  console.log('✅ Subcarpeta creada:', result.folderId);
  return result.folderId;
}

// 📤 SUBIR ARCHIVO
export async function uploadFile(file: File, parentId: string | null = null): Promise<string> {
  const token = await getToken();
  
  // 1. Crear sesión de subida
  const presignResponse = await fetch(`${BACKEND_URL}/api/uploads/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      parentId,
    }),
  });
  
  if (!presignResponse.ok) {
    const error = await presignResponse.json();
    throw new Error(error.error || 'Error al crear sesión de subida');
  }
  
  const { uploadSessionId } = await presignResponse.json();
  
  // 2. Subir archivo vía proxy
  await uploadThroughProxy(file, uploadSessionId, token);
  
  // 3. Confirmar subida
  const confirmResponse = await fetch(`${BACKEND_URL}/api/uploads/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uploadSessionId }),
  });
  
  if (!confirmResponse.ok) {
    const error = await confirmResponse.json();
    throw new Error(error.error || 'Error al confirmar subida');
  }
  
  const { fileId } = await confirmResponse.json();
  console.log('✅ Archivo subido:', fileId);
  return fileId;
}

// Subir usando proxy (evita CORS)
function uploadThroughProxy(file: File, sessionId: string, token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        console.log(`📤 Subiendo archivo: ${progress}%`);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Error HTTP ${xhr.status}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Error de red al subir archivo'));
    });
    
    xhr.open('POST', `${BACKEND_URL}/api/uploads/proxy-upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);
    
    xhr.send(formData);
  });
}

// 📥 OBTENER URL DE DESCARGA
export async function getDownloadUrl(fileId: string): Promise<string> {
  const token = await getToken();
  
  const response = await fetch(`${BACKEND_URL}/api/files/presign-get`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener URL de descarga');
  }
  
  const { downloadUrl } = await response.json();
  return downloadUrl;
}

// 📋 LISTAR ARCHIVOS
export async function listFiles(parentId: string | null = null) {
  const token = await getToken();
  const url = new URL(`${BACKEND_URL}/api/files/list`);
  url.searchParams.set('parentId', parentId === null ? 'null' : parentId);
  url.searchParams.set('pageSize', '50');
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al listar archivos');
  }
  
  const { items } = await response.json();
  return items;
}

// 🗑️ ELIMINAR ARCHIVO
export async function deleteFile(fileId: string): Promise<void> {
  const token = await getToken();
  
  const response = await fetch(`${BACKEND_URL}/api/files/delete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al eliminar archivo');
  }
  
  console.log('✅ Archivo eliminado:', fileId);
}

// 🔗 CREAR ENLACE COMPARTIDO
export async function createShareLink(fileId: string, expiresInHours: number = 24): Promise<string> {
  const token = await getToken();
  
  const response = await fetch(`${BACKEND_URL}/api/shares/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      fileId, 
      expiresIn: expiresInHours 
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al crear enlace de compartir');
  }
  
  const { shareUrl } = await response.json();
  console.log('✅ Enlace compartido creado:', shareUrl);
  return shareUrl;
}
```

## 🚀 **Uso:**

```typescript
// 1. Crear carpeta principal en taskbar
const mainFolderId = await createTaskbarFolder('Mi App Externa');

// 2. Crear subcarpeta
const subFolderId = await createSubFolder('Documentos', mainFolderId);

// 3. Subir archivo
const file = new File(['contenido'], 'documento.pdf');
const fileId = await uploadFile(file, subFolderId);

// 4. Listar archivos
const files = await listFiles(subFolderId);

// 5. Obtener URL de descarga
const downloadUrl = await getDownloadUrl(fileId);

// 6. Crear enlace compartido
const shareUrl = await createShareLink(fileId, 48); // 48 horas

// 7. Eliminar archivo
await deleteFile(fileId);
```

## 🎯 **Resultado:**

- **✅ Carpeta "Mi App Externa"** aparece en el taskbar de ControlFile
- **✅ Marco azul** (`border-blue-600`)
- **✅ Al hacer clic** navega a la carpeta
- **✅ Archivos** se pueden subir y gestionar
- **✅ Enlaces compartidos** funcionan correctamente

## ⚠️ **Consideraciones:**

- **Latencia** - API calls pueden ser más lentos
- **Dependencias** - Dependes del backend de ControlFile
- **Complejidad** - Más código y configuración
- **Mantenimiento** - Cambios en APIs pueden afectar tu app

---

# 🔌 **¡App Externa integrada con ControlFile!**



