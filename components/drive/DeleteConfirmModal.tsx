'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType: 'file' | 'folder';
  isFolder: boolean;
  isPermanentDelete?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType,
  isFolder,
  isPermanentDelete = false
}: DeleteConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar eliminación"
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            {isPermanentDelete 
              ? `¿Estás seguro de que quieres eliminar permanentemente "${itemName}"?`
              : `¿Estás seguro de que quieres eliminar "${itemName}"?`
            }
          </h3>
          {isPermanentDelete ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <strong>Advertencia:</strong> Esta acción eliminará permanentemente el elemento de la papelera. Esta acción no se puede deshacer.
            </p>
          ) : (
            <>
              {isFolder && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <strong>Advertencia:</strong> Esta acción moverá la carpeta y todos sus archivos y subcarpetas a la papelera.
                </p>
              )}
              {!isFolder && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Esta acción moverá el archivo a la papelera.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button
          variant="outline"
          onClick={onClose}
          className="px-4 py-2"
        >
          Cancelar
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          className="px-4 py-2"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </div>
    </Modal>
  );
}
