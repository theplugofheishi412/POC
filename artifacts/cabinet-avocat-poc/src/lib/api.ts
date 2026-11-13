import { ApiError, customFetch } from '@workspace/api-client-react';

/**
 * Accès à l'API du cabinet. Les requêtes partent sur la même origine
 * (cookie de session httpOnly) : aucun jeton n'est manipulé côté navigateur.
 */
const BASE = '/api';

type Query = Record<string, string | number | boolean | null | undefined>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === 'tous') continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return customFetch<T>(`${BASE}${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    responseType: 'auto',
  });
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', withQuery(path, query)),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: (path: string) => request<null>('DELETE', path),
  /** Téléverse un fichier brut ; les métadonnées passent en paramètres d'URL. */
  upload: <T>(path: string, file: File, query: Query) =>
    customFetch<T>(`${BASE}${withQuery(path, { ...query, filename: file.name })}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
      responseType: 'json',
    }),
};

/** URL d'un fichier généré (PDF, Word) ou téléversé. */
export const fileUrl = (path: string, download = false) => `${BASE}${path}${download ? (path.includes('?') ? '&' : '?') + 'download=1' : ''}`;

export interface ApiErrorBody {
  error?: string;
  fields?: Record<string, string>;
}

export function errorBody(err: unknown): ApiErrorBody {
  if (err instanceof ApiError && err.data && typeof err.data === 'object') return err.data as ApiErrorBody;
  return {};
}

export function errorMessage(err: unknown): string {
  const body = errorBody(err);
  if (body.error) return body.error;
  if (err instanceof ApiError) {
    if (err.status === 0 || err.status >= 500) return 'Le serveur ne répond pas correctement. Réessayez dans un instant.';
    return `Erreur ${err.status}`;
  }
  if (err instanceof TypeError) return 'Impossible de joindre le serveur. Vérifiez que l’API est démarrée.';
  return err instanceof Error ? err.message : 'Une erreur inattendue est survenue.';
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/** Ouvre un document généré dans un nouvel onglet puis lance l'impression. */
export function printDocument(path: string): void {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.src = fileUrl(path);
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(fileUrl(path), '_blank', 'noopener');
    }
    setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
}
