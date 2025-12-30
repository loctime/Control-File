# Papelera de Reciclaje

## Descripción

La papelera de reciclaje es una funcionalidad que permite recuperar archivos y carpetas eliminados antes de que sean eliminados permanentemente. Los elementos eliminados se mantienen en la papelera hasta que el usuario los elimine manualmente.

## Características

### ✅ Funcionalidades Implementadas

1. **Eliminación a Papelera**: Cuando eliminas un archivo o carpeta, se mueve a la papelera en lugar de eliminarse permanentemente.

2. **Vista de Papelera**: Acceso directo a la papelera desde el menú "inicio" debajo de "configuracion"

3. **Restauración**: Puedes restaurar elementos desde la papelera a su ubicación original.

4. **Eliminación Permanente**: Opción para eliminar permanentemente elementos desde la papelera.

5. **Indicadores Visuales**: 
   - Fecha de eliminación
   - Tamaño del archivo

7. **Menú Contextual**: Opciones específicas para la papelera (restaurar, eliminar permanentemente).

8. **Vaciar Papelera**: Opción para eliminar todos los elementos de la papelera de una vez.

## Cómo Usar

### Acceder a la Papelera

1. En el menú lateral, haz clic en el icono de **Papelera** (🗑️)
2. Se abrirá la vista de la papelera con todos los elementos eliminados

### Restaurar Elementos

1. Selecciona uno o varios elementos en la papelera
2. Haz clic derecho y selecciona **"Restaurar"**
3. O usa el botón **"Restaurar"** en la barra de herramientas

### Eliminar Permanentemente

1. Selecciona uno o varios elementos en la papelera
2. Haz clic derecho y selecciona **"Eliminar permanentemente"**
3. O usa el botón **"Eliminar"** en la barra de herramientas

### Vaciar la Papelera

1. En la vista de la papelera, haz clic en **"Vaciar papelera"**
2. Confirma la acción en el diálogo

## Configuración Técnica

### Persistencia
- Los elementos de la papelera se guardan en Firestore
- Se mantienen entre sesiones

### Estructura de Datos Simplificada
```typescript
interface DriveItem {
  // ... campos existentes
  deletedAt?: Date | null; // Fecha de eliminación (null = no eliminado)
}
```

## Archivos Modificados

### Archivos Principales
- `components/drive/TrashView.tsx` - Vista principal de la papelera
- `lib/stores/drive.ts` - Funciones simplificadas de papelera
- `backend/src/routes/files.js` - Endpoints simplificados
- `PAPELERA_RECICLAJE.md` - Esta documentación

## Funciones del Store

```typescript
// Mover elemento a papelera
moveToTrash(itemId: string)

// Restaurar elemento desde papelera
restoreFromTrash(itemId: string)

// Eliminar permanentemente
permanentlyDelete(itemId: string)

// Obtener elementos de la papelera
getTrashItems()

// Limpiar toda la papelera
clearTrash()

```

## Notas de Implementación

- La papelera funciona con Firestore (sincronizado)
- Requiere conexión a internet para funcionar
- Sistema simplificado sin expiración automática
- Los elementos eliminados mantienen su estructura original
- La restauración devuelve los elementos a su ubicación original
