import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { errorMessage } from '@/lib/api';
import { useGameSave } from '../game/useGameSave';
import { useClub } from './api';
import { playerColumns } from './player-columns';

/**
 * The manager's squad list. Phase 4 adds selection, saved column views and quick-view cards;
 * for now it is a sortable, filterable table with column picking.
 */
export function SquadPage() {
  const save = useGameSave();
  const navigate = useNavigate();
  const club = useClub(save.id, save.managerClubId);
  const columns = useMemo(
    () => playerColumns({ saveId: save.id, markGenerated: save.dataPack !== 'fictional' }),
    [save.id, save.dataPack],
  );

  if (save.managerClubId === null) return <Navigate to={`/game/${save.id}/choose-club`} replace />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Squad{club.data ? ` · ${club.data.squad.length} players` : ''}</CardTitle>
      </CardHeader>
      <CardContent>
        {club.isError ? (
          <p role="alert" className="text-danger">
            {errorMessage(club.error)}
          </p>
        ) : (
          <DataTable
            caption="Your squad"
            columns={columns}
            data={club.data?.squad ?? []}
            isLoading={club.isPending}
            searchable
            columnPicker
            searchPlaceholder="Filter squad…"
            onRowClick={(p) => void navigate(`/game/${save.id}/players/${p.id}`)}
            getRowId={(p) => String(p.id)}
          />
        )}
      </CardContent>
    </Card>
  );
}
