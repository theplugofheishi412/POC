import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlarmClock,
  Archive,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  FolderOpen,
  Gavel,
  Landmark,
  ListChecks,
  Receipt,
  Route as RouteIcon,
  UsersRound,
} from 'lucide-react';
import {
  DOSSIER_CATEGORY_LABELS,
  DOSSIER_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
  type DashboardDTO,
} from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { daysUntil, fcfa, formatDate, formatDayMonth, formatTime, relativeTime, toDate } from '@/lib/format';
import { DOSSIER_STATUS_TONE, EVENT_TYPE_STYLE, PRIORITY_TONE, TONE_DOT } from '@/lib/tones';
import { Avatar, EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard, StatusPill } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const GUIDE_KEY = 'cabinet.guide.hidden';

/** « Aujourd’hui », « Demain », « dans 3 jours » — ou l'heure pour un événement. */
function dueLabel(date: string): string {
  const n = daysUntil(date.slice(0, 10));
  if (n === 0) return date.length > 10 ? `Aujourd’hui ${formatTime(date)}` : 'Aujourd’hui';
  if (n === 1) return 'Demain';
  return `Dans ${n} jours`;
}

const DEMO_STEPS: { label: string; href: string }[] = [
  { label: 'Consulter le tableau de bord', href: '/' },
  { label: 'Ouvrir la fiche du client SARL ABC Distribution', href: '/clients?search=ABC' },
  { label: 'Consulter le dossier DOS-2026-001', href: '/dossiers?search=DOS-2026-001' },
  { label: 'Ajouter des pièces justificatives (onglet Pièces)', href: '/dossiers?search=DOS-2026-001' },
  { label: 'Générer le bordereau de pièces en PDF', href: '/documents' },
  { label: 'Préparer une requête à partir d’un modèle', href: '/requetes' },
  { label: 'Enregistrer une démarche au palais de justice', href: '/demarches' },
  { label: 'Programmer une audience', href: '/agenda' },
  { label: 'Attribuer une tâche au stagiaire', href: '/taches' },
  { label: 'Consulter l’historique du dossier (onglet Historique)', href: '/dossiers?search=DOS-2026-001' },
];

