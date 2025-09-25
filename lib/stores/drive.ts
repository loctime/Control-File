import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from '@/lib/stores/auth';
import { apiCall } from '@/lib/utils';
import { DriveItem, ViewMode, BreadcrumbItem, SearchFilters } from '@/types';

interface DriveState {
  items: any[];
  selectedItems: string[];
  currentFolderId: string | null;
  breadcrumb: BreadcrumbItem[];
  viewMode: ViewMode;
  searchFilters: SearchFilters;
  loading: boolean;
  error: string | null;
  
  // Actions
  setItems: (items: any[]) => void;
  setSelectedItems: (items: string[]) => void;
  toggleItemSelection: (itemId: string, multi?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setCurrentFolder: (folderId: string | null, breadcrumb: BreadcrumbItem[]) => void;
  initializeDefaultFolder: () => void;
  setViewMode: (mode: Partial<ViewMode>) => void;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Item operations
  updateItem: (itemId: string, updates: Partial<any>) => void;
  removeItem: (itemId: string) => void;
  addItem: (item: any) => void;
  
  // Folder operations
  createMainFolder: (name: string, icon: string, color: string) => string;
  createSubfolder: (name: string, parentId: string) => void;
  getMainFolders: () => any[];
  getSubfolders: (parentId: string) => any[];
  setMainFolder: (folderId: string) => void;
  getMainFolder: () => string | null;
  
  // Trash operations
  moveToTrash: (itemId: string) => void;
  restoreFromTrash: (itemId: string) => void;
  permanentlyDelete: (itemId: string) => void;
  getTrashItems: () => any[];
  clearTrash: () => void;
  cleanupExpiredTrash: () => number;
}

export const useDriveStore = create<DriveState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      selectedItems: [],
      currentFolderId: null,
      breadcrumb: [],
      viewMode: {
        type: 'grid',
        size: 'medium',
        showDetails: false,
        sortBy: 'name',
        sortOrder: 'asc'
      },
      searchFilters: {
        query: '',
        type: 'all',
        dateRange: null,
        sizeRange: null
      },
      loading: false,
      error: null,

