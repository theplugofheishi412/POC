import { useSearch } from 'wouter';

/** Lit un paramètre de l'URL courante (?search=…). */
export function useQueryParam(name: string): string | null {
  const search = useSearch();
  return new URLSearchParams(search).get(name);
}

/** Met à jour l'URL sans recharger la page (filtres partageables). */
export function replaceQueryParam(name: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState(window.history.state, '', url);
}
