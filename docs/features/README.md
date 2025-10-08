# ✨ Documentación de Features

Esta carpeta contiene la documentación de las características y funcionalidades del sistema ControlFile.

## 📖 Features Documentadas

| Documento | Descripción | Estado |
|-----------|-------------|--------|
| **[TASKBAR_SYSTEM.md](./TASKBAR_SYSTEM.md)** | Sistema de barra de tareas con folders rápidos | ✅ Implementado |
| **[MENU_CONTEXTUAL.md](./MENU_CONTEXTUAL.md)** | Menú contextual (click derecho) en el explorador | ✅ Implementado |
| **[PAPELERA_RECICLAJE.md](./PAPELERA_RECICLAJE.md)** | Sistema de papelera de reciclaje y restauración | ✅ Implementado |
| **[NOTIFICACIONES_MEJORADAS.md](./NOTIFICACIONES_MEJORADAS.md)** | Sistema de notificaciones y toasts | ✅ Implementado |
| **[CARPETA_PRINCIPAL.md](./CARPETA_PRINCIPAL.md)** | Carpeta principal y navegación | ✅ Implementado |

## 🎯 Features por Categoría

### 🗂️ Gestión de Archivos
- **Explorador de archivos:** Navegación tipo Windows/macOS
- **Arrastrar y soltar:** Subida de archivos y movimiento
- **Selección múltiple:** Ctrl+Click, Shift+Click, Ctrl+A
- **Vista previa:** Imágenes, PDFs, videos

### 📋 Organización
- **Carpetas:** Crear, renombrar, mover, eliminar
- **Taskbar:** Acceso rápido a carpetas favoritas
- **Búsqueda:** Buscar por nombre de archivo
- **Ordenamiento:** Por nombre, fecha, tamaño, tipo

### 🗑️ Papelera
- **Eliminación suave:** Los archivos van a papelera
- **Restaurar:** Recuperar archivos eliminados
- **Limpieza automática:** Papelera se limpia después de 30 días
- **Eliminar permanente:** Borrar definitivamente desde papelera

### 🔔 Notificaciones
- **Toasts:** Notificaciones no intrusivas
- **Estados:** Success, error, warning, info
- **Persistentes:** Para errores críticos
- **Auto-dismiss:** Se ocultan automáticamente

### 🖱️ Interacciones
- **Menú contextual:** Click derecho en archivos/carpetas
- **Acciones rápidas:** Descargar, compartir, eliminar, renombrar
- **Atajos de teclado:** Ctrl+C, Ctrl+V, Delete, F2, etc.
- **Drag & Drop:** Arrastrar archivos para subir o mover

### 🔗 Compartir
- **Share links:** Enlaces públicos con expiración
- **Control de acceso:** Links pueden ser revocados
- **Contador:** Trackeo de descargas
- **Expiración:** Configurable (horas/días)

## 🚀 Uso de Features

### Taskbar
```typescript
import { useTaskbar } from '@/hooks/useTaskbar';

const { items, addItem, removeItem } = useTaskbar();
```

### Menú Contextual
```typescript
import { useContextMenuActions } from '@/hooks/useContextMenuActions';

const { handleContextMenu } = useContextMenuActions();
```

### Notificaciones
```typescript
import { toast } from 'sonner';

toast.success('Archivo subido exitosamente');
toast.error('Error al subir archivo');
```

## 🔧 Configuración

Cada feature puede tener configuración específica en:
- `lib/stores/` - Estado global con Zustand
- `hooks/` - Custom hooks para lógica de features
- `components/` - Componentes UI de cada feature

## 📊 Métricas de Features

- **Taskbar:** Hasta 10 carpetas rápidas
- **Papelera:** Retención de 30 días
- **Share links:** Expiración configurable (24h default)
- **Upload:** Archivos hasta 5GB (multipart)
- **Notificaciones:** Stack de hasta 5 toasts

## 🔗 Enlaces Relacionados

- [Documentación Técnica](../technical/) - Implementación detallada
- [API Reference](../../API_REFERENCE.md) - Endpoints de API
- [Hooks](../../hooks/) - Custom React hooks

---

**Volver a:** [📚 Documentación Principal](../README.md) | [🏠 Proyecto](../../README.md)

