# 👤 Guía: Avatares y Fotos de Perfil desde ControlFile

## 🎯 Caso de Uso

Tu aplicación externa necesita mostrar avatares/fotos de perfil que los usuarios suben a ControlFile. Ambas aplicaciones comparten el mismo **Firestore** y **Firebase Auth**.

## 📋 Requisitos

- ✅ Compartes el mismo proyecto de Firestore que ControlFile
- ✅ Compartes el mismo proyecto de Firebase Auth
- ✅ Tienes acceso al backend de ControlFile (para generar URLs presignadas)
- ❌ **NO** necesitas acceso directo a B2

## 🚀 Flujo Completo

### 1️⃣ **Subir Avatar a ControlFile**

```typescript
import { getAuth } from 'firebase/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

async function uploadAvatar(file: File, userId: string) {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error('Usuario no autenticado');
  
  const token = await user.getIdToken();
  
  // Paso 1: Obtener URL presignada para upload
  const presignResponse = await fetch(`${BACKEND_URL}/api/uploads/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mime: file.type,
      parentId: null // Avatar en raíz del usuario
    })
  });
  
  const { uploadSessionId, presignedUrl, fields } = await presignResponse.json();
  
  // Paso 2: Subir archivo a B2
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value as string);
  });
  formData.append('file', file);
  
  await fetch(presignedUrl, {
    method: 'POST',
    body: formData
  });
  
  // Paso 3: Confirmar upload (crea el documento en Firestore)
  const confirmResponse = await fetch(`${BACKEND_URL}/api/uploads/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uploadSessionId
    })
  });
  
  const { fileId } = await confirmResponse.json();
  
  // Paso 4: Guardar fileId en documento de usuario
  await updateDoc(doc(db, 'users', userId), {
    avatarFileId: fileId,
    updatedAt: new Date()
  });
  
  return fileId;
}
```

### 2️⃣ **Obtener URL del Avatar**

```typescript
async function getAvatarUrl(fileId: string): Promise<string | null> {
  if (!fileId) return null;
  
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error('Usuario no autenticado');
  
  const token = await user.getIdToken();
  
  // Obtener URL presignada
  const response = await fetch(`${BACKEND_URL}/api/files/presign-get`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fileId })
  });
  
  if (!response.ok) {
    console.error('Error obteniendo avatar:', await response.text());
    return null;
  }
  
  const { downloadUrl } = await response.json();
  return downloadUrl; // URL válida por 5 minutos
}
```

### 3️⃣ **Mostrar Avatar en el Frontend**

```tsx
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';

function Avatar({ userId }: { userId: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadAvatar() {
      try {
        // 1. Obtener fileId del usuario
        const userDoc = await getDoc(doc(db, 'users', userId));
        const avatarFileId = userDoc.data()?.avatarFileId;
        
        if (!avatarFileId) {
          setLoading(false);
          return;
        }
        
        // 2. Obtener URL presignada
        const url = await getAvatarUrl(avatarFileId);
        setAvatarUrl(url);
      } catch (error) {
        console.error('Error cargando avatar:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadAvatar();
  }, [userId]);
  
  if (loading) {
    return <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />;
  }
  
  if (!avatarUrl) {
    return (
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
        {userId.charAt(0).toUpperCase()}
      </div>
    );
  }
  
  return (
    <img 
      src={avatarUrl} 
      alt="Avatar"
      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
      onError={() => setAvatarUrl(null)} // Fallback si falla la carga
    />
  );
}
```

## ⚡ Optimización con Caching

Las URLs presignadas duran solo **5 minutos**. Para evitar regenerarlas constantemente:

```typescript
// Hook personalizado con cache
import { useState, useEffect, useRef } from 'react';

function useAvatarUrl(userId: string) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<{ url: string; expiresAt: number } | null>(null);
  
  useEffect(() => {
    async function loadAvatar() {
      // Verificar cache (URL válida por 5 minutos = 300 segundos)
      const now = Date.now();
      if (cacheRef.current && cacheRef.current.expiresAt > now) {
        setAvatarUrl(cacheRef.current.url);
        setLoading(false);
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const avatarFileId = userDoc.data()?.avatarFileId;
        
        if (!avatarFileId) {
          setLoading(false);
          return;
        }
        
        const url = await getAvatarUrl(avatarFileId);
        
        if (url) {
          setAvatarUrl(url);
          // Cachear por 4 minutos (antes de que expire la URL)
          cacheRef.current = {
            url,
            expiresAt: now + 4 * 60 * 1000 // 4 minutos
          };
        }
      } catch (error) {
        console.error('Error loading avatar:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadAvatar();
  }, [userId]);
  
  return { avatarUrl, loading };
}

// Uso
function UserAvatar({ userId }) {
  const { avatarUrl, loading } = useAvatarUrl(userId);
  
  // ... resto del componente
}
```

## 📚 Ejemplos Completos

### React Component con Upload

```tsx
import { useState, useRef } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export function AvatarUploader({ userId }: { userId: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen');
      return;
    }
    
    // Validar tamaño (ej: max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo es demasiado grande (máximo 5MB)');
      return;
    }
    
    setUploading(true);
    
    try {
      // Subir archivo
      const fileId = await uploadAvatar(file, userId);
      
      // Obtener URL inmediatamente
      const url = await getAvatarUrl(fileId);
      setAvatarUrl(url);
      
      alert('Avatar actualizado exitosamente');
    } catch (error) {
      console.error('Error actualizando avatar:', error);
      alert('Error al actualizar avatar');
    } finally {
      setUploading(false);
      // Limpiar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt="Avatar"
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
            Sin foto
          </div>
        )}
      </div>
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {uploading ? 'Subiendo...' : 'Cambiar foto'}
      </button>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
```

### Vanilla JavaScript

```javascript
// upload-avatar.js
async function uploadAvatar(file, userId) {
  const auth = getAuth();
  const user = auth.currentUser;
  const token = await user.getIdToken();
  
  // Obtener presigned URL
  const presignResponse = await fetch(`${BACKEND_URL}/api/uploads/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mime: file.type,
      parentId: null
    })
  });
  
  const { uploadSessionId, presignedUrl, fields } = await presignResponse.json();
  
  // Subir archivo
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  formData.append('file', file);
  
  await fetch(presignedUrl, {
    method: 'POST',
    body: formData
  });
  
  // Confirmar upload
  const confirmResponse = await fetch(`${BACKEND_URL}/api/uploads/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uploadSessionId })
  });
  
  const { fileId } = await confirmResponse.json();
  
  // Guardar en Firestore
  await setDoc(doc(db, 'users', user.uid), {
    avatarFileId: fileId,
    updatedAt: new Date()
  }, { merge: true });
  
  return fileId;
}

// Usar
const fileInput = document.getElementById('avatarInput');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const fileId = await uploadAvatar(file, currentUserId);
    console.log('Avatar subido:', fileId);
  }
});
```

### Next.js Server Component

```typescript
// app/users/[id]/page.tsx
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface User {
  id: string;
  name: string;
  avatarFileId?: string;
}

async function getUserAvatarUrl(fileId: string): Promise<string | null> {
  // En servidor, necesitas un token de servicio
  const backendUrl = process.env.BACKEND_URL;
  
  const response = await fetch(`${backendUrl}/api/files/presign-get`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SERVICE_ACCOUNT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fileId })
  });
  
  if (!response.ok) return null;
  
  const { downloadUrl } = await response.json();
  return downloadUrl;
}

export default async function UserPage({ params }: { params: { id: string } }) {
  const userDoc = await getDoc(doc(db, 'users', params.id));
  const user = { id: userDoc.id, ...userDoc.data() } as User;
  
  let avatarUrl = null;
  if (user.avatarFileId) {
    avatarUrl = await getUserAvatarUrl(user.avatarFileId);
  }
  
  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={user.name}
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-3xl font-bold">{user.name}</h1>
      </div>
    </div>
  );
}
```

## 🔐 Estructura de Datos

### Documento de Usuario en Firestore

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  avatarFileId?: string; // ID del archivo en colección 'files'
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Documento de Archivo en Firestore

```typescript
interface File {
  id: string;
  userId: string;
  name: string;
  mime: string;
  size: number;
  bucketKey: string; // Clave en B2
  type: 'file';
  parentId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}
```

## 🎨 Mejores Prácticas

### 1. **Validación de Archivos**

```typescript
function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  // Validar tipo
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Formato no permitido. Use JPG, PNG o WebP' };
  }
  
  // Validar tamaño (ej: 5MB máximo)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'El archivo es demasiado grande (máximo 5MB)' };
  }
  
  return { valid: true };
}
```

### 2. **Compresión de Imágenes**

```typescript
async function compressImage(file: File, maxWidth: number = 800): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/webp' }));
          } else {
            resolve(file);
          }
        }, 'image/webp', 0.9);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
```

### 3. **Manejo de Errores**

```typescript
async function getAvatarUrlSafe(fileId: string): Promise<string | null> {
  try {
    const url = await getAvatarUrl(fileId);
    return url;
  } catch (error) {
    console.error('Error obteniendo avatar:', error);
    
    // Reintentar una vez después de 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const url = await getAvatarUrl(fileId);
      return url;
    } catch (retryError) {
      console.error('Error en reintento:', retryError);
      return null;
    }
  }
}
```

## 🔄 Comparación de Enfoques

| Enfoque | Ventajas | Desventajas |
|---------|----------|-------------|
| **Share Links** | URLs públicas, sin auth | Expiran, contador de descargas |
| **Presign-get** (Este) | URLs privadas, control total | Requiere auth, expiran rápido |
| **B2 Directo** | URLs permanentes | Requiere acceso B2, seguridad compleja |

## 📝 Notas Importantes

1. **URLs Presignadas**: Válidas por **5 minutos**. Debes regenerarlas periódicamente.
2. **Cache Local**: Implementa cache en el frontend para evitar regenerar constantemente.
3. **Fallback**: Siempre muestra un placeholder si no hay avatar o si falla la carga.
4. **Validación**: Valida tipo y tamaño de archivo antes de subir.
5. **Compresión**: Considera comprimir imágenes grandes antes de subir.

## 🚀 Endpoints Utilizados

- **POST** `/api/uploads/presign` - Obtener URL presignada para upload
- **POST** `/api/uploads/confirm` - Confirmar upload completado
- **POST** `/api/files/presign-get` - Obtener URL presignada para descarga

## 📚 Recursos Adicionales

- [Guía de Integración Directa](./firestore-directo/README.md) - Integración con Firestore
- [API Reference](../../API_REFERENCE.md) - Documentación completa de la API
- [Share Links](./GUIA_IMAGENES_DIRECTAS.md) - Alternativa con URLs públicas

---

¿Preguntas? Abre un issue o contacta al equipo de desarrollo.

