# Avatares y Fotos de Perfil - ControlFile

## Descripción
Sistema para gestionar avatares y fotos de perfil de usuarios usando ControlFile como almacenamiento centralizado. Las apps externas pueden subir, obtener y mostrar avatares de forma consistente.

## 🚀 Características

- ✅ **Almacenamiento centralizado** en ControlFile
- ✅ **URLs presignadas** para acceso directo
- ✅ **Múltiples formatos** (JPG, PNG, WebP)
- ✅ **Redimensionamiento automático** (opcional)
- ✅ **Caché inteligente** para mejor rendimiento
- ✅ **Integración simple** con apps externas

## 📋 Flujo de Trabajo

### 1. Subir Avatar a ControlFile
```typescript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

// 1. Subir archivo a ControlFile
const uploadResponse = await fetch('/api/uploads/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${await user.getIdToken()}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileName: 'avatar.jpg',
    fileSize: file.size,
    mimeType: 'image/jpeg',
    parentId: null // Root folder
  })
});

const { uploadId, uploadUrl } = await uploadResponse.json();

// 2. Subir archivo a Backblaze B2
const uploadToB2 = await fetch(uploadUrl, {
  method: 'POST',
  body: file
});

// 3. Finalizar upload
const finalizeResponse = await fetch(`/api/uploads/${uploadId}/complete`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${await user.getIdToken()}`
  }
});

const { fileId } = await finalizeResponse.json();
```

### 2. Obtener URL del Avatar
```typescript
// Obtener URL presignada del avatar
const getAvatarResponse = await fetch('/api/files/presign-get', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${await user.getIdToken()}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileId: fileId
  })
});

const { downloadUrl } = await getAvatarResponse.json();

// Usar en componente
<img src={downloadUrl} alt="Avatar" className="w-10 h-10 rounded-full" />
```

### 3. Crear Share Link para Avatar
```typescript
// Crear share link público para el avatar
const shareResponse = await fetch('/api/shares/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${await user.getIdToken()}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileId: fileId,
    expiresIn: 86400 * 30 // 30 días
  })
});

const { shareUrl } = await shareResponse.json();

// URL pública que no expira por 30 días
console.log('Avatar público:', shareUrl);
```

## 🔧 Configuración

### Estructura de Carpetas Recomendada
```
/users/
  /{userId}/
    /avatar/
      - avatar.jpg (archivo principal)
      - avatar-thumb.jpg (miniatura)
    /profile/
      - cover.jpg
      - gallery/
        - photo1.jpg
        - photo2.jpg
```

### Variables de Entorno
```bash
# Configuración de avatares
AVATAR_MAX_SIZE=5242880  # 5MB
AVATAR_ALLOWED_TYPES=image/jpeg,image/png,image/webp
AVATAR_THUMBNAIL_SIZE=150x150
```

## 💡 Ejemplos de Uso

### Componente React para Avatar
```tsx
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';

interface AvatarProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  fallback?: string;
}

export function Avatar({ userId, size = 'md', fallback }: AvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const loadAvatar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Buscar avatar del usuario
        const response = await fetch(`/api/files/list?parentId=users/${userId}/avatar`, {
          headers: {
            'Authorization': `Bearer ${await user.getIdToken()}`
          }
        });

        const { items } = await response.json();
        if (items.length > 0) {
          // Obtener URL presignada
          const presignResponse = await fetch('/api/files/presign-get', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${await user.getIdToken()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fileId: items[0].id
            })
          });

          const { downloadUrl } = await presignResponse.json();
          setAvatarUrl(downloadUrl);
        }
      } catch (error) {
        console.error('Error loading avatar:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAvatar();
  }, [userId]);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  if (loading) {
    return <div className={`${sizeClasses[size]} bg-gray-200 rounded-full animate-pulse`} />;
  }

  return (
    <img
      src={avatarUrl || fallback || '/default-avatar.png'}
      alt="Avatar"
      className={`${sizeClasses[size]} rounded-full object-cover`}
    />
  );
}
```

### Hook para Gestionar Avatares
```typescript
import { useState } from 'react';
import { getAuth } from 'firebase/auth';

export function useAvatar(userId: string) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = getAuth();

  const uploadAvatar = async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');

      // 1. Iniciar upload
      const uploadResponse = await fetch('/api/uploads/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: `avatar-${Date.now()}.jpg`,
          fileSize: file.size,
          mimeType: file.type,
          parentId: `users/${userId}/avatar`
        })
      });

      const { uploadId, uploadUrl } = await uploadResponse.json();

      // 2. Subir a B2
      await fetch(uploadUrl, {
        method: 'POST',
        body: file
      });

      // 3. Finalizar
      const finalizeResponse = await fetch(`/api/uploads/${uploadId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });

      const { fileId } = await finalizeResponse.json();

      // 4. Obtener URL
      const presignResponse = await fetch('/api/files/presign-get', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileId })
      });

      const { downloadUrl } = await presignResponse.json();
      setAvatarUrl(downloadUrl);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return {
    avatarUrl,
    loading,
    error,
    uploadAvatar
  };
}
```

## 🛡️ Seguridad

- **Autenticación requerida** para subir avatares
- **Validación de tipos** de archivo (solo imágenes)
- **Límites de tamaño** configurable
- **URLs presignadas** con expiración
- **Acceso controlado** por usuario

## 📊 Casos de Uso

### 1. **Perfiles de Usuario**
- Avatares en comentarios
- Fotos de perfil en dashboards
- Identificación visual en chats

### 2. **Aplicaciones Externas**
- Mostrar avatares de usuarios de ControlFile
- Sincronización de fotos entre apps
- Gestión centralizada de imágenes

### 3. **Sistemas de Chat**
- Avatares en mensajes
- Estados de usuario
- Notificaciones con foto

## 🔄 Flujo de Integración

1. **App externa** necesita mostrar avatar
2. **Buscar en ControlFile** usando userId
3. **Obtener URL presignada** del archivo
4. **Mostrar imagen** en la interfaz
5. **Caché local** para mejor rendimiento

## 📚 Documentación Adicional

- [API Reference](../../API_REFERENCE.md) - Referencia completa de API
- [Share Links](../share-links/README.md) - Para avatares públicos
- [Imágenes Directas](../imagenes-directas/README.md) - Para mostrar imágenes