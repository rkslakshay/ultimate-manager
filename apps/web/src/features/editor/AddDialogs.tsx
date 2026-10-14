import { POSITIONS } from '@um/engine';
import { clubCreateSchema, playerCreateSchema } from '@um/shared';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/input';
import { FormAlert } from '../auth/FormAlert';
import { useZodForm } from '../auth/useZodForm';
import { useCreateClub, useCreatePlayer, useLeagueClubs, useWorldOverview } from '../world/api';

const selectClass = 'h-8 w-full rounded-md border border-border bg-surface-2 px-2 text-sm';

/** Form-level schemas: everything is a string in inputs; the API schema does the coercion. */
const clubForm = z.object({
  name: z.string().trim().min(1, 'Required').max(50),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,4}$/, '2-4 letters or digits'),
  leagueId: z.string().min(1, 'Choose a league'),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  reputation: z.string().regex(/^\d{1,3}$/, '1-100'),
});

export function AddClubDialog({ saveId, onDone }: { saveId: string; onDone: () => void }) {
  const overview = useWorldOverview(saveId);
  const create = useCreateClub(saveId);
  const leagues = overview.data?.competitions.filter((c) => c.kind === 'league') ?? [];
  const { values, errors, formError, set, handleSubmit } = useZodForm(clubForm, {
    name: '',
    code: '',
    leagueId: '',
    primaryColor: '#1d428a',
    secondaryColor: '#ffffff',
    reputation: '40',
  });
  return (
    <DialogContent
      title="Add club"
      description="The club joins the chosen league and its national cup."
      className="max-w-lg"
    >
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={handleSubmit(async (data) => {
          const body = clubCreateSchema.parse({
            ...data,
            leagueId: Number(data.leagueId),
            reputation: Number(data.reputation),
          });
          const club = await create.mutateAsync(body);
          toast.success(`Added ${club.name}`);
          onDone();
        })}
      >
        <FormAlert message={formError} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Name" error={errors.name}>
            {(f) => (
              <Input {...f} value={values.name} onChange={(e) => set('name')(e.target.value)} />
            )}
          </FormField>
          <FormField label="Code (2-4)" error={errors.code}>
            {(f) => (
              <Input {...f} value={values.code} onChange={(e) => set('code')(e.target.value)} />
            )}
          </FormField>
          <FormField label="League" error={errors.leagueId}>
            {(f) => (
              <select
                {...f}
                className={selectClass}
                value={values.leagueId}
                onChange={(e) => set('leagueId')(e.target.value)}
              >
                <option value="">Choose…</option>
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Reputation (1-100)" error={errors.reputation}>
            {(f) => (
              <Input
                {...f}
                inputMode="numeric"
                value={values.reputation}
                onChange={(e) => set('reputation')(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Primary colour" error={errors.primaryColor}>
            {(f) => (
              <input
                {...f}
                type="color"
                className="h-8 w-full rounded border border-border"
                value={values.primaryColor}
                onChange={(e) => set('primaryColor')(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Secondary colour" error={errors.secondaryColor}>
            {(f) => (
              <input
                {...f}
                type="color"
                className="h-8 w-full rounded border border-border"
                value={values.secondaryColor}
                onChange={(e) => set('secondaryColor')(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Add club
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

const playerForm = z.object({
  firstName: z.string().trim().max(30),
  lastName: z.string().trim().min(1, 'Required').max(40),
  nationId: z.string().min(1, 'Choose a nationality'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  position: z.enum(POSITIONS),
  clubId: z.string(),
  ability: z.string().regex(/^\d{1,3}$/, '1-200'),
});

export function AddPlayerDialog({ saveId, onDone }: { saveId: string; onDone: () => void }) {
  const overview = useWorldOverview(saveId);
  const clubs = useLeagueClubs(saveId);
  const create = useCreatePlayer(saveId);
  const { values, errors, formError, set, handleSubmit } = useZodForm(playerForm, {
    firstName: '',
    lastName: '',
    nationId: '',
    birthDate: '2004-01-01',
    position: 'MC',
    clubId: '',
    ability: '100',
  });
  return (
    <DialogContent
      title="Add player"
      description="Attributes are generated to match the ability; edit them afterwards if you like."
      className="max-w-lg"
    >
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={handleSubmit(async (data) => {
          const body = playerCreateSchema.parse({
            ...data,
            nationId: Number(data.nationId),
            clubId: data.clubId ? Number(data.clubId) : null,
            ability: Number(data.ability),
          });
          const p = await create.mutateAsync(body);
          toast.success(`Added ${`${p.firstName} ${p.lastName}`.trim()} (ability ${p.ca})`);
          onDone();
        })}
      >
        <FormAlert message={formError} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="First name" error={errors.firstName}>
            {(f) => (
              <Input
                {...f}
                value={values.firstName}
                onChange={(e) => set('firstName')(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Last name" error={errors.lastName}>
            {(f) => (
              <Input
                {...f}
                value={values.lastName}
                onChange={(e) => set('lastName')(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Nationality" error={errors.nationId}>
            {(f) => (
              <select
                {...f}
                className={selectClass}
                value={values.nationId}
                onChange={(e) => set('nationId')(e.target.value)}
              >
                <option value="">Choose…</option>
                {overview.data?.nations.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Date of birth" error={errors.birthDate}>
            {(f) => (
              <Input
                {...f}
                type="date"
                value={values.birthDate}
                onChange={(e) => set('birthDate')(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Position" error={errors.position}>
            {(f) => (
              <select
                {...f}
                className={selectClass}
                value={values.position}
                onChange={(e) => set('position')(e.target.value)}
              >
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Club" error={errors.clubId}>
            {(f) => (
              <select
                {...f}
                className={selectClass}
                value={values.clubId}
                onChange={(e) => set('clubId')(e.target.value)}
              >
                <option value="">Free agent</option>
                {clubs.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Ability (1-200)" error={errors.ability}>
            {(f) => (
              <Input
                {...f}
                inputMode="numeric"
                value={values.ability}
                onChange={(e) => set('ability')(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Add player
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
