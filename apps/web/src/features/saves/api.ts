import type { CreateSaveRequest, SaveGameDto } from '@um/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SaveListResponse {
  items: SaveGameDto[];
  limit: number;
}

export const savesQueryKey = ['saves'] as const;
export const saveQueryKey = (id: string) => ['saves', id] as const;

export function useSaves() {
  return useQuery({
    queryKey: savesQueryKey,
    queryFn: ({ signal }) => api<SaveListResponse>('/api/saves', { signal }),
  });
}

export function useSave(id: string) {
  return useQuery({
    queryKey: saveQueryKey(id),
    queryFn: ({ signal }) => api<SaveGameDto>(`/api/saves/${encodeURIComponent(id)}`, { signal }),
  });
}

export function useCreateSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSaveRequest) =>
      api<SaveGameDto>('/api/saves', { method: 'POST', body: input }),
    onSuccess: (save) => {
      qc.setQueryData(saveQueryKey(save.id), save);
      void qc.invalidateQueries({ queryKey: savesQueryKey, exact: true });
    },
  });
}

/** Bump lastPlayedAt when a save is opened. */
export function useLoadSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<SaveGameDto>(`/api/saves/${encodeURIComponent(id)}/load`, { method: 'POST' }),
    onSuccess: (save) => {
      qc.setQueryData(saveQueryKey(save.id), save);
      void qc.invalidateQueries({ queryKey: savesQueryKey, exact: true });
    },
  });
}

/** Optimistically update the cached list, rolling back if the request fails. */
function useOptimisticListMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<unknown>,
  apply: (items: SaveGameDto[], vars: TVars) => SaveGameDto[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await qc.cancelQueries({ queryKey: savesQueryKey, exact: true });
      const previous = qc.getQueryData<SaveListResponse>(savesQueryKey);
      if (previous) {
        qc.setQueryData<SaveListResponse>(savesQueryKey, {
          ...previous,
          items: apply(previous.items, vars),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(savesQueryKey, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: savesQueryKey }),
  });
}

export function useRenameSave() {
  return useOptimisticListMutation(
    ({ id, name }: { id: string; name: string }) =>
      api<SaveGameDto>(`/api/saves/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { name },
      }),
    (items, { id, name }) => items.map((s) => (s.id === id ? { ...s, name } : s)),
  );
}

export function useDeleteSave() {
  return useOptimisticListMutation(
    (id: string) => api<void>(`/api/saves/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    (items, id) => items.filter((s) => s.id !== id),
  );
}
