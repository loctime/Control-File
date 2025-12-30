# 🗂️ Helper Centralizado: ensureTaskbarAppFolder

## 📋 Resumen

Helper centralizado e idempotente para asegurar carpetas de apps en el taskbar **sin duplicados**.

### ✅ Características

- **🔒 ID Determinístico**: `taskbar_${appId}` - Una carpeta por usuario + app
- **✅ Idempotente**: Puede ejecutarse múltiples veces sin crear duplicados
- **🚀 Sin Queries**: No necesita verificar existencia previa (más rápido y seguro)
- **🛡️ Seguro**: Funciona con múltiples renders, retries y múltiples tabs simultáneos

## 🚀 Uso Básico

### Cliente (Firebase SDK)

```typescript
import { ensureTaskbarAppFolder } from '@/lib/utils/taskbar-folder';
import { useAuth } from '@/hooks/useAuth';

// En tu componente o hook
const { user } = useAuth();

// Asegurar carpeta de ControlAudit
const folderId = await ensureTaskbarAppFolder({
  appId: "controlaudit",
  appName: "ControlAudit",
  userId: user.uid,
  icon: "ClipboardList",
  color: "text-blue-600"
});

// Asegurar carpeta de ControlDoc
const folderId = await ensureTaskbarAppFolder({
  appId: "controldoc",
  appName: "ControlDoc",
  userId: user.uid,
  icon: "FileText",
  color: "text-purple-600"
});
```

### Servidor (Admin SDK)

```typescript
import { ensureTaskbarAppFolderServer } from '@/lib/utils/taskbar-folder';
import { requireAdminDb } from '@/lib/firebase-admin';

// En tu API route o función del servidor
const adminDb = requireAdminDb();

const folderId = await ensureTaskbarAppFolderServer({
  appId: "controlaudit",
  appName: "ControlAudit",
  userId: decodedToken.uid,
  icon: "ClipboardList",
  color: "text-blue-600",
  adminDb
});
```

## 📝 Parámetros

### `EnsureTaskbarFolderOptions`

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `appId` | `string` | ✅ Sí | ID de la app (ej: "controlaudit", "controldoc") |
| `appName` | `string` | ✅ Sí | Nombre de la app (ej: "ControlAudit", "ControlDoc") |
| `userId` | `string` | ✅ Sí | ID del usuario |
| `icon` | `string` | ❌ No | Ícono a mostrar (default: "Folder") |
| `color` | `string` | ❌ No | Color del botón (default: "text-blue-600") |

## 🔄 Migración desde Código Antiguo

### ❌ Antes (Con Queries y Timestamps)

```typescript
// ❌ PROBLEMA: Usa timestamps, crea duplicados
export async function createTaskbarFolder(appName: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  const folderId = `${appName.toLowerCase()}-main-${Date.now()}`; // ❌ ID único cada vez
  
  // ❌ Query para verificar existencia (lento, race conditions)
  const existingQuery = await getDocs(
    query(
      collection(db, 'files'),
      where('userId', '==', user.uid),
      where('name', '==', appName),
      where('metadata.source', '==', 'taskbar')
    )
  );
  
  if (!existingQuery.empty) {
    return existingQuery.docs[0].id; // ❌ Puede retornar carpeta incorrecta
  }
  
  await setDoc(doc(db, 'files', folderId), folderData); // ❌ Sin merge
  return folderId;
}
```

### ✅ Después (Con Helper Centralizado)

```typescript
// ✅ SOLUCIÓN: ID determinístico, sin queries, idempotente
import { ensureTaskbarAppFolder } from '@/lib/utils/taskbar-folder';

const folderId = await ensureTaskbarAppFolder({
  appId: "controlaudit",
  appName: "ControlAudit",
  userId: user.uid,
  icon: "ClipboardList",
  color: "text-blue-600"
});

// ✅ Siempre retorna el mismo ID: "taskbar_controlaudit"
// ✅ Puede ejecutarse múltiples veces sin crear duplicados
// ✅ Sin queries previas (más rápido)
// ✅ Seguro ante múltiples tabs/renderizados simultáneos
```

## 🎯 Casos de Uso

### 1. Inicialización de App

```typescript
// En el componente principal de tu app
useEffect(() => {
  if (!user) return;

  const initializeApp = async () => {
    try {
      // Asegurar carpeta en taskbar (idempotente)
      const folderId = await ensureTaskbarAppFolder({
        appId: "controlaudit",
        appName: "ControlAudit",
        userId: user.uid,
        icon: "ClipboardList",
        color: "text-blue-600"
      });
      
      console.log('✅ Carpeta asegurada:', folderId);
    } catch (error) {
      console.error('❌ Error asegurando carpeta:', error);
    }
  };

  initializeApp();
}, [user]);
```

