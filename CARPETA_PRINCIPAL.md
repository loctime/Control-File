# Funcionalidad de Carpeta Principal

## Descripción

Se ha agregado la funcionalidad para marcar una carpeta como "carpeta principal" en el sistema de archivos. Esta característica permite a los usuarios establecer una carpeta de referencia que será destacada visualmente y puede ser utilizada para navegación rápida.

## Características

### Botón "Principal"
- **Ubicación**: En la barra de herramientas del `FileContentArea`, junto a los botones "Nuevo" y "Ver"
- **Icono**: Estrella (Star) de Lucide React
- **Estado visual**:
  - **Normal**: Botón ghost con estrella vacía
  - **Activo**: Botón con estilo default y estrella rellena
- **Tooltip**: Muestra información contextual según el estado

### Funcionalidad
1. **Marcar como principal**: Al hacer clic en el botón, la carpeta actual se marca como carpeta principal
2. **Apertura automática**: Al marcar una carpeta como principal, automáticamente se abre esa carpeta
3. **Apertura por defecto**: Al refrescar la página, automáticamente se abre la carpeta principal
4. **Una sola carpeta principal**: Solo puede haber una carpeta principal a la vez
5. **Notificación**: Se muestra un toast de confirmación cuando se establece la carpeta principal
6. **Persistencia**: El estado se guarda en el store de Zustand

## Implementación Técnica

### Store (lib/stores/drive.ts)
```typescript
// Nuevas funciones agregadas
setMainFolder: (folderId: string) => void;
getMainFolder: () => string | null;
```

### Componente (components/drive/FileContentArea.tsx)
- Importación del icono `Star` de Lucide React
- Función `handleSetMainFolder()` para manejar la lógica
- Botón condicional que solo aparece cuando hay una carpeta seleccionada
- Integración con el sistema de notificaciones toast

### Tipos (types/index.ts)
La interfaz `DriveFolder` ya incluye el campo `metadata` con:
```typescript
metadata?: {
  icon?: string;
  color?: string;
  isMainFolder?: boolean;
  isDefault?: boolean;
};
```

## Uso

1. Navegar a cualquier carpeta en el explorador de archivos
2. Hacer clic en el botón "Principal" (estrella) en la barra de herramientas
3. La carpeta se marcará como principal, se abrirá automáticamente y se mostrará una notificación de confirmación
4. El botón cambiará su apariencia para indicar que es la carpeta principal actual
5. Al refrescar la página, automáticamente se abrirá la carpeta principal

## Beneficios

- **Navegación rápida**: Identificación visual de la carpeta más importante
- **Apertura automática**: Al marcar como principal, se abre inmediatamente
- **Persistencia**: Al refrescar la página, siempre se abre la carpeta principal
- **Organización**: Ayuda a mantener un punto de referencia en la estructura de archivos
- **UX mejorada**: Feedback visual claro sobre el estado de la carpeta
- **Flexibilidad**: Permite cambiar la carpeta principal en cualquier momento

## Consideraciones Futuras

- Integración con el breadcrumb para mostrar la carpeta principal
- Acceso rápido desde la barra lateral
- Filtros y búsquedas que prioricen la carpeta principal
- Sincronización con el backend para persistencia en la base de datos
