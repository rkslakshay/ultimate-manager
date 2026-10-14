import type { AuthResponse, LoginRequest, RegisterRequest, UserDto } from '@um/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

export const meQueryKey = ['auth', 'me'] as const;

/** Current user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async ({ signal }): Promise<UserDto | null> => {
      try {
        return (await api<AuthResponse>('/api/auth/me', { signal })).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginRequest) =>
      api<AuthResponse>('/api/auth/login', { method: 'POST', body: input }),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(meQueryKey, user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterRequest) =>
      api<AuthResponse>('/api/auth/register', { method: 'POST', body: input }),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(meQueryKey, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      toast.dismiss();
      qc.clear();
      qc.setQueryData(meQueryKey, null);
    },
  });
}
