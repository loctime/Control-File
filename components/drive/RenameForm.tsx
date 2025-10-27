// components/drive/RenameForm.tsx
'use client';

import { useRenameForm } from '@/hooks/useFileForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useState } from 'react';
import { EditIcon } from 'lucide-react';

interface RenameFormProps {
  itemId: string;
  currentName: string;
  trigger?: React.ReactNode;
}

export function RenameForm({ itemId, currentName, trigger }: RenameFormProps) {
  const [open, setOpen] = useState(false);
  const { form, isSubmitting } = useRenameForm(itemId, currentName, () => {
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <EditIcon className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renombrar Elemento</DialogTitle>
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
            <Label htmlFor="newName">Nuevo nombre</Label>
            <Input
              id="newName"
              value={form.state.values.newName || ''}
              onChange={(e) => form.setFieldValue('newName', e.target.value)}
              placeholder="Ingresa el nuevo nombre"
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
              {isSubmitting ? 'Renombrando...' : 'Renombrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
