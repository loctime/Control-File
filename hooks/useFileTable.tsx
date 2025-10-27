// hooks/useFileTable.ts
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  getFilteredRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
  createColumnHelper,
} from '@tanstack/react-table';
import { useState, useMemo } from 'react';
import { DriveItem } from '@/types';
import { useFiles } from './useFiles';

const columnHelper = createColumnHelper<DriveItem>();

// Definición de columnas para la tabla
export const createFileColumns = (): ColumnDef<DriveItem, any>[] => [
  columnHelper.display({
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
        className="rounded border-gray-300"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={(e) => row.toggleSelected(!!e.target.checked)}
        className="rounded border-gray-300"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor('name', {
    header: 'Nombre',
    cell: ({ getValue, row }) => {
      const name = getValue();
      const isFolder = row.original.type === 'folder';
      return (
        <div className="flex items-center space-x-2">
          <span className={`${isFolder ? 'text-blue-600' : 'text-gray-600'}`}>
            {isFolder ? '📁' : '📄'}
          </span>
          <span className="font-medium">{name}</span>
        </div>
      );
    },
  }),
  columnHelper.accessor('size', {
    header: 'Tamaño',
    cell: ({ getValue, row }) => {
      const size = getValue();
      const isFolder = row.original.type === 'folder';
      
      if (isFolder) return <span className="text-gray-400">-</span>;
      
      const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };
      
      return <span className="text-sm text-gray-600">{formatSize(size)}</span>;
    },
  }),
  columnHelper.accessor('mime', {
    header: 'Tipo',
    cell: ({ getValue, row }) => {
      const mimeType = getValue();
      const isFolder = row.original.type === 'folder';
      
      if (isFolder) return <span className="text-gray-400">Carpeta</span>;
      
      const getFileType = (mime: string) => {
        if (mime.startsWith('image/')) return 'Imagen';
        if (mime.startsWith('video/')) return 'Video';
        if (mime.startsWith('audio/')) return 'Audio';
        if (mime.includes('pdf')) return 'PDF';
        if (mime.includes('word')) return 'Word';
        if (mime.includes('excel')) return 'Excel';
        if (mime.includes('powerpoint')) return 'PowerPoint';
        return 'Archivo';
      };
      
      return <span className="text-sm text-gray-600">{getFileType(mimeType)}</span>;
    },
  }),
  columnHelper.accessor('modifiedAt', {
    header: 'Modificado',
    cell: ({ getValue }) => {
      const date = getValue();
      return (
        <span className="text-sm text-gray-600">
          {date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      );
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: 'Acciones',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex space-x-2">
          <button
            onClick={() => console.log('Download', item.id)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Descargar
          </button>
          <button
            onClick={() => console.log('Rename', item.id)}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            Renombrar
          </button>
          <button
            onClick={() => console.log('Delete', item.id)}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Eliminar
          </button>
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  }),
];

export function useFileTable(folderId: string | null = null) {
  const { files, isLoading, error } = useFiles(folderId);
  
  // Estados de la tabla
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // Columnas de la tabla
  const columns = useMemo(() => createFileColumns(), []);

  // Configuración de la tabla
  const table = useReactTable({
    data: files,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: false,
    debugTable: process.env.NODE_ENV === 'development',
  });

  // Funciones de utilidad
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedItems = selectedRows.map(row => row.original);

  const clearSelection = () => {
    table.toggleAllPageRowsSelected(false);
  };

  const selectAll = () => {
    table.toggleAllPageRowsSelected(true);
  };

  const toggleRowSelection = (rowId: string) => {
    const row = table.getRow(rowId);
    if (row) {
      row.toggleSelected();
    }
  };

  return {
    // Tabla
    table,
    columns,
    
    // Estados
    isLoading,
    error,
    
    // Selección
    selectedRows,
    selectedItems,
    clearSelection,
    selectAll,
    toggleRowSelection,
    
    // Paginación
    pagination,
    setPagination,
    
    // Filtros
    columnFilters,
    setColumnFilters,
    
    // Ordenamiento
    sorting,
    setSorting,
    
    // Visibilidad de columnas
    columnVisibility,
    setColumnVisibility,
  };
}
