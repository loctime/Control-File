'use client';

import { useState, useMemo, useCallback } from 'react';
import { useDriveStore } from '@/lib/stores/drive';
import { ContextMenu } from '@/components/drive/ContextMenu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Folder, File, Trash2, RotateCcw, Clock, AlertTriangle } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import { DeleteConfirmModal } from '@/components/drive/DeleteConfirmModal';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';

interface TrashViewProps {
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
}

export function TrashView({
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
  onSelectAll
}: TrashViewProps) {
  const { 
    selectedItems, 
    items, 
    toggleItemSelection, 
    restoreFromTrash, 
    permanentlyDelete,
    clearTrash,
    getTrashItems,
    setSelectedItems,
    clearSelection,
  } = useDriveStore();

  const trashItems = getTrashItems();

  // Estado para selección por rango con Shift
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);

  // Lista lineal para cálculo de rangos en el mismo orden visual de render
  const linearItems = useMemo(() => {
    return trashItems.map((i: any) => ({ id: i.id }));
  }, [trashItems]);

  const handleShiftRangeSelect = useCallback((targetIndex: number) => {
    if (anchorIndex === null) {
      setAnchorIndex(targetIndex);
      const onlyTarget = linearItems[targetIndex]?.id ? [linearItems[targetIndex].id] : [];
      setSelectedItems(onlyTarget);
      return;
    }
    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    const rangeIds = linearItems.slice(start, end + 1).map(i => i.id);
    setSelectedItems(rangeIds);
  }, [anchorIndex, linearItems, setSelectedItems]);

  const handleSetAnchor = useCallback((idx: number) => {
    setAnchorIndex(idx);
  }, []);

  const handleItemClick = (e: React.MouseEvent, itemIndex: number, itemId: string) => {
    e.preventDefault();
    if (e.shiftKey) {
      handleShiftRangeSelect(itemIndex);
      return;
    }
    if (e.ctrlKey || (e as any).metaKey) {
      toggleItemSelection(itemId, true);
      handleSetAnchor(itemIndex);
    } else {
      toggleItemSelection(itemId, false);
      handleSetAnchor(itemIndex);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, isSelected: boolean, itemId: string) => {
    if (!isSelected) {
      toggleItemSelection(itemId, false);
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      clearSelection();
    }
  };

  // Modal de confirmación para eliminar permanentemente
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalItemName, setDeleteModalItemName] = useState<string>('');

  // Calcular días restantes para un elemento
  const getDaysLeft = (item: any) => {
    if (!item.expiresAt) return null;
    const expiresDate = new Date(item.expiresAt);
    const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 ? daysLeft : 0;
  };

  // Obtener el estado de expiración
  const getExpirationStatus = (item: any) => {
    const daysLeft = getDaysLeft(item);
    if (daysLeft === null) return 'unknown';
    if (daysLeft <= 0) return 'expired';
    if (daysLeft <= 1) return 'today';
    if (daysLeft <= 3) return 'soon';
    return 'normal';
  };

  // Restaurar elementos seleccionados
  const handleRestoreSelected = () => {
    const selectedTrashItems = trashItems.filter(item => selectedItems.includes(item.id));
    selectedTrashItems.forEach(item => restoreFromTrash(item.id));
    
    // Mostrar mensaje de confirmación
    const count = selectedTrashItems.length;
    const message = count === 1 
      ? `"${selectedTrashItems[0].name}" restaurado a su ubicación original`
      : `${count} elementos restaurados a su ubicación original`;
    
    console.log('✅', message);
  };

  // Eliminar permanentemente elementos seleccionados
  const handleDeleteSelected = () => {
    const selectedTrashItems = trashItems.filter(item => selectedItems.includes(item.id));
    if (selectedTrashItems.length === 0) return;
    const count = selectedTrashItems.length;
    const name = count === 1 
      ? selectedTrashItems[0].name 
      : `${selectedTrashItems[0].name} +${count - 1} más`;
    setDeleteModalItemName(name);
    setDeleteModalOpen(true);
  };

  const handleConfirmPermanentDelete = () => {
    const selectedTrashItems = trashItems.filter(item => selectedItems.includes(item.id));
    const filesToDelete = selectedTrashItems.filter(item => item.type === 'file');
    const foldersToDelete = selectedTrashItems.filter(item => item.type === 'folder');
    (async () => {
      try {
        const firebaseUser = auth?.currentUser;
        if (!firebaseUser) throw new Error('Usuario no autenticado');
        const token = await firebaseUser.getIdToken();

        // Eliminar archivos
        await Promise.all(
          filesToDelete.map(async (item) => {
            try {
              const res = await fetch('/api/files/delete', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ fileId: item.id }),
              });
              if (!res.ok) throw new Error('server-failed');
              await res.json().catch(() => ({}));
            } catch (_) {
              // Fallback: borrar doc en Firestore
              try {
                const fdb = db as any;
                await deleteDoc(doc(fdb, 'files', item.id));
              } catch (_) {}
            }
          })
        );

        // Eliminar carpetas
        await Promise.all(
          foldersToDelete.map(item =>
            fetch('/api/folders/permanent-delete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ folderId: item.id }),
            }).then(res => {
              if (!res.ok) throw new Error('Fallo al eliminar carpeta');
              return res.json();
            })
          )
        );

        // Actualizar store local
        selectedTrashItems.forEach(item => permanentlyDelete(item.id));
      } catch (e) {
        console.error('❌ Error en eliminación permanente:', e);
      } finally {
        setDeleteModalOpen(false);
      }
    })();
  };

  // Limpiar toda la papelera
  const handleClearTrash = () => {
    if (!confirm('¿Estás seguro de que quieres vaciar toda la papelera? Esta acción no se puede deshacer.')) {
      return;
    }

    const trash = getTrashItems();
    const filesToDelete = trash.filter((item: any) => item.type === 'file');
    const foldersToDelete = trash.filter((item: any) => item.type === 'folder');

    (async () => {
      try {
        const firebaseUser = auth?.currentUser;
        if (!firebaseUser) throw new Error('Usuario no autenticado');
        const token = await firebaseUser.getIdToken();

        // Eliminar archivos en servidor si hay
        if (filesToDelete.length > 0) {
          try {
            const res = await fetch('/api/files/empty-trash', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ fileIds: filesToDelete.map((f: any) => f.id) }),
            });
            if (!res.ok) throw new Error('server-failed');
            const data = await res.json();
            const deletedIds: string[] = data.deletedIds || [];
            deletedIds.forEach(id => permanentlyDelete(id));
          } catch (_) {
            // Fallback: borrar docs individualmente
            const fdb = db as any;
            await Promise.all(
              filesToDelete.map(async (f: any) => {
                try { await deleteDoc(doc(fdb, 'files', f.id)); } catch (_) {}
                permanentlyDelete(f.id);
              })
            );
          }
        }

        // Eliminar carpetas recursivamente desde Firestore
        if (foldersToDelete.length > 0) {
          const firebaseUser = auth?.currentUser;
          if (!db || !firebaseUser) throw new Error('Firestore no disponible');
          const fdb = db as any; // asegurar tipo en tiempo de compilación
          const userId = firebaseUser.uid;

          const deleteFolderRecursively = async (folderId: string) => {
            // 1) Archivos
            const filesQ = query(
              collection(fdb, 'files'),
              where('userId', '==', userId),
              where('parentId', '==', folderId)
            );
            const filesSnap = await getDocs(filesQ);
            await Promise.all(
              filesSnap.docs.map(async (d) => {
                const id = d.id;
                try {
                  const res = await fetch('/api/files/delete', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ fileId: id }),
                  });
                  if (!res.ok) throw new Error('server-failed');
                } catch (_) {
                  try { await deleteDoc(doc(fdb, 'files', id)); } catch (_) {}
                }
              })
            );

            // 2) Subcarpetas
            const foldersQ = query(
              collection(fdb, 'folders'),
              where('userId', '==', userId),
              where('parentId', '==', folderId)
            );
            const subSnap = await getDocs(foldersQ);
            for (const sub of subSnap.docs) {
              await deleteFolderRecursively(sub.id);
            }

            // 3) Borrar carpeta
            try {
              await deleteDoc(doc(fdb, 'folders', folderId));
            } catch (err) {
              console.warn('No se pudo borrar carpeta en Firestore (permiso):', folderId, err);
            }
          };

          await Promise.all(
            foldersToDelete.map((folder: any) => deleteFolderRecursively(folder.id))
          );
          foldersToDelete.forEach((folder: any) => permanentlyDelete(folder.id));
        }
      } catch (e) {
        console.error('❌ Error al vaciar la papelera:', e);
      }
    })();
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header de la papelera */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <Trash2 className="w-6 h-6 text-red-500" />
          <div>
            <h1 className="text-lg font-semibold">Papelera de reciclaje</h1>
            <p className="text-sm text-muted-foreground">
              {trashItems.length} elemento{trashItems.length !== 1 ? 's' : ''} en la papelera
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {selectedItems.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestoreSelected}
                className="flex items-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restaurar</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                className="flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar</span>
              </Button>
            </>
          )}
          {trashItems.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearTrash}
              className="flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Vaciar papelera</span>
            </Button>
          )}
        </div>
      </div>

      {/* Contenido de la papelera */}
      <div className="flex-1 overflow-y-auto p-4" onClick={handleBackgroundClick}>
        {trashItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {trashItems.map((item, index) => {
              const isSelected = selectedItems.includes(item.id);
              const daysLeft = getDaysLeft(item);
              const expirationStatus = getExpirationStatus(item);
              
              return (
                <ContextMenu
                  key={item.id}
                  onOpenItem={onOpenItem}
                  onRenameItem={onRenameItem}
                  onCopyItem={onCopyItem}
                  onCutItem={onCutItem}
                  onDeleteItem={onDeleteItem}
                  onShareItem={onShareItem}
                  onShowProperties={onShowProperties}
                  onCreateFolder={onCreateFolder}
                  onPasteItems={onPasteItems}
                  onSelectAll={onSelectAll}
                  isTrashView={true}
                >
                  <div
                    className={`
                      flex flex-col p-4 rounded-lg border cursor-pointer
                      hover:bg-accent/50 transition-colors group relative
                      ${isSelected ? 'bg-accent border-primary' : 'border-border'}
                      ${expirationStatus === 'expired' ? 'opacity-50' : ''}
                    `}
                    onClick={(e) => handleItemClick(e, index, item.id)}
                    onContextMenu={(e) => handleContextMenu(e, isSelected, item.id)}
                  >
                    {/* Icono */}
                    <div className="flex items-center justify-center mb-3">
                      {item.type === 'folder' ? (
                        <Folder className="w-12 h-12 text-yellow-500" />
                      ) : (
                        <File className="w-12 h-12 text-blue-500" />
                      )}
                    </div>

                    {/* Nombre */}
                    <div className="text-center mb-2">
                      <p className="text-sm font-medium truncate" title={item.name}>
                        {item.name}
                      </p>
                    </div>

                    {/* Información adicional */}
                    <div className="text-center space-y-1">
                      {item.size && (
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(item.size)}
                        </p>
                      )}
                      
                      {/* Ubicación original */}
                      {item.originalPath && (
                        <p className="text-xs text-muted-foreground" title={`Ubicación original: ${item.originalPath}`}>
                          📁 {item.originalPath.split('/').pop() || 'Raíz'}
                        </p>
                      )}
                      
                      {/* Estado de expiración */}
                      <div className="flex items-center justify-center space-x-1">
                        {expirationStatus === 'expired' && (
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                        )}
                        {expirationStatus === 'today' && (
                          <Clock className="w-3 h-3 text-orange-500" />
                        )}
                        {expirationStatus === 'soon' && (
                          <Clock className="w-3 h-3 text-yellow-500" />
                        )}
                        
                        <span className={`text-xs ${
                          expirationStatus === 'expired' ? 'text-red-500' :
                          expirationStatus === 'today' ? 'text-orange-500' :
                          expirationStatus === 'soon' ? 'text-yellow-500' :
                          'text-muted-foreground'
                        }`}>
                          {daysLeft === null ? 'Sin fecha' :
                           daysLeft <= 0 ? 'Expirado' :
                           daysLeft === 1 ? 'Expira hoy' :
                           `${daysLeft} días`}
                        </span>
                      </div>
                    </div>

                    {/* Indicador de selección */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                      </div>
                    )}
                  </div>
                </ContextMenu>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Trash2 className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">La papelera está vacía</h3>
            <p className="text-sm text-center">
              Los elementos que elimines aparecerán aquí y se eliminarán automáticamente después de 1 semana.
            </p>
          </div>
        )}
      </div>

      {/* Modal de confirmación de eliminación permanente */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmPermanentDelete}
        itemName={deleteModalItemName}
        itemType="file"
        isFolder={false}
        isPermanentDelete={true}
      />
    </div>
  );
}