### 2. Migración de Usuarios Existentes

```typescript
// Script de migración (servidor)
import { ensureTaskbarAppFolderServer } from '@/lib/utils/taskbar-folder';
import { requireAdminDb } from '@/lib/firebase-admin';

const adminDb = requireAdminDb();

async function migrateUser(userId: string) {
  // Asegurar carpetas para todas las apps
  await Promise.all([
    ensureTaskbarAppFolderServer({
      appId: "controlaudit",
      appName: "ControlAudit",
      userId,
      icon: "ClipboardList",
      color: "text-blue-600",
      adminDb
    }),
    ensureTaskbarAppFolderServer({
      appId: "controldoc",
      appName: "ControlDoc",
      userId,
      icon: "FileText",
      color: "text-purple-600",
      adminDb
    }),
  ]);
}
```

### 3. Hook Personalizado

```typescript
// hooks/useAppTaskbarFolder.ts
import { useEffect, useState } from 'react';
import { ensureTaskbarAppFolder } from '@/lib/utils/taskbar-folder';
import { useAuth } from '@/hooks/useAuth';

export function useAppTaskbarFolder(appId: string, appName: string) {
  const { user } = useAuth();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const ensureFolder = async () => {
      try {
        setIsLoading(true);
        const id = await ensureTaskbarAppFolder({
          appId,
          appName,
          userId: user.uid,
        });
        setFolderId(id);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Error desconocido'));
      } finally {
        setIsLoading(false);
      }
    };

    ensureFolder();
  }, [user, appId, appName]);

  return { folderId, isLoading, error };
}

// Uso
const { folderId, isLoading } = useAppTaskbarFolder("controlaudit", "ControlAudit");
```

## 🔍 Estructura de Datos

La carpeta creada tiene esta estructura:

```typescript
{
  id: "taskbar_controlaudit", // ID determinístico
  userId: "user123",
  name: "ControlAudit",
  slug: "controlaudit",
  parentId: null, // Siempre carpeta raíz
  path: [],
  type: "folder",
  appId: "controlaudit", // Ownership por aplicación
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt: null,
  metadata: {
    source: "taskbar", // ✅ Aparece en taskbar
    appId: "controlaudit",
    icon: "ClipboardList",
    color: "text-blue-600",
    isSystem: true, // Carpeta del sistema
    isMainFolder: false,
    isDefault: false,
    description: "Carpeta principal de ControlAudit",
    tags: [],
    isPublic: false,
    viewCount: 0,
    lastAccessedAt: Timestamp,
    permissions: {
      canEdit: true,
      canDelete: false, // No se puede eliminar
      canShare: true,
      canDownload: true,
    },
    customFields: {
      appName: "ControlAudit",
      appId: "controlaudit",
      createdBy: "ensureTaskbarAppFolder",
    },
  },
}
```

## ⚠️ Notas Importantes

1. **ID Determinístico**: El ID siempre será `taskbar_${appId}`. Si necesitas cambiar el nombre de la app, usa `merge: true` para actualizar solo el campo `name`.

2. **Sin Duplicados**: Gracias al ID determinístico y `merge: true`, nunca se crearán duplicados, incluso si se ejecuta múltiples veces.

3. **Seguridad**: La función valida que `db` esté inicializado antes de usarlo.

4. **Normalización**: El `appId` se normaliza automáticamente (lowercase, sin espacios, solo a-z, 0-9, guiones).

5. **Timestamps**: Usa `serverTimestamp()` en cliente para consistencia temporal.

## 🐛 Troubleshooting

### Error: "Firebase no está inicializado"

**Causa**: `db` es `null` (Firebase no se inicializó correctamente).

**Solución**: Verificar que Firebase esté inicializado antes de llamar a la función:

```typescript
import { db } from '@/lib/firebase';

if (!db) {
  console.error('Firebase no está inicializado');
  return;
}

await ensureTaskbarAppFolder({ ... });
```

### Error: "faltan userId o appId"

**Causa**: Parámetros requeridos no proporcionados.

**Solución**: Verificar que `userId` y `appId` estén definidos:

```typescript
if (!user?.uid) {
  console.error('Usuario no autenticado');
  return;
}

await ensureTaskbarAppFolder({
  appId: "controlaudit", // ✅ Requerido
  appName: "ControlAudit",
  userId: user.uid, // ✅ Requerido
});
```

## 📚 Referencias

- [Sistema Taskbar](./features/TASKBAR_SYSTEM.md) - Cómo funciona el taskbar
- [Guía Carpetas Taskbar](./api-externa/GUIA_CARPETAS_TASKBAR.md) - Guía completa para apps externas
- [App Ownership](./technical/app-ownership.md) - Sistema de ownership por aplicación

