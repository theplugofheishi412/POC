const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dayMonthFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const numberFmt = new Intl.NumberFormat('fr-FR');

/** Les dates calendaires AAAA-MM-JJ sont lues à midi pour éviter les décalages de fuseau. */
export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
}

export const formatDate = (v: string | Date | null | undefined) => (v ? dateFmt.format(toDate(v)) : '—');
export const formatShortDate = (v: string | Date | null | undefined) => (v ? shortFmt.format(toDate(v)) : '—');
export const formatDayMonth = (v: string | Date) => dayMonthFmt.format(toDate(v));
export const formatTime = (v: string | Date) => timeFmt.format(toDate(v)).replace(':', 'h');
export const formatDateTime = (v: string | Date) => `${formatShortDate(v)} à ${formatTime(v)}`;
export const formatNumber = (n: number) => numberFmt.format(n);
export const fcfa = (n: number) => `${numberFmt.format(Math.round(n))} FCFA`;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

/** « il y a 3 h », « hier », « dans 2 jours »… */
export function relativeTime(value: string | Date): string {
  const d = toDate(value);
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
  if (abs < 60_000) return 'à l’instant';
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), 'day');
  return formatShortDate(d);
}

export function todayIso(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return isoDay(d);
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Valeur pour un <input type="datetime-local">. */
export function toLocalInput(d: Date): string {
  return `${isoDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function daysUntil(isoDate: string): number {
  const target = toDate(isoDate);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  target.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

export function initials(name: string): string {
  return name
    .replace(/^(Me|Maître)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
