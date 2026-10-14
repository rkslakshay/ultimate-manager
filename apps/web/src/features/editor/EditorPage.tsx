import type { ClubSummaryDto, PlayerSummaryDto } from '@um/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { ClubBadge } from '@/components/game/ClubBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fullName } from '@/lib/game-format';
import { useGameSave } from '../game/useGameSave';
import { useLeagueClubs, usePlayerSearch } from '../world/api';
import { ClubEditDialog } from './ClubEditDialog';
import { ImportExportPanel } from './ImportExportPanel';
import { PlayerEditDialog } from './PlayerEditDialog';

const editButton = (label: string, onClick: () => void) => (
  <Button size="icon-sm" variant="ghost" aria-label={label} onClick={onClick}>
    <Pencil />
  </Button>
);

/** In-game database editor: rename clubs, edit players, import/export JSON or CSV. */
export function EditorPage() {
  const save = useGameSave();
  const clubs = useLeagueClubs(save.id);
  const [club, setClub] = useState<ClubSummaryDto | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const players = usePlayerSearch(save.id, {
    q: deferredQ || undefined,
    pageSize: 25,
    sort: 'name',
    order: 'asc',
  });

  const clubColumns = useMemo<ColumnDef<ClubSummaryDto>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Club',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            <ClubBadge club={row.original} /> {row.original.name}
          </span>
        ),
      },
      { id: 'code', accessorKey: 'code', header: 'Code' },
      { id: 'city', accessorKey: 'city', header: 'City' },
      {
        id: 'edit',
        header: () => <span className="sr-only">Edit</span>,
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => editButton(`Edit ${row.original.name}`, () => setClub(row.original)),
      },
    ],
    [],
  );
  const playerColumns = useMemo<ColumnDef<PlayerSummaryDto>[]>(
    () => [
      { id: 'name', header: 'Name', accessorFn: fullName },
      { id: 'position', accessorKey: 'position', header: 'Pos' },
      { id: 'age', accessorKey: 'age', header: 'Age', meta: { align: 'right' } },
      { id: 'club', header: 'Club', accessorFn: (p) => p.club?.name ?? 'Free agent' },
      {
        id: 'ca',
        accessorKey: 'ca',
        header: 'CA',
        meta: { align: 'right', label: 'Current ability' },
      },
      {
        id: 'pa',
        accessorKey: 'pa',
        header: 'PA',
        meta: { align: 'right', label: 'Potential ability' },
      },
      {
        id: 'edit',
        header: () => <span className="sr-only">Edit</span>,
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) =>
          editButton(`Edit ${fullName(row.original)}`, () => setPlayerId(row.original.id)),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-muted">
        Changes apply to this save only. The editor shows exact abilities (CA/PA), which are
        otherwise hidden behind star ratings.
      </p>
      <Tabs defaultValue="clubs">
        <TabsList>
          <TabsTrigger value="clubs">Clubs</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="io">Import / export</TabsTrigger>
        </TabsList>
        <TabsContent value="clubs">
          <Card>
            <CardContent>
              <DataTable
                caption="Clubs"
                columns={clubColumns}
                data={clubs.data?.items ?? []}
                isLoading={clubs.isPending}
                searchable
                searchPlaceholder="Filter clubs…"
                pageSize={20}
                getRowId={(c) => String(c.id)}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="players">
          <Card>
            <CardHeader>
              <CardTitle>Find a player</CardTitle>
              <Input
                className="max-w-64"
                aria-label="Search players by name"
                placeholder="Name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </CardHeader>
            <CardContent>
              <DataTable
                caption="Players"
                columns={playerColumns}
                data={players.data?.items ?? []}
                isLoading={players.isPending}
                getRowId={(p) => String(p.id)}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="io">
          <ImportExportPanel saveId={save.id} />
        </TabsContent>
      </Tabs>

      <Dialog open={club !== null} onOpenChange={(open) => !open && setClub(null)}>
        {club && <ClubEditDialog saveId={save.id} club={club} onDone={() => setClub(null)} />}
      </Dialog>
      <Dialog open={playerId !== null} onOpenChange={(open) => !open && setPlayerId(null)}>
        {playerId !== null && (
          <PlayerEditDialog saveId={save.id} playerId={playerId} onDone={() => setPlayerId(null)} />
        )}
      </Dialog>
    </div>
  );
}
