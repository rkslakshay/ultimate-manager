import type { SaveGameDto } from '@um/shared';
import { saveNameSchema } from '@um/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { useDeleteSave, useRenameSave } from './api';

interface Props {
  save: SaveGameDto | null;
  onClose: () => void;
}

export function RenameSaveDialog({ save, onClose }: Props) {
  const rename = useRenameSave();
  const [name, setName] = useState(save?.name ?? '');
  const [error, setError] = useState<string>();

  return (
    <Dialog open={save !== null} onOpenChange={(open) => !open && onClose()}>
      {save && (
        <DialogContent title="Rename save">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = saveNameSchema.safeParse(name);
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message);
                return;
              }
              // Optimistic: the list updates immediately and rolls back on failure.
              rename.mutate(
                { id: save.id, name: parsed.data },
                { onError: (err) => toast.error(`Rename failed: ${errorMessage(err)}`) },
              );
              onClose();
            }}
          >
            <FormField label="Save name" error={error}>
              {(field) => (
                <Input
                  {...field}
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(undefined);
                  }}
                />
              )}
            </FormField>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" variant="primary">
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function DeleteSaveDialog({ save, onClose }: Props) {
  const remove = useDeleteSave();
  return (
    <Dialog open={save !== null} onOpenChange={(open) => !open && onClose()}>
      {save && (
        <DialogContent
          title="Delete save?"
          description={`"${save.name}" will be permanently deleted. This cannot be undone.`}
        >
          <DialogFooter className="mt-0">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                remove.mutate(save.id, {
                  onSuccess: () => toast.success(`Deleted "${save.name}"`),
                  onError: (err) => toast.error(`Delete failed: ${errorMessage(err)}`),
                });
                onClose();
              }}
            >
              Delete save
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
