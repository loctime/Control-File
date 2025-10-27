// components/drive/CreateFolderForm.tsx
'use client';

import { useCreateFolderForm } from '@/hooks/useFileForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useState } from 'react';
import { PlusIcon } from 'lucide-react';

interface CreateFolderFormProps {
  parentId: string | null;
  trigger?: React.ReactNode;
}

export function CreateFolderForm({ parentId, trigger }: CreateFolderFormProps) {
  const [open, setOpen] = useState(false);
  const { form, isSubmitting } = useCreateFolderForm(parentId, () => {
    setOpen(false);
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <PlusIcon className="h-4 w-4 mr-2" />
            Nueva Carpeta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nueva Carpeta</DialogTitle>
        </DialogHeader>
        
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la carpeta</Label>
            <Input
              id="name"
              value={form.state.values.name || ''}
              onChange={(e) => form.setFieldValue('name', e.target.value)}
              placeholder="Ingresa el nombre de la carpeta"
              disabled={isSubmitting}
            />
            {form.state.errors && form.state.errors.length > 0 && (
              <p className="text-sm text-red-600">Error en el nombre</p>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !form.state.isValid}
            >
              {isSubmitting ? 'Creando...' : 'Crear Carpeta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