function DemoGuide() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setHidden(!hidden);
    try {
      localStorage.setItem(GUIDE_KEY, hidden ? '0' : '1');
    } catch {
      /* sans conséquence */
    }
  };
  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-[#d9c9a0] bg-[#fbf7ee]">
      <button onClick={toggle} className="flex w-full items-center gap-3 px-5 py-3.5 text-left">
        <RouteIcon className="size-4 text-[#8a6d2b]" />
        <span className="flex-1 text-sm font-medium text-[#5f4a1c]">Parcours de démonstration guidé — 10 étapes pour découvrir le logiciel</span>
        <ChevronDown className={cn('size-4 text-[#8a6d2b] transition-transform', !hidden && 'rotate-180')} />
      </button>
      {!hidden && (
        <ol className="grid gap-x-6 gap-y-1.5 border-t border-[#e8dcbc] px-5 py-4 sm:grid-cols-2">
          {DEMO_STEPS.map((s, i) => (
            <li key={s.label}>
              <Link href={s.href} className="group flex items-center gap-2.5 rounded px-1 py-1 text-[13px] text-[#4a3a17] hover:bg-white/70">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#14213d] text-[10px] font-semibold text-white">{i + 1}</span>
                {s.label}
                <ArrowRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CategoryChart({ data }: { data: DashboardDTO['byCategory'] }) {
  const rows = data.map((d) => ({ name: DOSSIER_CATEGORY_LABELS[d.category], count: d.count })).sort((a, b) => b.count - a.count);
  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }} barCategoryGap={6}>
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis type="category" dataKey="name" width={168} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(220 10% 40%)' }} />
          <Tooltip
            cursor={{ fill: 'hsl(220 20% 94%)' }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
                  <div className="font-medium">{payload[0].payload.name}</div>
                  <div className="tabular text-muted-foreground">{payload[0].value} dossier(s)</div>
                </div>
              ) : null
            }
          />
          <Bar isAnimationActive={false} dataKey="count" fill="#1f3461" radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fontSize: 12, fill: 'hsl(222 47% 13%)' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatusBreakdown({ data }: { data: DashboardDTO['byStatus'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const [, navigate] = useLocation();
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.status}>
          <button className="group w-full text-left" onClick={() => navigate(`/dossiers?status=${d.status}`)} title="Voir ces dossiers">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-foreground/80">
                <span className={cn('size-2 rounded-full', TONE_DOT[DOSSIER_STATUS_TONE[d.status]])} />
                {DOSSIER_STATUS_LABELS[d.status]}
              </span>
              <span className="tabular font-medium">{d.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-[#1f3461] transition-all group-hover:bg-[#b08d3c]" style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { session, can } = useSession();
  const [, navigate] = useLocation();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardDTO>('/dashboard') });
  const firstName = session!.user.firstName;
  const isLawyer = ['associe', 'collaborateur', 'stagiaire'].includes(session!.user.role);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const s = data.stats;

  // Regroupement des prochains événements par jour.
  const byDay = new Map<string, DashboardDTO['upcomingEvents']>();
  for (const e of data.upcomingEvents) {
    const key = e.startAt.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  return (
    <>
      <PageHeader
        eyebrow={formatDate(new Date())}
        title={`Bonjour${isLawyer ? ', Maître' : ''} ${isLawyer ? session!.user.lastName : firstName}`}
        description="Voici l’essentiel de l’activité du cabinet aujourd’hui."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/agenda')}>
              <CalendarClock /> Agenda
            </Button>
            {can('dossiers.create') && (
              <Button onClick={() => navigate('/dossiers?nouveau=1')}>
                <FolderOpen /> Ouvrir un dossier
              </Button>
            )}
          </>
        }
      />
      <DemoGuide />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients actifs" value={s.clients} icon={UsersRound} onClick={() => navigate('/clients')} hint="Personnes physiques et morales" />
        <StatCard label="Dossiers actifs" value={s.activeDossiers} icon={FolderOpen} tone="blue" onClick={() => navigate('/dossiers?scope=actifs')} hint="Hors clôturés et archivés" />
        <StatCard label="Dossiers clôturés" value={s.closedDossiers} icon={Archive} tone="gray" onClick={() => navigate('/dossiers?status=cloture')} hint="Clôturés ou archivés" />
        <StatCard label="Audiences à venir" value={s.upcomingHearings} icon={Gavel} tone="gold" onClick={() => navigate('/agenda')} hint="Programmées dans l’agenda" />
        <StatCard label="Démarches en attente" value={s.pendingDemarches} icon={Landmark} tone="orange" onClick={() => navigate('/demarches?status=ouvertes')} hint="À effectuer, en cours ou reportées" />
        <StatCard label="Tâches en cours" value={s.openTasks} icon={ListChecks} tone="blue" onClick={() => navigate('/taches')} hint="Non terminées" />
        {can('billing.read') ? (
          <StatCard label="Factures en attente" value={s.unpaidInvoices} icon={Receipt} tone="red" onClick={() => navigate('/facturation')} hint={`${fcfa(s.unpaidAmount)} restant dus`} />
        ) : (
          <StatCard label="Mes tâches ouvertes" value={data.myTasks.length} icon={ListChecks} tone="red" onClick={() => navigate('/taches?mine=1')} hint="Qui me sont attribuées" />
        )}
        <StatCard label="Échéances urgentes" value={data.urgent.length} icon={AlarmClock} tone="red" hint={`${data.urgent.filter((u) => u.overdue).length} en retard`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Dossiers par domaine juridique" description="Dossiers accessibles, toutes situations confondues">
          <CategoryChart data={data.byCategory} />
        </Panel>
        <Panel title="Répartition par statut" description="Cliquez sur un statut pour filtrer les dossiers">
          <StatusBreakdown data={data.byStatus} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Prochaines audiences et rendez-vous"
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate('/agenda')}>
              Ouvrir l’agenda <ArrowRight />
            </Button>
          }
        >
          {byDay.size === 0 ? (
            <EmptyState title="Aucun événement à venir" />
          ) : (
            <div className="space-y-4">
              {[...byDay.entries()].map(([dayKey, events]) => (
                <div key={dayKey} className="flex gap-4">
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-[11px] uppercase text-muted-foreground">{formatDayMonth(dayKey).split(' ')[0]}</div>
                    <div className="font-serif text-2xl font-semibold leading-none">{toDate(dayKey).getDate()}</div>
                    <div className="text-[11px] text-muted-foreground">{formatDayMonth(dayKey).split(' ').slice(2).join(' ')}</div>
                  </div>
                  <ul className="flex-1 space-y-2">
                    {events.map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/agenda?date=${e.startAt.slice(0, 10)}`}
                          className={cn('block rounded-md border-l-[3px] px-3 py-2 transition-opacity hover:opacity-85', EVENT_TYPE_STYLE[e.type].bar, EVENT_TYPE_STYLE[e.type].bg)}
                        >
                          <div className={cn('flex items-center justify-between gap-2 text-[13px] font-medium', EVENT_TYPE_STYLE[e.type].text)}>
                            <span className="truncate">{e.title}</span>
                            <span className="tabular shrink-0 text-xs">{formatTime(e.startAt)}</span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {EVENT_TYPE_LABELS[e.type]}
                            {e.location ? ` · ${e.location}` : ''}
                            {e.assignee ? ` · ${e.assignee.fullName}` : ''}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Échéances urgentes" description="Retards et échéances des 3 à 7 prochains jours">
          {data.urgent.length === 0 ? (
            <EmptyState title="Aucune échéance urgente" icon={CheckCircle2} />
          ) : (
            <ul className="divide-y divide-border/70">
              {data.urgent.map((u) => (
                <li key={`${u.kind}-${u.id}`}>
                  <Link href={u.href} className="flex items-start gap-3 py-2.5 hover:opacity-80">
                    <AlarmClock className={cn('mt-0.5 size-4 shrink-0', u.overdue ? 'text-red-600' : 'text-amber-600')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{u.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.subtitle}</span>
                    </span>
                    <StatusPill tone={u.overdue ? 'red' : 'orange'}>{u.overdue ? 'En retard' : dueLabel(u.date)}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Dernières opérations" description="Historique des actions de l’équipe">
          <ol className="relative space-y-4 border-l border-border pl-5">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="relative">
                <CircleDot className="absolute -left-[27px] top-0.5 size-3.5 bg-card text-[#b08d3c]" />
                <div className="text-[13px]">{a.summary}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{a.user?.fullName ?? 'Système'}</span>
                  <span>·</span>
                  <span>{relativeTime(a.createdAt)}</span>
                  {a.dossier && (
                    <>
                      <span>·</span>
                      <Link href={`/dossiers/${a.dossier.id}`} className="font-mono text-[11px] text-[#8a6d2b] hover:underline">
                        {a.dossier.reference}
                      </Link>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel
          title="Mes tâches"
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate('/taches?mine=1')}>
              Tout voir <ArrowRight />
            </Button>
          }
        >
          {data.myTasks.length === 0 ? (
            <EmptyState title="Aucune tâche en cours" description="Les tâches qui vous sont attribuées apparaîtront ici." icon={CheckCircle2} />
          ) : (
            <ul className="space-y-2.5">
              {data.myTasks.map((t) => (
                <li key={t.id} className="rounded-lg border border-border/80 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-medium">{t.title}</span>
                    <StatusPill tone={PRIORITY_TONE[t.priority]}>{TASK_PRIORITY_LABELS[t.priority]}</StatusPill>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {t.dossier && <span className="font-mono">{t.dossier.reference}</span>}
                    {t.dueDate && <span>· échéance {formatDate(t.dueDate)}</span>}
                    {t.createdBy && t.createdBy.id !== t.assignee.id && (
                      <span className="ml-auto flex items-center gap-1">
                        <Avatar name={t.createdBy.fullName} className="size-5 text-[9px]" />
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
