import { createSaveRequestSchema } from '@um/shared';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/input';
import { FormAlert } from '../auth/FormAlert';
import { useZodForm } from '../auth/useZodForm';
import { useCreateSave } from './api';

/** Same as the API schema, except a blank seed is allowed (= random world). */
const formSchema = createSaveRequestSchema.extend({
  seed: z
    .string()
    .trim()
    .max(64)
    .regex(/^[\w-]*$/, 'Seed may only contain letters, numbers, - and _'),
});

export function CreateSaveDialog({ defaultManagerName }: { defaultManagerName: string }) {
  const navigate = useNavigate();
  const create = useCreateSave();
  const { values, errors, formError, set, handleSubmit } = useZodForm(formSchema, {
    name: 'My Career',
    managerName: defaultManagerName,
    seed: '',
  });

  return (
    <DialogContent
      title="New career"
      description="Start a new save game. Club selection arrives with the generated world (Phase 1)."
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async ({ seed, ...rest }) => {
          const save = await create.mutateAsync(seed ? { ...rest, seed } : rest);
          void navigate(`/game/${save.id}/inbox`);
        })}
      >
        <FormAlert message={formError} />
        <FormField label="Save name" error={errors.name}>
          {(field) => (
            <Input
              {...field}
              autoFocus
              value={values.name}
              onChange={(e) => set('name')(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Manager name" error={errors.managerName}>
          {(field) => (
            <Input
              {...field}
              value={values.managerName}
              onChange={(e) => set('managerName')(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="World seed (optional)"
          error={errors.seed}
          hint="Same seed, same world. Leave blank for a random one."
        >
          {(field) => (
            <Input
              {...field}
              placeholder="e.g. golden-generation"
              className="font-mono"
              value={values.seed}
              onChange={(e) => set('seed')(e.target.value)}
            />
          )}
        </FormField>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Start career
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