      // Actions
      setItems: (items) => set({ items }),
      setSelectedItems: (items) => 
        set((state) => {
          // Filtrar elementos que no existen
          const validItems = items.filter(itemId => {
            const item = state.items.find(i => i.id === itemId);
            return item !== undefined;
          });
          return { selectedItems: validItems };
        }),
      toggleItemSelection: (itemId, multi = false) =>
        set((state) => {
          const item = state.items.find(i => i.id === itemId);
          if (!item) return state;
          
          if (multi) {
            const isSelected = state.selectedItems.includes(itemId);
            return {
              selectedItems: isSelected
                ? state.selectedItems.filter(id => id !== itemId)
                : [...state.selectedItems, itemId]
            };
          } else {
            return { selectedItems: [itemId] };
          }
        }),
      selectAll: () =>
        set((state) => {
          // Si estamos en una carpeta específica, seleccionar solo elementos de esa carpeta
          if (state.currentFolderId) {
            return {
              selectedItems: state.items
                .filter(item => 
                  !item.deletedAt && // Excluir elementos en la papelera
                  item.parentId === state.currentFolderId // Solo elementos de la carpeta actual
                )
                .map(item => item.id)
            };
          }
          
          // Si no hay carpeta actual, seleccionar solo archivos en la raíz (no carpetas principales)
          return {
            selectedItems: state.items
              .filter(item => 
                !item.deletedAt && // Excluir elementos en la papelera
                !item.metadata?.isMainFolder && // Excluir carpetas principales del navbar
                item.parentId === null // Solo elementos en la raíz
              )
              .map(item => item.id)
          };
        }),
      clearSelection: () => set({ selectedItems: [] }),
      setCurrentFolder: (folderId, breadcrumb) =>
        set({ currentFolderId: folderId, breadcrumb }),
      initializeDefaultFolder: () =>
        set((state) => {
          // Solo inicializar si no hay carpeta actual
          if (state.currentFolderId === null) {
            // Buscar si hay una carpeta principal configurada
            const mainFolder = state.items.find(item => 
              item.type === 'folder' && 
              item.metadata?.isMainFolder && 
              !item.deletedAt
            );
            
            if (mainFolder) {
              // Si hay una carpeta principal, abrirla automáticamente
              console.log('📁 Abriendo carpeta principal por defecto:', mainFolder.name);
              return {
                currentFolderId: mainFolder.id,
                breadcrumb: [{ id: mainFolder.id, name: mainFolder.name, path: mainFolder.path, slug: mainFolder.slug }]
              };
            } else {
              // Si no hay carpeta principal, mantener el estado actual
              return {
                currentFolderId: null,
                breadcrumb: []
              };
            }
          }
          return state;
        }),
      setViewMode: (mode) =>
        set((state) => ({
          viewMode: { ...state.viewMode, ...mode }
        })),
      setSearchFilters: (filters) =>
        set((state) => ({
          searchFilters: { ...state.searchFilters, ...filters }
        })),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      // Item operations
      updateItem: (itemId, updates) =>
        set((state) => ({
          items: state.items.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
          )
        })),
      removeItem: (itemId) =>
        set((state) => ({
          items: state.items.filter(item => item.id !== itemId)
        })),
      addItem: (item) =>
        set((state) => ({
          items: [...state.items, item]
        })),

      // Folder operations
      createMainFolder: (name, icon, color) => {
        const currentUserId = useAuthStore.getState().user?.uid || 'anonymous';
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        const newFolder = {
          id: `main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: currentUserId,
          name,
          slug: slug,
          parentId: null,
          path: `/${slug}`,
          createdAt: new Date(),
          modifiedAt: new Date(),
          type: 'folder',
          metadata: {
            icon,
            color,
            isMainFolder: true,
            isDefault: false,
            description: '',
            tags: [],
            isPublic: false,
            viewCount: 0,
            lastAccessedAt: new Date(),
            permissions: {
              canEdit: true,
              canDelete: true,
              canShare: true,
              canDownload: true
            },
            customFields: {}
          }
        };
        
        console.log('📁 Creando carpeta principal:', newFolder);
        
        // Persistir en backend/Firestore
        (async () => {
          try {
            await apiCall('/folders/create', {
              method: 'POST',
              body: JSON.stringify({
                id: newFolder.id,
                name: newFolder.name,
                parentId: newFolder.parentId,
                icon: newFolder.metadata.icon,
                color: newFolder.metadata.color,
              }),
            });
          } catch (error) {
            console.error('❌ Error persistiendo carpeta principal:', error);
          }
        })();

        set((state) => ({
          items: [...state.items, newFolder]
        }));
        
        return newFolder.id;
      },

      getMainFolders: () => {
        const state = get();
        const currentUserId = useAuthStore.getState().user?.uid;
        if (!currentUserId) return [];
        // Obtener carpetas personalizadas del store
        const customFolders = state.items.filter(item => 
          item.type === 'folder' && 
          item.parentId === null &&
          item.metadata?.isMainFolder && 
          !item.metadata?.isDefault &&
          item.userId === currentUserId &&
          !item.deletedAt // Excluir carpetas principales eliminadas
        ).map(item => ({
          id: item.id,
          name: item.name,
          icon: item.metadata?.icon || 'Folder',
          color: item.metadata?.color || '#6b7280'
        }));

        return customFolders;
      },

      createSubfolder: (name, parentId) =>
        set((state) => {
          const currentUserId = useAuthStore.getState().user?.uid || 'anonymous';
          const newSubfolder = {
            id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: currentUserId,
            name,
            parentId,
            path: `/${name.toLowerCase().replace(/\s+/g, '-')}`,
            createdAt: new Date(),
            modifiedAt: new Date(),
            type: 'folder',
            metadata: {
              icon: 'Folder',
              color: 'text-blue-500',
              isMainFolder: false,
              isDefault: false
            }
          };
          
          console.log('📁 Creando subcarpeta:', newSubfolder);
          
          // Persistir en backend/Firestore
          (async () => {
            try {
              await apiCall('/folders/create', {
                method: 'POST',
                body: JSON.stringify({
                  id: newSubfolder.id,
                  name: newSubfolder.name,
                  parentId: newSubfolder.parentId,
                  icon: newSubfolder.metadata.icon,
                  color: newSubfolder.metadata.color,
                }),
              });
            } catch (error) {
              console.error('❌ Error persistiendo subcarpeta:', error);
            }
          })();

          return {
            items: [...state.items, newSubfolder]
          };
        }),

      getSubfolders: (parentId) => {
        const state = get();
        const currentUserId = useAuthStore.getState().user?.uid;
        if (!currentUserId) return [];
        return state.items.filter(item => 
          item.type === 'folder' && 
          item.parentId === parentId &&
          item.userId === currentUserId &&
          !item.deletedAt // Excluir elementos en la papelera
        );
      },

      setMainFolder: (folderId) =>
        set((state) => {
          // Primero, quitar el estado de carpeta principal de todas las carpetas
          const updatedItems = state.items.map(item => {
            if (item.type === 'folder' && item.metadata?.isMainFolder) {
              return {
                ...item,
                metadata: {
                  ...item.metadata,
                  isMainFolder: false
                }
              };
            }
            return item;
          });

          // Luego, marcar la carpeta seleccionada como principal
          const finalItems = updatedItems.map(item => {
            if (item.id === folderId && item.type === 'folder') {
              return {
                ...item,
                metadata: {
                  ...item.metadata,
                  isMainFolder: true
                }
              };
            }
            return item;
          });

          // Obtener la carpeta que se está marcando como principal
          const mainFolder = finalItems.find(item => item.id === folderId);

          console.log('📁 Estableciendo carpeta principal:', folderId);
          
          return {
            items: finalItems,
            // Automáticamente abrir la carpeta principal
            currentFolderId: folderId,
            breadcrumb: mainFolder ? [{ id: mainFolder.id, name: mainFolder.name, path: mainFolder.path, slug: mainFolder.slug }] : []
          };
        }),

      getMainFolder: () => {
        const state = get();
        const mainFolder = state.items.find(item => 
          item.type === 'folder' && 
          item.metadata?.isMainFolder && 
          !item.deletedAt
        );
        return mainFolder ? mainFolder.id : null;
      },

      // Trash operations
      moveToTrash: (itemId) =>
        set((state) => {
          const item = state.items.find(i => i.id === itemId);
          if (!item) return state;

          const now = new Date();
          const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 semana

          const updatedItem = {
            ...item,
            deletedAt: now,
            expiresAt: expiresAt,
            originalPath: item.path
          };

          console.log('🗑️ Moviendo a papelera:', updatedItem);

          return {
            items: state.items.map(i => i.id === itemId ? updatedItem : i),
            selectedItems: state.selectedItems.filter(id => id !== itemId) // Limpiar selección del elemento movido
          };
        }),

      restoreFromTrash: (itemId) =>
        set((state) => {
          const item = state.items.find(i => i.id === itemId);
          if (!item || !item.deletedAt) return state;

          // Restaurar el elemento a su ubicación original
          const restoredItem = {
            ...item,
            deletedAt: undefined,
            expiresAt: undefined,
            // Mantener la ruta original si existe, sino usar la actual
            path: item.originalPath || item.path,
            originalPath: undefined
          };

          console.log('🔄 Restaurando desde papelera:', restoredItem);

          return {
            items: state.items.map(i => i.id === itemId ? restoredItem : i),
            selectedItems: state.selectedItems.filter(id => id !== itemId) // Limpiar selección del elemento restaurado
          };
        }),

      permanentlyDelete: (itemId) =>
        set((state) => {
          console.log('🗑️ Eliminando permanentemente:', itemId);
          return {
            items: state.items.filter(item => item.id !== itemId),
            selectedItems: state.selectedItems.filter(id => id !== itemId)
          };
        }),

      getTrashItems: () => {
        const state = get();
        const currentUserId = useAuthStore.getState().user?.uid;
        if (!currentUserId) return [];
        return state.items.filter(item => item.deletedAt && item.userId === currentUserId);
      },

      clearTrash: () =>
        set((state) => {
          const trashItems = state.items.filter(item => item.deletedAt);
          console.log('🗑️ Vaciamiento papelera:', trashItems.length, 'elementos');
          
          return {
            items: state.items.filter(item => !item.deletedAt),
            selectedItems: []
          };
        }),

      cleanupExpiredTrash: () => {
        const state = get();
        const now = new Date();
        const expiredItems = state.items.filter(item => 
          item.deletedAt && 
          item.expiresAt && 
          new Date(item.expiresAt) <= now
        );

        if (expiredItems.length > 0) {
          console.log(`🗑️ Limpiando ${expiredItems.length} elementos expirados`);
          
          set((state) => ({
            items: state.items.filter(item => 
              !item.deletedAt || 
              !item.expiresAt || 
              new Date(item.expiresAt) > now
            ),
            selectedItems: state.selectedItems.filter(id => {
              const item = state.items.find(i => i.id === id);
              return item && (!item.deletedAt || !item.expiresAt || new Date(item.expiresAt) > now);
            })
          }));
        }

        return expiredItems.length;
      }
    }),
    {
      name: 'drive-storage',
      partialize: (state) => ({
        items: state.items,
        viewMode: state.viewMode,
        searchFilters: state.searchFilters
      })
    }
  )
);
