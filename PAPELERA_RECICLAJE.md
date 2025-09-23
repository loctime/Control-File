# Papelera de Reciclaje

## Descripción

La papelera de reciclaje es una funcionalidad que permite recuperar archivos y carpetas eliminados antes de que sean eliminados permanentemente. Los elementos eliminados se mantienen en la papelera por 1 semana antes de ser eliminados automáticamente.

## Características

### ✅ Funcionalidades Implementadas

1. **Eliminación a Papelera**: Cuando eliminas un archivo o carpeta, se mueve a la papelera en lugar de eliminarse permanentemente.

2. **Vista de Papelera**: Acceso directo a la papelera desde el menú "inicio" debajo de "configuracion"

3. **Restauración**: Puedes restaurar elementos desde la papelera a su ubicación original.

4. **Eliminación Permanente**: Opción para eliminar permanentemente elementos desde la papelera.

5. **Limpieza Automática**: Los elementos se eliminan automáticamente después de 1 semana.

6. **Indicadores Visuales**: 
   - Días restantes hasta la expiración
   - Estados de expiración (normal, pronto, hoy, expirado)
   - Iconos de advertencia para elementos próximos a expirar

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

## Estados de Expiración

- **Normal**: Más de 3 días restantes
- **Pronto**: 1-3 días restantes (icono amarillo)
- **Hoy**: Expira hoy (icono naranja)
- **Expirado**: Ya expiró (icono rojo, opacidad reducida)

## Configuración Técnica

### Persistencia
- Los elementos de la papelera se guardan en el almacenamiento local del navegador
- Se mantienen entre sesiones

### Limpieza Automática
- Se ejecuta cada hora automáticamente
- Elimina elementos que han expirado (más de 1 semana)
- Se ejecuta al cargar la aplicación

### Estructura de Datos
```typescript
interface DriveItem {
  // ... campos existentes
  deletedAt?: Date;        // Fecha de eliminación
  expiresAt?: Date;        // Fecha de expiración (1 semana después)
  originalPath?: string;   // Ruta original antes de eliminar
}
```

## Archivos Modificados

### Nuevos Archivos
- `components/drive/TrashView.tsx` - Vista principal de la papelera
- `components/common/TrashCleanupInitializer.tsx` - Inicializador de limpieza automática
- `lib/trash-cleanup.ts` - Utilidades para la limpieza de la papelera
- `PAPELERA_RECICLAJE.md` - Esta documentación

### Archivos Modificados
- `types/index.ts` - Agregados campos para papelera
- `lib/stores/drive.ts` - Agregadas funciones de papelera
- `components/drive/ContextMenu.tsx` - Agregadas opciones de papelera
- `components/drive/DeleteConfirmModal.tsx` - Mejorado para papelera
- `components/drive/Sidebar.tsx` - Agregado botón de papelera
- `components/drive/FileExplorer.tsx` - Integrada vista de papelera
- `app/layout.tsx` - Agregado inicializador de limpieza

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

// Limpiar elementos expirados
cleanupExpiredTrash()
```

## Notas de Implementación

- La papelera funciona completamente en el cliente (localStorage)
- No requiere conexión a internet para funcionar
- Los elementos eliminados mantienen su estructura original
- La restauración devuelve los elementos a su ubicación original
- La limpieza automática es silenciosa y no interrumpe al usuario
