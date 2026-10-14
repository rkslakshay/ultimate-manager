import type { ClubDetailDto } from '@um/shared';
import { useMemo } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { ClubBadge } from '@/components/game/ClubBadge';
import { Stars } from '@/components/game/Stars';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api';
import { count, money, wage } from '@/lib/game-format';
import { useGameSave } from '../game/useGameSave';
import { useClub } from './api';
import { playerColumns } from './player-columns';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="tabular">{children}</dd>
    </>
  );
}

function ClubHeader({ club, isMine }: { club: ClubDetailDto; isMine: boolean }) {
  const save = useGameSave();
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4">
      <ClubBadge club={club} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-xl font-semibold">{club.name}</h2>
          {isMine && <Badge tone="accent">Your club</Badge>}
        </div>
        <p className="text-sm text-fg-muted">
          {club.city ? `${club.city}, ` : ''}
          {club.nation.name} ·{' '}
          {club.league ? (
            <Link
              className="hover:underline"
              to={`/game/${save.id}/league?competition=${club.league.id}`}
            >
              {club.league.name}
            </Link>
          ) : (
            'No league'
          )}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 text-xs text-fg-muted">
        <span>Squad strength</span>
        <Stars ability={club.strength} label="Squad strength" />
      </div>
    </div>
  );
}

/** Club overview: used for the manager's own club and for browsing any other club. */
export function ClubPage({ own = false }: { own?: boolean }) {
  const save = useGameSave();
  const navigate = useNavigate();
  const params = useParams();
  const clubId = own ? save.managerClubId : Number(params.clubId);
  const club = useClub(save.id, clubId);
  const columns = useMemo(
    () => playerColumns({ saveId: save.id, markGenerated: save.dataPack !== 'fictional' }),
    [save.id, save.dataPack],
  );

  if (own && save.managerClubId === null)
    return <Navigate to={`/game/${save.id}/choose-club`} replace />;
  if (club.isError)
    return (
      <p role="alert" className="text-danger">
        {errorMessage(club.error)}
      </p>
    );
  if (!club.data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const c = club.data;
  return (
    <div className="flex flex-col gap-4">
      <ClubHeader club={c} isMine={c.id === save.managerClubId} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Club</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Fact label="Founded">{c.founded ?? 'Unknown'}</Fact>
              <Fact label="Reputation">{c.reputation} / 100</Fact>
              <Fact label="Stadium">{c.stadium.name}</Fact>
              <Fact label="Capacity">{count(c.stadium.capacity)}</Fact>
              <Fact label="Training facilities">{c.trainingFacilities} / 20</Fact>
              <Fact label="Youth facilities">{c.youthFacilities} / 20</Fact>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Finances</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Fact label="Balance">{money(c.balance)}</Fact>
              <Fact label="Transfer budget">{money(c.transferBudget)}</Fact>
              <Fact label="Wage budget">{wage(c.wageBudget)}</Fact>
              <Fact label="Current wages">{wage(c.wageBill)}</Fact>
            </dl>
            {c.sourceFields?.finances === 'derived' && (
              <p className="mt-3 text-2xs text-fg-subtle">
                Reputation, finances and facilities are derived by the game from squad value and
                league; they are not the club's real figures.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Squad</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Fact label="Players">{c.squadSize}</Fact>
              <Fact label="Average age">
                {(c.squad.reduce((a, p) => a + p.age, 0) / Math.max(1, c.squad.length)).toFixed(1)}
              </Fact>
              <Fact label="Foreign players">
                {c.squad.filter((p) => p.nationId !== c.nationId).length}
              </Fact>
              <Fact label="Squad value">{money(c.squad.reduce((a, p) => a + p.value, 0))}</Fact>
            </dl>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={`${c.name} squad`}
            columns={columns}
            data={c.squad}
            searchable
            columnPicker
            searchPlaceholder="Filter squad…"
            onRowClick={(p) => void navigate(`/game/${save.id}/players/${p.id}`)}
            getRowId={(p) => String(p.id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
