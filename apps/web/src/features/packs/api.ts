import type { DataPackDto } from '@um/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePacks() {
  return useQuery({
    queryKey: ['packs'],
    queryFn: ({ signal }) => api<{ items: DataPackDto[] }>('/api/packs', { signal }),
    staleTime: 60_000,
  });
}

/** Crest keys that have a user-supplied image (data-packs/assets/crests). */
export function useCrests() {
  return useQuery({
    queryKey: ['crests'],
    queryFn: ({ signal }) => api<{ keys: string[] }>('/api/assets/crests', { signal }),
    staleTime: 5 * 60_000,
    select: (d) => new Set(d.keys),
  });
}
