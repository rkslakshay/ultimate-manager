import { clubUpdateSchema, type ClubSummaryDto } from '@um/shared';
import { toast } from 'sonner';
import { z } from 'zod';
import { ClubBadge } from '@/components/game/ClubBadge';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/input';
import { FormAlert } from '../auth/FormAlert';
import { useZodForm } from '../auth/useZodForm';
import { useUpdateClub } from '../world/api';

/** City may be unknown for real clubs: a blank city leaves it unset. */
const formSchema = clubUpdateSchema.required().extend({ city: z.string().trim().max(40) });

export function ClubEditDialog({
  saveId,
  club,
  onDone,
}: {
  saveId: string;
  club: ClubSummaryDto;
  onDone: () => void;
}) {
  const update = useUpdateClub(saveId);
  const { values, errors, formError, set, handleSubmit } = useZodForm(formSchema, {
    name: club.name,
    shortName: club.shortName,
    code: club.code,
    city: club.city ?? '',
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
  });

  const text = (key: 'name' | 'shortName' | 'code' | 'city', label: string) => (
    <FormField label={label} error={errors[key]}>
      {(field) => (
        <Input {...field} value={values[key]} onChange={(e) => set(key)(e.target.value)} />
      )}
    </FormField>
  );
  const colour = (key: 'primaryColor' | 'secondaryColor', label: string) => (
    <FormField label={label} error={errors[key]}>
      {(field) => (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={`${label} picker`}
            value={values[key]}
            onChange={(e) => set(key)(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
          />
          <Input
            {...field}
            className="font-mono"
            value={values[key]}
            onChange={(e) => set(key)(e.target.value)}
          />
        </div>
      )}
    </FormField>
  );

  return (
    <DialogContent title={`Edit ${club.name}`} className="max-w-lg">
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={handleSubmit(async (data) => {
          const { city, ...rest } = data;
          await update.mutateAsync({ id: club.id, ...rest, ...(city ? { city } : {}) });
          toast.success('Club updated');
          onDone();
        })}
      >
        <FormAlert message={formError} />
        <div className="flex items-center gap-3">
          <ClubBadge
            club={{
              code: values.code || '?',
              primaryColor: values.primaryColor,
              secondaryColor: values.secondaryColor,
            }}
            size="lg"
          />
          <p className="text-xs text-fg-muted">Badge preview</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {text('name', 'Name')}
          {text('shortName', 'Short name')}
          {text('code', 'Code (2-4 letters)')}
          {text('city', 'City')}
          {colour('primaryColor', 'Primary colour')}
          {colour('secondaryColor', 'Secondary colour')}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
