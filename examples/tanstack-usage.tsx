// examples/tanstack-usage.tsx
// Ejemplos de cómo usar el ecosistema TanStack optimizado

import React from 'react';
import { useFiles } from '@/hooks/useFiles';
import { useFileTable } from '@/hooks/useFileTable';
import { useCreateFolderForm } from '@/hooks/useFileForm';
import { useOptimizedUpload } from '@/hooks/useOptimizedUpload';
import { FileTable } from '@/components/drive/FileTable';
import { CreateFolderForm } from '@/components/drive/CreateFolderForm';
import { FileExplorer } from '@/components/drive/FileExplorer';
import { useDriveStore } from '@/lib/stores/drive';

// Ejemplo 1: Uso básico del hook useFiles
function BasicFilesExample() {
  const { files, isLoading, error, createFolder, deleteItems } = useFiles('folder-123');

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Archivos en la carpeta</h2>
      <ul>
        {files.map(file => (
          <li key={file.id}>
            {file.name} - {file.type}
          </li>
        ))}
      </ul>
      
      <button onClick={() => createFolder.mutate('Nueva Carpeta')}>
        Crear Carpeta
      </button>
    </div>
  );
}

// Ejemplo 2: Uso de la tabla avanzada
function TableExample() {
  const {
    table,
    selectedItems,
    clearSelection,
    selectAll,
  } = useFileTable('folder-123');

  return (
    <div>
      <h2>Tabla de Archivos</h2>
      <div className="mb-4">
        <button onClick={selectAll}>Seleccionar Todo</button>
        <button onClick={clearSelection}>Limpiar Selección</button>
        <span>Seleccionados: {selectedItems.length}</span>
      </div>
      
      <FileTable
        folderId="folder-123"
        onFolderClick={(id) => console.log('Carpeta clickeada:', id)}
        onFileClick={(id) => console.log('Archivo clickeado:', id)}
        onSelectionChange={(items) => console.log('Selección cambiada:', items)}
      />
    </div>
  );
}

// Ejemplo 3: Formulario de creación de carpeta
function FormExample() {
  const { form, isSubmitting } = useCreateFolderForm('folder-123', () => {
    console.log('Carpeta creada exitosamente');
  });

  return (
    <div>
      <h2>Crear Nueva Carpeta</h2>
      <form onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}>
        <input
          value={form.state.values.name || ''}
          onChange={(e) => form.setFieldValue('name', e.target.value)}
          placeholder="Nombre de la carpeta"
          disabled={isSubmitting}
        />
        {form.state.errors && form.state.errors.length > 0 && (
          <p style={{ color: 'red' }}>Error en el nombre</p>
        )}
        
        <button type="submit" disabled={isSubmitting || !form.state.isValid}>
          {isSubmitting ? 'Creando...' : 'Crear Carpeta'}
        </button>
      </form>
    </div>
  );
}

// Ejemplo 4: Upload optimizado
function UploadExample() {
  const { uploadFiles, isUploading } = useOptimizedUpload();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFiles(files, {
        parentId: 'folder-123',
        onComplete: (results) => {
          console.log('Upload completado:', results);
        },
        onError: (error) => {
          console.error('Error en upload:', error);
        },
      });
    }
  };

  return (
    <div>
      <h2>Subir Archivos</h2>
      <input
        type="file"
        multiple
        onChange={handleFileSelect}
        disabled={isUploading}
      />
      {isUploading && <p>Subiendo archivos...</p>}
    </div>
  );
}

// Ejemplo 5: Explorador completo optimizado
function CompleteExplorerExample() {
  return (
    <div style={{ height: '100vh' }}>
      <FileExplorer />
    </div>
  );
}

// Ejemplo 6: Uso avanzado con múltiples hooks
function AdvancedExample() {
  const { files, isLoading, createFolder, deleteItems } = useFiles('folder-123');
  const { uploadFiles } = useOptimizedUpload();
  const { form: createForm } = useCreateFolderForm('folder-123');

  const handleBulkOperations = async () => {
    // Crear carpeta
    await createFolder.mutateAsync('Carpeta Masiva');
    
    // Subir archivos
    const files: File[] = [/* archivos seleccionados */];
    await uploadFiles(files, { parentId: 'folder-123' });
    
    // Eliminar archivos antiguos
    const oldFiles = files.filter(f => f.name.includes('old'));
    await deleteItems.mutateAsync(oldFiles.map(f => f.name));
  };

  return (
    <div>
      <h2>Operaciones Avanzadas</h2>
      <button onClick={handleBulkOperations}>
        Ejecutar Operaciones Masivas
      </button>
    </div>
  );
}

// Ejemplo 7: Integración con Zustand
function ZustandIntegrationExample() {
  const { files } = useFiles('folder-123');
  const { selectedItems, setSelectedItems } = useDriveStore();

  const handleSelection = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  return (
    <div>
      <h2>Integración con Zustand</h2>
      <p>Archivos seleccionados: {selectedItems.length}</p>
      {files.map(file => (
        <div key={file.id}>
          <input
            type="checkbox"
            checked={selectedItems.includes(file.id)}
            onChange={() => handleSelection(file.id)}
          />
          {file.name}
        </div>
      ))}
    </div>
  );
}

export {
  BasicFilesExample,
  TableExample,
  FormExample,
  UploadExample,
  CompleteExplorerExample,
  AdvancedExample,
  ZustandIntegrationExample,
};
