import type { ClubSummaryDto } from '@um/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ClubBadge } from '@/components/game/ClubBadge';
import { Stars } from '@/components/game/Stars';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { money, wage } from '@/lib/game-format';
import { useGameSave } from '../game/useGameSave';
import { useChooseClub, useLeagueClubs, useWorldOverview } from './api';

/** First step of a career: pick which club to manage. */
export function ChooseClubPage() {
  const save = useGameSave();
  const navigate = useNavigate();
  const overview = useWorldOverview(save.id);
  const clubs = useLeagueClubs(save.id);
  const choose = useChooseClub(save.id);
  const leagues = useMemo(
    () => overview.data?.competitions.filter((c) => c.kind === 'league') ?? [],
    [overview.data],
  );
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ClubSummaryDto | null>(null);
  const activeLeague = leagueId ?? leagues[0]?.id;

  const columns = useMemo<ColumnDef<ClubSummaryDto>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Club',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2 font-medium">
            <ClubBadge club={row.original} />
            {row.original.name}
          </span>
        ),
      },
      {
        id: 'strength',
        accessorKey: 'strength',
        header: 'Squad',
        meta: { label: 'Squad strength' },
        cell: ({ getValue }) => <Stars ability={getValue<number>()} label="Squad strength" />,
      },
      {
        id: 'reputation',
        accessorKey: 'reputation',
        header: 'Reputation',
        meta: { align: 'right' },
      },
      {
        id: 'transferBudget',
        accessorKey: 'transferBudget',
        header: 'Transfer budget',
        meta: { align: 'right' },
        cell: ({ getValue }) => money(getValue<number>()),
      },
      {
        id: 'wageBudget',
        accessorKey: 'wageBudget',
        header: 'Wage budget',
        meta: { align: 'right' },
        cell: ({ getValue }) => wage(getValue<number>()),
      },
    ],
    [],
  );

  if (save.managerClubId !== null) return <Navigate to={`/game/${save.id}/club`} replace />;

  const rows = clubs.data?.items.filter((c) => c.leagueId === activeLeague) ?? [];
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Choose your club</h2>
        <p className="text-sm text-fg-muted">
          Bigger clubs bring bigger budgets and bigger expectations. Smaller clubs are the true road
          to glory.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Available jobs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {overview.isPending ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Tabs value={String(activeLeague)} onValueChange={(v) => setLeagueId(Number(v))}>
              <TabsList className="flex-wrap">
                {leagues.map((l) => (
                  <TabsTrigger key={l.id} value={String(l.id)}>
                    {l.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <DataTable
            caption="Clubs you can manage"
            columns={columns}
            data={rows}
            isLoading={clubs.isPending}
            initialSorting={[{ id: 'reputation', desc: true }]}
            onRowClick={setSelected}
            getRowId={(c) => String(c.id)}
          />
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent
            title={`Take charge of ${selected.name}?`}
            description="You can't change club again until the job market arrives (Phase 7)."
          >
            <div className="flex items-center gap-3 text-sm">
              <ClubBadge club={selected} size="lg" />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-fg-muted">Transfer budget</dt>
                <dd>{money(selected.transferBudget)}</dd>
                <dt className="text-fg-muted">Wage budget</dt>
                <dd>{wage(selected.wageBudget)}</dd>
                <dt className="text-fg-muted">Squad size</dt>
                <dd>{selected.squadSize}</dd>
              </dl>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                variant="primary"
                loading={choose.isPending}
                onClick={() =>
                  choose.mutate(selected.id, {
                    onSuccess: (s) => {
                      toast.success(`Welcome to ${s.clubName}!`);
                      void navigate(`/game/${save.id}/club`, { replace: true });
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  })
                }
              >
                <Check /> Accept job
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
