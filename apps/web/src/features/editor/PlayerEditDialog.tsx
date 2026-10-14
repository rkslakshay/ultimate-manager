import { A, ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS, type AttributeGroup } from '@um/engine';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api';
import { fullName } from '@/lib/game-format';
import { attributeClass, cn } from '@/lib/utils';
import { usePlayer, useUpdatePlayer } from '../world/api';

const GROUPS: AttributeGroup[] = ['technical', 'mental', 'physical', 'goalkeeping'];

/** Edit names, potential and every attribute; CA and value are recomputed by the server. */
export function PlayerEditDialog({
  saveId,
  playerId,
  onDone,
}: {
  saveId: string;
  playerId: number;
  onDone: () => void;
}) {
  const player = usePlayer(saveId, playerId, true);
  return (
    <DialogContent
      title={player.data ? `Edit ${fullName(player.data)}` : 'Edit player'}
      className="max-w-4xl"
    >
      {player.data ? (
        <PlayerForm saveId={saveId} player={player.data} onDone={onDone} />
      ) : (
        <Skeleton className="h-96 w-full" />
      )}
    </DialogContent>
  );
}

function PlayerForm({
  saveId,
  player,
  onDone,
}: {
  saveId: string;
  player: NonNullable<ReturnType<typeof usePlayer>['data']>;
  onDone: () => void;
}) {
  const update = useUpdatePlayer(saveId);
  const [firstName, setFirstName] = useState(player.firstName);
  const [lastName, setLastName] = useState(player.lastName);
  const [pa, setPa] = useState(String(player.pa));
  const [attributes, setAttributes] = useState(player.attributes.map(String));

  const setAttr = (index: number, value: string) =>
    setAttributes((a) => a.map((v, i) => (i === index ? value.replace(/\D/g, '').slice(0, 2) : v)));
  const parsedAttrs = attributes.map(Number);
  const invalidAttr = parsedAttrs.some((v) => !Number.isInteger(v) || v < 1 || v > 20);
  const paNum = Number(pa);
  const invalidPa = !Number.isInteger(paNum) || paNum < 1 || paNum > 200;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (invalidAttr || invalidPa || !firstName.trim() || !lastName.trim()) return;
        update.mutate(
          { id: player.id, firstName, lastName, pa: paNum, attributes: parsedAttrs },
          {
            onSuccess: (p) => {
              toast.success(`Saved. Current ability is now ${p.ca}, potential ${p.pa}.`);
              onDone();
            },
            onError: (err) => toast.error(errorMessage(err)),
          },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <FormField label="First name" error={firstName.trim() ? undefined : 'Required'}>
          {(f) => <Input {...f} value={firstName} onChange={(e) => setFirstName(e.target.value)} />}
        </FormField>
        <FormField label="Last name" error={lastName.trim() ? undefined : 'Required'}>
          {(f) => <Input {...f} value={lastName} onChange={(e) => setLastName(e.target.value)} />}
        </FormField>
        <FormField label="Potential (1-200)" error={invalidPa ? '1 to 200' : undefined}>
          {(f) => (
            <Input
              {...f}
              inputMode="numeric"
              value={pa}
              onChange={(e) => setPa(e.target.value.replace(/\D/g, ''))}
            />
          )}
        </FormField>
        <div className="flex flex-col justify-end text-xs text-fg-muted">
          Current ability {player.ca} (recalculated on save)
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {GROUPS.map((g) => (
          <fieldset key={g} className="flex flex-col gap-1">
            <legend className="mb-1 text-2xs font-semibold tracking-wide text-fg-subtle uppercase">
              {g}
            </legend>
            {ATTRIBUTE_GROUPS[g].map((key) => {
              const i = A[key];
              const v = Number(attributes[i]);
              return (
                <label key={key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-fg-muted">{ATTRIBUTE_LABELS[key]}</span>
                  <input
                    inputMode="numeric"
                    value={attributes[i]}
                    onChange={(e) => setAttr(i, e.target.value)}
                    aria-invalid={!(v >= 1 && v <= 20) || undefined}
                    className={cn(
                      'h-6 w-10 rounded border border-border bg-surface-2 text-center font-semibold aria-invalid:border-danger',
                      v >= 1 && v <= 20 && attributeClass(v),
                    )}
                  />
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      {invalidAttr && (
        <p className="text-xs text-danger">Attributes must be whole numbers from 1 to 20.</p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button
          type="submit"
          variant="primary"
          loading={update.isPending}
          disabled={invalidAttr || invalidPa}
        >
          Save player
        </Button>
      </DialogFooter>
    </form>
  );
}
