import type { ClubSummaryDto } from '@um/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ClubBadge } from '@/components/game/ClubBadge';
import { Stars } from '@/components/game/Stars';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameSave } from '../game/useGameSave';
import { useClub, useCompetition, useWorldOverview } from './api';

interface Row extends ClubSummaryDto {
  predicted: number;
}

/**
 * League browser. Until the season loop exists (Phase 3) the table shows every club on zero
 * points, ordered by predicted finish (squad strength).
 */
export function LeaguePage() {
  const save = useGameSave();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const overview = useWorldOverview(save.id);
  const myClub = useClub(save.id, save.managerClubId);
  const leagues = overview.data?.competitions.filter((c) => c.kind === 'league') ?? [];
  const selected = Number(params.get('competition')) || myClub.data?.leagueId || leagues[0]?.id;
  const competition = useCompetition(save.id, selected);

  const rows = useMemo<Row[]>(
    () =>
      [...(competition.data?.clubs ?? [])]
        .sort((a, b) => b.strength - a.strength || b.reputation - a.reputation)
        .map((c, i) => ({ ...c, predicted: i + 1 })),
    [competition.data],
  );
  const relegation = competition.data?.relegationPlaces ?? 0;
  const promotion = competition.data?.promotionPlaces ?? 0;

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      { id: 'predicted', accessorKey: 'predicted', header: 'Pos', size: 48 },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Club',
        cell: ({ row }) => (
          <Link
            to={`/game/${save.id}/clubs/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-2 font-medium hover:underline ${row.original.id === save.managerClubId ? 'text-accent-text' : ''}`}
          >
            <ClubBadge club={row.original} />
            {row.original.name}
          </Link>
        ),
      },
      ...(['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'] as const).map((h): ColumnDef<Row> => ({
        id: h,
        header: h,
        enableSorting: false,
        meta: { align: 'right' },
        size: 44,
        // TODO(phase-3): real standings from played fixtures.
        cell: () => <span className="text-fg-subtle">0</span>,
      })),
      {
        id: 'strength',
        accessorKey: 'strength',
        header: 'Squad',
        meta: { label: 'Squad strength' },
        cell: ({ getValue }) => <Stars ability={getValue<number>()} label="Squad strength" />,
      },
    ],
    [save.id, save.managerClubId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {overview.isPending ? (
          <Skeleton className="h-8 w-96" />
        ) : (
          leagues.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setParams({ competition: String(l.id) })}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${l.id === selected ? 'border-accent bg-accent-muted text-fg' : 'border-border text-fg-muted hover:bg-surface-hover'}`}
              aria-pressed={l.id === selected}
            >
              {l.name}
            </button>
          ))
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{competition.data?.name ?? 'League'}</CardTitle>
          <Badge tone="info">Pre-season · predicted finish</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <DataTable
            caption="League table"
            columns={columns}
            data={rows}
            isLoading={competition.isPending}
            onRowClick={(c) => void navigate(`/game/${save.id}/clubs/${c.id}`)}
            getRowId={(c) => String(c.id)}
          />
          <p className="flex gap-4 text-2xs text-fg-subtle">
            {promotion > 0 && <span>Top {promotion}: promotion</span>}
            {relegation > 0 && <span>Bottom {relegation}: relegation</span>}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
