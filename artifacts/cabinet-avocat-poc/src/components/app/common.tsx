import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Info, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_CLASSES, TONE_DOT, type Tone } from '@/lib/tones';
import { initials } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/* ------------------------------------------------------------------ */
/* Mise en page                                                       */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-[#9a7a34]">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-xl border border-card-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'navy',
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'group flex w-full items-start gap-4 rounded-xl border border-card-border bg-card p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors',
        onClick && 'hover:border-[#b08d3c]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className={cn('mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset', TONE_CLASSES[tone])}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="tabular mt-1 block font-serif text-2xl font-semibold leading-none text-foreground">{value}</span>
        {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </Comp>
  );
}

/* ------------------------------------------------------------------ */
/* Badges et états                                                    */
/* ------------------------------------------------------------------ */

export function StatusPill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', TONE_CLASSES[tone], className)}>
      <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-[#e8ecf5] text-[11px] font-semibold text-[#14213d] ring-1 ring-[#14213d]/10', className)}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <Icon className="mb-3 size-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Chargement…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground', className)} role="status">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50/60 px-6 py-8 text-center">
      <AlertTriangle className="size-6 text-red-600" />
      <p className="text-sm text-red-800">{errorMessage(error)}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function Hint({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed',
        tone === 'info' ? 'border-[#d9c9a0] bg-[#fbf7ee] text-[#5f4a1c]' : 'border-amber-300 bg-amber-50 text-amber-900',
      )}
    >
      {tone === 'info' ? <Info className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filtres et pagination                                              */
/* ------------------------------------------------------------------ */

export function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function SearchInput({ value, onChange, placeholder = 'Rechercher…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-8 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-[#b08d3c] focus:ring-2 focus:ring-[#b08d3c]/20"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Effacer">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <NativeSelect aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn('h-9 w-auto min-w-[150px] bg-card', className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
      <span className="tabular">
        {from}–{to} sur {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Page précédente">
          <ChevronLeft />
        </Button>
        <span className="tabular px-2">
          Page {page} / {pages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Page suivante">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Champs de formulaire                                               */
/* ------------------------------------------------------------------ */

export const inputClass =
  'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-[#b08d3c] focus:ring-2 focus:ring-[#b08d3c]/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-500';

export function NativeSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        inputClass,
        'appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-foreground/80">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Confirmation                                                       */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmer',
  destructive,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className={destructive ? 'bg-destructive text-destructive-foreground' : undefined}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** État de confirmation réutilisable : `const c = useConfirm<T>()`. */
export function useConfirm<T>() {
  const [target, setTarget] = useState<T | null>(null);
  return { target, ask: (t: T) => setTarget(t), close: () => setTarget(null), open: target !== null };
}
