import { createSaveRequestSchema, type DataPackDto } from '@um/shared';
import { Database, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FormField, Input, Label } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { count } from '@/lib/game-format';
import { cn } from '@/lib/utils';
import { FormAlert } from '../auth/FormAlert';
import { useZodForm } from '../auth/useZodForm';
import { usePacks } from '../packs/api';
import { useCreateSave } from './api';

/** Same as the API schema, except a blank seed is allowed (= random world). */
const formSchema = createSaveRequestSchema.extend({
  seed: z
    .string()
    .trim()
    .max(64)
    .regex(/^[\w-]*$/, 'Seed may only contain letters, numbers, - and _'),
  dataPack: z.string().min(1),
});

function PackOption({
  pack,
  selected,
  onSelect,
}: {
  pack: DataPackDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = pack.kind === 'generated' ? Sparkles : Database;
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-md border p-3 transition-colors',
        selected ? 'border-accent bg-accent-muted' : 'border-border hover:bg-surface-hover',
      )}
    >
      <input
        type="radio"
        name="dataPack"
        className="sr-only"
        checked={selected}
        onChange={onSelect}
      />
      <Icon className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
      <span className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="flex items-center gap-2 font-medium">
          {pack.label}
          {pack.version && <Badge>{pack.version}</Badge>}
        </span>
        {pack.summary ? (
          <span className="text-xs text-fg-muted">
            {pack.summary.leagues.length} leagues · {count(pack.summary.clubs)} clubs ·{' '}
            {count(pack.summary.importedPlayers)} imported players · starts {pack.startDate}
          </span>
        ) : (
          <span className="text-xs text-fg-muted">
            Fictional nations, clubs and players generated from a seed.
          </span>
        )}
      </span>
    </label>
  );
}

export function CreateSaveDialog({ defaultManagerName }: { defaultManagerName: string }) {
  const navigate = useNavigate();
  const create = useCreateSave();
  const packs = usePacks();
  const { values, errors, formError, set, handleSubmit } = useZodForm(formSchema, {
    name: 'My Career',
    managerName: defaultManagerName,
    seed: '',
    dataPack: 'fictional',
  });
  const selected = packs.data?.items.find((p) => p.id === values.dataPack);
  const imported = selected?.kind === 'imported';

  return (
    <DialogContent
      title="New career"
      description="Choose a world, then pick your club."
      className="max-w-lg"
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async ({ seed, ...rest }) => {
          const save = await create.mutateAsync(seed ? { ...rest, seed } : rest);
          void navigate(`/game/${save.id}/choose-club`);
        })}
      >
        <FormAlert message={formError} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5">
            <Label>World</Label>
          </legend>
          <div role="radiogroup" aria-label="Data pack" className="flex flex-col gap-2">
            {packs.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              packs.data?.items.map((p) => (
                <PackOption
                  key={p.id}
                  pack={p}
                  selected={values.dataPack === p.id}
                  onSelect={() => set('dataPack')(p.id)}
                />
              ))
            )}
          </div>
          {errors.dataPack && <p className="text-xs text-danger">{errors.dataPack}</p>}
          {imported && (
            <p className="text-2xs text-fg-subtle">
              Real names and data come from datasets you supplied, for personal, non-commercial use
              only. Some values are derived or simulated; player profiles show which.
            </p>
          )}
        </fieldset>
        <FormField label="Save name" error={errors.name}>
          {(field) => (
            <Input {...field} value={values.name} onChange={(e) => set('name')(e.target.value)} />
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
          hint={
            imported
              ? 'Seeds future simulation; the starting world comes from the data pack.'
              : 'Same seed, same world. Leave blank for a random one.'
          }
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
