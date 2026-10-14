import { POSITIONS } from '@um/engine';
import { PLAYER_SORT_FIELDS, type PlayerSearchParams, type PlayerSortField } from '@um/shared';
import type { SortingState } from '@tanstack/react-table';
import { RotateCcw } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Input, Label } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { count } from '@/lib/game-format';
import { useGameSave } from '../game/useGameSave';
import { usePlayerSearch, useWorldOverview } from './api';
import { playerColumns } from './player-columns';

const PAGE_SIZE = 50;
interface Filters {
  q: string;
  position: string;
  nationId: string;
  minAge: string;
  maxAge: string;
  maxValue: string;
  status: '' | 'freeAgents' | 'expiring';
}
const EMPTY: Filters = {
  q: '',
  position: '',
  nationId: '',
  minAge: '',
  maxAge: '',
  maxValue: '',
  status: '',
};

const selectClass =
  'h-8 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg hover:border-border-strong focus-visible:border-accent';

/** Player search across the whole world (server-side filtering, sorting and pagination). */
export function SearchPage() {
  const save = useGameSave();
  const navigate = useNavigate();
  const overview = useWorldOverview(save.id);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'ca', desc: true }]);
  const [page, setPage] = useState(1);
  const q = useDeferredValue(filters.q);

  const set = (key: keyof Filters) => (value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const sort = sorting[0];
  const params: PlayerSearchParams = {
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    position: (filters.position || undefined) as PlayerSearchParams['position'],
    nationId: filters.nationId ? Number(filters.nationId) : undefined,
    minAge: filters.minAge ? Number(filters.minAge) : undefined,
    maxAge: filters.maxAge ? Number(filters.maxAge) : undefined,
    maxValue: filters.maxValue ? Number(filters.maxValue) * 1_000_000 : undefined,
    freeAgents: filters.status === 'freeAgents' ? 'true' : undefined,
    expiring: filters.status === 'expiring' ? 'true' : undefined,
    sort: (PLAYER_SORT_FIELDS as readonly string[]).includes(sort?.id ?? '')
      ? (sort!.id as PlayerSortField)
      : 'ca',
    order: sort?.desc === false ? 'asc' : 'desc',
  };
  const search = usePlayerSearch(save.id, params);
  const columns = useMemo(
    () => playerColumns({ saveId: save.id, showClub: true, serverSortable: true }),
    [save.id],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => (setFilters(EMPTY), setPage(1))}>
            <RotateCcw /> Reset
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="f-q">Name</Label>
            <Input
              id="f-q"
              value={filters.q}
              onChange={(e) => set('q')(e.target.value)}
              placeholder="Search players…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-pos">Position</Label>
            <select
              id="f-pos"
              className={selectClass}
              value={filters.position}
              onChange={(e) => set('position')(e.target.value)}
            >
              <option value="">Any</option>
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-nat">Nationality</Label>
            <select
              id="f-nat"
              className={selectClass}
              value={filters.nationId}
              onChange={(e) => set('nationId')(e.target.value)}
            >
              <option value="">Any</option>
              {overview.data?.nations.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-age">Age</Label>
            <div className="flex items-center gap-1">
              <Input
                id="f-age"
                inputMode="numeric"
                aria-label="Minimum age"
                value={filters.minAge}
                onChange={(e) => set('minAge')(e.target.value.replace(/\D/g, ''))}
                placeholder="16"
              />
              <span className="text-fg-subtle">–</span>
              <Input
                inputMode="numeric"
                aria-label="Maximum age"
                value={filters.maxAge}
                onChange={(e) => set('maxAge')(e.target.value.replace(/\D/g, ''))}
                placeholder="40"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-val">Max value (€M)</Label>
            <Input
              id="f-val"
              inputMode="decimal"
              value={filters.maxValue}
              onChange={(e) => set('maxValue')(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="Any"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-status">Contract</Label>
            <select
              id="f-status"
              className={selectClass}
              value={filters.status}
              onChange={(e) => set('status')(e.target.value)}
            >
              <option value="">Any</option>
              <option value="freeAgents">Free agents</option>
              <option value="expiring">Expiring this season</option>
            </select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Players{search.data ? ` · ${count(search.data.total)} found` : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          {search.isError ? (
            <p role="alert" className="text-danger">
              {errorMessage(search.error)}
            </p>
          ) : (
            <DataTable
              caption="Player search results"
              columns={columns}
              data={search.data?.items ?? []}
              isLoading={search.isPending}
              columnPicker
              emptyMessage="No players match these filters."
              onRowClick={(p) => void navigate(`/game/${save.id}/players/${p.id}`)}
              getRowId={(p) => String(p.id)}
              server={{
                sorting,
                onSortingChange: (s) => (setSorting(s), setPage(1)),
                page,
                pageCount: search.data?.totalPages ?? 1,
                total: search.data?.total ?? 0,
                onPageChange: setPage,
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
