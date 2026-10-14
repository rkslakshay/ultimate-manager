import type {
  ClubDetailDto,
  ClubRefDto,
  ClubSummaryDto,
  ClubUpdate,
  CompetitionDetailDto,
  Paginated,
  PlayerDetailDto,
  PlayerSearchParams,
  PlayerSummaryDto,
  PlayerUpdate,
  SaveGameDto,
  WorldImportRequest,
  WorldImportResult,
  WorldOverviewDto,
} from '@um/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { saveQueryKey, savesQueryKey } from '../saves/api';

const base = (saveId: string) => `/api/saves/${encodeURIComponent(saveId)}/world`;
export const worldKey = (saveId: string) => ['world', saveId] as const;

export function useWorldOverview(saveId: string) {
  return useQuery({
    queryKey: [...worldKey(saveId), 'overview'],
    queryFn: ({ signal }) => api<WorldOverviewDto>(`${base(saveId)}/overview`, { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useCompetition(saveId: string, competitionId: number | undefined) {
  return useQuery({
    queryKey: [...worldKey(saveId), 'competition', competitionId],
    queryFn: ({ signal }) =>
      api<CompetitionDetailDto>(`${base(saveId)}/competitions/${competitionId}`, { signal }),
    enabled: competitionId !== undefined,
  });
}

export function useLeagueClubs(saveId: string) {
  return useQuery({
    queryKey: [...worldKey(saveId), 'clubs'],
    queryFn: ({ signal }) => api<{ items: ClubSummaryDto[] }>(`${base(saveId)}/clubs`, { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useClub(saveId: string, clubId: number | null | undefined) {
  return useQuery({
    queryKey: [...worldKey(saveId), 'club', clubId],
    queryFn: ({ signal }) => api<ClubDetailDto>(`${base(saveId)}/clubs/${clubId}`, { signal }),
    enabled: clubId !== null && clubId !== undefined,
  });
}

function toQueryString(params: PlayerSearchParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  }
  return qs.toString();
}

export function usePlayerSearch(saveId: string, params: PlayerSearchParams) {
  return useQuery({
    queryKey: [...worldKey(saveId), 'players', params],
    queryFn: ({ signal }) =>
      api<Paginated<PlayerSummaryDto>>(`${base(saveId)}/players?${toQueryString(params)}`, {
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function usePlayer(saveId: string, playerId: number, includeHidden = false) {
  return useQuery({
    queryKey: [...worldKey(saveId), 'player', playerId, includeHidden],
    queryFn: ({ signal }) =>
      api<PlayerDetailDto>(
        `${base(saveId)}/players/${playerId}${includeHidden ? '?hidden=true' : ''}`,
        { signal },
      ),
  });
}

// ------------------------------------------------------------------ mutations

export function useGenerateWorld(saveId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<SaveGameDto>(`/api/saves/${encodeURIComponent(saveId)}/world`, { method: 'POST' }),
    onSuccess: (save) => qc.setQueryData(saveQueryKey(saveId), save),
  });
}

export function useChooseClub(saveId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clubId: number) =>
      api<SaveGameDto>(`/api/saves/${encodeURIComponent(saveId)}/club`, {
        method: 'POST',
        body: { clubId },
      }),
    onSuccess: (save) => {
      qc.setQueryData(saveQueryKey(saveId), save);
      void qc.invalidateQueries({ queryKey: savesQueryKey, exact: true });
    },
  });
}

/** Edits change names/abilities shown everywhere: refresh the whole world cache. */
function useWorldMutation<TVars, TResult>(saveId: string, fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: worldKey(saveId) });
      void qc.invalidateQueries({ queryKey: saveQueryKey(saveId) });
    },
  });
}

export const useUpdateClub = (saveId: string) =>
  useWorldMutation(saveId, ({ id, ...body }: ClubUpdate & { id: number }) =>
    api<ClubRefDto>(`${base(saveId)}/clubs/${id}`, { method: 'PATCH', body }),
  );

export const useUpdatePlayer = (saveId: string) =>
  useWorldMutation(saveId, ({ id, ...body }: PlayerUpdate & { id: number }) =>
    api<PlayerDetailDto>(`${base(saveId)}/players/${id}`, { method: 'PATCH', body }),
  );

export const useImportWorld = (saveId: string) =>
  useWorldMutation(saveId, (body: WorldImportRequest) =>
    api<WorldImportResult>(`${base(saveId)}/import`, { method: 'POST', body }),
  );

/** Download an export file (JSON/CSV) through the browser. */
export async function downloadExport(
  saveId: string,
  entity: 'clubs' | 'players',
  format: 'json' | 'csv',
) {
  const res = await fetch(`${base(saveId)}/export?entity=${entity}&format=${format}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new ApiError(res.status, 'INTERNAL_ERROR', `Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `${entity}.${format}`,
  });
  link.click();
  URL.revokeObjectURL(url);
}
