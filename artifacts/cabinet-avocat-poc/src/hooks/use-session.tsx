import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, Permission, SessionDTO } from '@workspace/api-zod';
import { api, isUnauthorized } from '@/lib/api';

interface SessionContextValue {
  session: SessionDTO | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  login: (input: LoginInput) => Promise<SessionDTO>;
  demoLogin: (userId: number) => Promise<SessionDTO>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        return await api.get<SessionDTO>('/auth/me');
      } catch (err) {
        if (isUnauthorized(err)) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const onLogged = useCallback(
    (s: SessionDTO) => {
      qc.clear();
      qc.setQueryData(['session'], s);
      return s;
    },
    [qc],
  );

  const loginMut = useMutation({ mutationFn: (input: LoginInput) => api.post<SessionDTO>('/auth/login', input) });
  const demoMut = useMutation({ mutationFn: (userId: number) => api.post<SessionDTO>('/auth/demo-login', { userId }) });

  const value = useMemo<SessionContextValue>(
    () => ({
      session: query.data ?? null,
      loading: query.isLoading,
      can: (p) => !!query.data?.permissions.includes(p),
      login: async (input) => onLogged(await loginMut.mutateAsync(input)),
      demoLogin: async (id) => onLogged(await demoMut.mutateAsync(id)),
      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          qc.clear();
          qc.setQueryData(['session'], null);
        }
      },
    }),
    [query.data, query.isLoading, loginMut, demoMut, onLogged, qc],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession doit être utilisé dans <SessionProvider>');
  return ctx;
}

/** Utilisateur connecté (garanti dans les pages protégées). */
export function useMe() {
  const { session } = useSession();
  if (!session) throw new Error('Session requise');
  return session.user;
}
