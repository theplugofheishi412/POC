import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ClientDTO, DossierStatus, Paginated, UserDTO } from '@workspace/api-zod';
import { api, errorMessage } from '@/lib/api';

/** Membres du cabinet (listes de sélection, affectations). */
export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => api.get<UserDTO[]>('/users'), staleTime: 60_000 });
}

export function useDossierOptions() {
  return useQuery({
    queryKey: ['dossiers', 'options'],
    queryFn: () => api.get<{ id: number; reference: string; title: string; status: DossierStatus }[]>('/dossiers/options'),
    staleTime: 30_000,
  });
}

export function useClientOptions() {
  return useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => api.get<Paginated<ClientDTO>>('/clients', { pageSize: 100, status: 'actif' }),
    staleTime: 30_000,
    select: (d) => d.items,
  });
}

/**
 * Mutation standard : notification de succès / d'échec et rafraîchissement
 * des listes concernées (les données restent la propriété du serveur).
 */
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  options: {
    success?: string | ((r: TResult) => string);
    invalidate?: string[][];
    onSuccess?: (r: TResult, vars: TVars) => void;
    silentError?: boolean;
  } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r, vars) => {
      for (const key of options.invalidate ?? []) await qc.invalidateQueries({ queryKey: key });
      // Le tableau de bord et les notifications dépendent de presque tout.
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      if (options.success) toast.success(typeof options.success === 'function' ? options.success(r) : options.success);
      options.onSuccess?.(r, vars);
    },
    onError: (err) => {
      if (!options.silentError) toast.error(errorMessage(err));
    },
  });
}
