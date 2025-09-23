'use client';

import { useState } from 'react';
import { 
  Download, 
  Share2, 
  Edit3, 
  Copy, 
  Scissors, 
  Trash2, 
  FolderOpen,
  Info,
  FolderPlus,
  Clipboard,
  RotateCcw
} from 'lucide-react';
import { 
  ContextMenu as ContextMenuPrimitive,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuShortcut
} from '@/components/ui/context-menu';
import { DeleteConfirmModal } from '@/components/drive/DeleteConfirmModal';
import { useDriveStore } from '@/lib/stores/drive';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';

interface ContextMenuProps {
  children: React.ReactNode;
  onOpenItem?: (itemId: string) => void;
  onDownloadFile?: (itemId: string) => void;
  onShareItem?: (itemId: string) => void;
  onRenameItem?: (itemId: string) => void;
  onCopyItem?: (itemId: string) => void;
  onCutItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onShowProperties?: (itemId: string) => void;
  onCreateFolder?: () => void;
  onPasteItems?: () => void;
  onSelectAll?: () => void;
  isTrashView?: boolean;
}

export function ContextMenu({ 
  children,
  onOpenItem,
  onDownloadFile,
  onShareItem,
  onRenameItem,
  onCopyItem,
  onCutItem,
  onDeleteItem,
  onShowProperties,
  onCreateFolder,
  onPasteItems,
  onSelectAll,
  isTrashView = false
}: ContextMenuProps) {
  const { selectedItems, items, toggleItemSelection, restoreFromTrash, permanentlyDelete, moveToTrash } = useDriveStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);

  const selectedFiles = items.filter(item => selectedItems.includes(item.id));
  const hasSelection = selectedFiles.length > 0;
  const singleSelection = selectedFiles.length === 1;
  const singleFile = singleSelection && selectedFiles[0].type === 'file';
  const singleFolder = singleSelection && selectedFiles[0].type === 'folder';

  // Logs de depuración eliminados para evitar ruido en consola

  const handleOpenItem = () => {
    if (singleSelection && onOpenItem) {
      onOpenItem(selectedFiles[0].id);
    }
  };

  const handleDownloadFile = () => {
    if (singleFile && onDownloadFile) {
      onDownloadFile(selectedFiles[0].id);
    }
  };

  const handleShareItem = () => {
    if (singleSelection && onShareItem) {
      onShareItem(selectedFiles[0].id);
    }
  };

  const handleRenameItem = () => {
    if (singleSelection && onRenameItem) {
      onRenameItem(selectedFiles[0].id);
    }
  };

  const handleCopyItem = () => {
    if (hasSelection && onCopyItem) {
      selectedFiles.forEach(file => onCopyItem(file.id));
    }
  };

  const handleCutItem = () => {
    if (hasSelection && onCutItem) {
      selectedFiles.forEach(file => onCutItem(file.id));
    }
  };

  const handleDeleteItem = () => {
    if (hasSelection && selectedFiles.length > 0) {
      const count = selectedFiles.length;
      const first = selectedFiles[0];
      setItemToDelete({
        id: first.id,
        name: count === 1 ? first.name : `${first.name} +${count - 1} más`,
        type: first.type
      });
      setShowDeleteModal(true);
    }
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      if (isTrashView) {
        // En vista de papelera, eliminar permanentemente
        (async () => {
          try {
            const firebaseUser = auth?.currentUser;
            if (!firebaseUser) throw new Error('Usuario no autenticado');
            const token = await firebaseUser.getIdToken();
            const targets = hasSelection ? selectedFiles : items.filter(i => i.id === itemToDelete.id);
            const fileTargets = targets.filter(t => t.type === 'file');
            const folderTargets = targets.filter(t => t.type === 'folder');

            // Archivos
            await Promise.all(
              fileTargets.map(t =>
                fetch('/api/files/delete', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                  body: JSON.stringify({ fileId: t.id }),
                }).then(res => {
                  if (!res.ok) throw new Error('Fallo al eliminar archivo');
                  return res.json();
                })
              )
            );

            // Carpetas: eliminación recursiva desde cliente vía Firestore + endpoint de archivos
            const deleteFolderRecursively = async (folderId: string) => {
              if (!db || !firebaseUser) throw new Error('Firestore no disponible');
              const userId = firebaseUser.uid;

              // 1) Archivos dentro de la carpeta
              const filesQ = query(
                collection(db, 'files'),
                where('userId', '==', userId),
                where('parentId', '==', folderId)
              );
              const filesSnap = await getDocs(filesQ);
              await Promise.all(
                filesSnap.docs.map(async (d) => {
                  const id = d.id;
                  const res = await fetch('/api/files/delete', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ fileId: id }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error || 'Fallo al eliminar archivo');
                  }
                })
              );

              // 2) Subcarpetas
              const foldersQ = query(
                collection(db, 'folders'),
                where('userId', '==', userId),
                where('parentId', '==', folderId)
              );
              const subSnap = await getDocs(foldersQ);
              for (const sub of subSnap.docs) {
                await deleteFolderRecursively(sub.id);
              }

              // 3) Borrar carpeta
              await deleteDoc(doc(db, 'folders', folderId));
            };

            await Promise.all(folderTargets.map(t => deleteFolderRecursively(t.id)));

            // Sincronizar store local
            targets.forEach(t => permanentlyDelete(t.id));
          } catch (e) {
            console.error('❌ Error en eliminación permanente:', e);
          }
        })();
      } else {
        // En vista normal, mover a papelera
        if (hasSelection) {
          selectedFiles.forEach(item => moveToTrash(item.id));
        } else {
          moveToTrash(itemToDelete.id);
        }
      }
      setItemToDelete(null);
    }
  };

  const handleShowProperties = () => {
    if (singleSelection && onShowProperties) {
      onShowProperties(selectedFiles[0].id);
    }
  };

  // Funciones específicas de papelera
  const handleRestoreItem = () => {
    if (hasSelection) {
      selectedFiles.forEach(item => {
        restoreFromTrash(item.id);
      });
      
      // Mostrar mensaje de confirmación
      const count = selectedFiles.length;
      const message = count === 1 
        ? `"${selectedFiles[0].name}" restaurado a su ubicación original`
        : `${count} elementos restaurados a su ubicación original`;
      
      console.log('✅', message);
    }
  };

  const handlePermanentlyDelete = () => {
    if (hasSelection) {
      const count = selectedFiles.length;
      const first = selectedFiles[0];
      setItemToDelete({
        id: first.id,
        name: count === 1 ? first.name : `${first.name} +${count - 1} más`,
        type: first.type
      });
      setShowDeleteModal(true);
    }
  };

  return (
    <>
      <ContextMenuPrimitive>
        <ContextMenuTrigger className="flex-1">
          {children}
        </ContextMenuTrigger>
        
        <ContextMenuContent className="context-menu-content">
        {hasSelection ? (
          <>
            {isTrashView ? (
              // Menú específico para papelera
              <>
                <ContextMenuItem onClick={handleRestoreItem}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {singleSelection ? 'Restaurar' : `Restaurar ${selectedFiles.length} elementos`}
                </ContextMenuItem>
                
                <ContextMenuSeparator />
                
                <ContextMenuItem 
                  onClick={handlePermanentlyDelete}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar permanentemente
                </ContextMenuItem>
                
                <ContextMenuSeparator />
                
                {singleSelection && (
                  <ContextMenuItem onClick={handleShowProperties}>
                    <Info className="mr-2 h-4 w-4" />
                    Propiedades
                  </ContextMenuItem>
                )}
              </>
            ) : (
              // Menú normal para archivos/carpetas
              <>
                {singleFolder && (
                  <>
                    <ContextMenuItem onClick={handleOpenItem}>
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Abrir
                      <ContextMenuShortcut>Enter</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                )}
                
                {singleFile && (
                  <>
                    <ContextMenuItem onClick={handleDownloadFile}>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                )}
                
                <ContextMenuItem onClick={handleShareItem}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartir
                </ContextMenuItem>
                
                {singleSelection && (
                  <ContextMenuItem onClick={handleRenameItem}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Renombrar
                    <ContextMenuShortcut>F2</ContextMenuShortcut>
                  </ContextMenuItem>
                )}
                
                <ContextMenuSeparator />
                
                <ContextMenuItem onClick={handleCopyItem}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                  <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
                </ContextMenuItem>
                
                <ContextMenuItem onClick={handleCutItem}>
                  <Scissors className="mr-2 h-4 w-4" />
                  Cortar
                  <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
                </ContextMenuItem>
                
                <ContextMenuSeparator />
                
                <ContextMenuItem 
                  onClick={handleDeleteItem}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                  <ContextMenuShortcut>Del</ContextMenuShortcut>
                </ContextMenuItem>
                
                <ContextMenuSeparator />
                
                {singleSelection && (
                  <ContextMenuItem onClick={handleShowProperties}>
                    <Info className="mr-2 h-4 w-4" />
                    Propiedades
                  </ContextMenuItem>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <ContextMenuItem onClick={onCreateFolder}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Nueva carpeta
            </ContextMenuItem>
            
            <ContextMenuItem onClick={onPasteItems}>
              <Clipboard className="mr-2 h-4 w-4" />
              Pegar
              <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
            </ContextMenuItem>
            
            <ContextMenuSeparator />
            
            <ContextMenuItem onClick={onSelectAll}>
              Seleccionar todo
              <ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenuPrimitive>

    {/* Modal de confirmación de eliminación */}
    {itemToDelete && (
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        itemName={itemToDelete.name}
        itemType={itemToDelete.type}
        isFolder={itemToDelete.type === 'folder'}
        isPermanentDelete={isTrashView}
      />
    )}
  </>
  );
}
