import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, Clock4, GanttChartSquare, Landmark, List, Plus, Undo2 } from 'lucide-react';
import { DEMARCHE_STATUSES, DEMARCHE_STATUS_LABELS, DEMARCHE_TYPES, DEMARCHE_TYPE_LABELS, type DemarcheDTO } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { useUsers } from '@/hooks/use-data';
import { daysUntil, formatShortDate } from '@/lib/format';
import { useQueryParam } from '@/lib/url';
import { Avatar, EmptyState, ErrorState, FilterSelect, Hint, LoadingState, PageHeader, Panel, SearchInput, StatCard, useDebounced } from '@/components/app/common';
import { DemarcheStatusPill } from '@/components/app/badges';
import { DemarcheFormDialog } from '@/components/forms/ActivityForms';
import { DemarchesTimeline } from '@/components/dossier/DemarchesTimeline';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export default function DemarchesPage() {
  const { can } = useSession();
  const users = useUsers();
  const [status, setStatus] = useState(useQueryParam('status') ?? 'tous');
  const [type, setType] = useState('tous');
  const [assigneeId, setAssigneeId] = useState('tous');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'liste' | 'chronologie'>('liste');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DemarcheDTO | null>(null);
  const q = useDebounced(search);

  const all = useQuery({ queryKey: ['demarches', 'all'], queryFn: () => api.get<DemarcheDTO[]>('/demarches') });
  const filtered = useQuery({
    queryKey: ['demarches', { status, type, assigneeId, q }],
    queryFn: () => api.get<DemarcheDTO[]>('/demarches', { status, type, assigneeId, search: q }),
  });

  const stats = useMemo(() => {
    const items = all.data ?? [];
    const month = new Date().toISOString().slice(0, 7);
    return {
      todo: items.filter((d) => d.status === 'a_effectuer').length,
      ongoing: items.filter((d) => d.status === 'en_cours' || d.status === 'en_attente').length,
      done: items.filter((d) => d.status === 'effectuee' && d.executedDate?.startsWith(month)).length,
      postponed: items.filter((d) => d.status === 'reportee').length,
    };
  }, [all.data]);

  return (
    <>
      <PageHeader
        title="Démarches au palais de justice"
        description="Dépôts de requêtes et de pièces, retraits, demandes de renseignements, suivis de procédure : qui fait quoi, où et quand."
        actions={
          can('demarches.write') && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Enregistrer une démarche
            </Button>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="À effectuer" value={stats.todo} icon={CalendarClock} tone="gold" onClick={() => setStatus('a_effectuer')} />
        <StatCard label="En cours / en attente" value={stats.ongoing} icon={Clock4} tone="orange" onClick={() => setStatus('ouvertes')} />
        <StatCard label="Effectuées ce mois" value={stats.done} icon={CheckCircle2} tone="green" onClick={() => setStatus('effectuee')} />
        <StatCard label="Reportées" value={stats.postponed} icon={Undo2} tone="red" onClick={() => setStatus('reportee')} />
      </div>

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Juridiction, observations…" className="min-w-[220px] flex-1" />
          <FilterSelect
            label="Statut"
            value={status}
            onChange={setStatus}
            options={[{ value: 'tous', label: 'Tous les statuts' }, { value: 'ouvertes', label: 'Non effectuées' }, ...DEMARCHE_STATUSES.map((s) => ({ value: s, label: DEMARCHE_STATUS_LABELS[s] }))]}
          />
          <FilterSelect label="Type" value={type} onChange={setType} options={[{ value: 'tous', label: 'Tous les types' }, ...DEMARCHE_TYPES.map((t) => ({ value: t, label: DEMARCHE_TYPE_LABELS[t] }))]} />
          <FilterSelect
            label="Personne chargée"
            value={assigneeId}
            onChange={setAssigneeId}
            options={[{ value: 'tous', label: 'Toute l’équipe' }, ...(users.data ?? []).filter((u) => u.role !== 'comptable').map((u) => ({ value: String(u.id), label: u.fullName }))]}
          />
          <div className="ml-auto flex rounded-md border p-0.5">
            {(
              [
                ['liste', List, 'Liste'],
                ['chronologie', GanttChartSquare, 'Chronologie'],
              ] as const
            ).map(([v, Icon, label]) => (
              <button key={v} onClick={() => setView(v)} className={cn('flex items-center gap-1.5 rounded px-2.5 py-1 text-xs', view === v ? 'bg-[#14213d] text-white' : 'text-muted-foreground hover:bg-muted')}>
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.isLoading ? (
          <LoadingState />
        ) : filtered.error ? (
          <div className="p-4">
            <ErrorState error={filtered.error} onRetry={() => filtered.refetch()} />
          </div>
        ) : !filtered.data?.length ? (
          <div className="p-6">
            <EmptyState title="Aucune démarche" icon={Landmark} description="Aucune démarche ne correspond à ces critères." />
          </div>
        ) : view === 'chronologie' ? (
          <div className="p-5">
            <Hint>Chronologie de la plus récente à la plus ancienne. La chronologie propre à chaque dossier figure dans l’onglet « Démarches » du dossier.</Hint>
            <div className="mt-5">
              <DemarchesTimeline items={filtered.data} showDossier order="desc" />
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Démarche</TableHead>
                <TableHead className="hidden lg:table-cell">Dossier</TableHead>
                <TableHead>Date prévue</TableHead>
                <TableHead className="hidden md:table-cell">Exécution</TableHead>
                <TableHead className="hidden sm:table-cell">Chargé(e)</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.data.map((d) => {
                const late = d.status !== 'effectuee' && daysUntil(d.plannedDate) < 0;
                return (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => setEditing(d)}>
                    <TableCell className="max-w-[340px] pl-5">
                      <div className="font-medium">{DEMARCHE_TYPE_LABELS[d.type]}</div>
                      <div className="truncate text-xs text-muted-foreground">{d.jurisdiction}</div>
                      {d.observations && <div className="truncate text-xs text-muted-foreground/80">{d.observations}</div>}
                    </TableCell>
                    <TableCell className="hidden max-w-[260px] lg:table-cell">
                      <Link href={`/dossiers/${d.dossierId}?onglet=demarches`} onClick={(e) => e.stopPropagation()} className="block truncate text-sm hover:underline">
                        <span className="font-mono text-xs text-[#8a6d2b]">{d.dossierReference}</span> {d.dossierTitle}
                      </Link>
                    </TableCell>
                    <TableCell className={cn('text-sm', late && 'font-medium text-red-600')}>{formatShortDate(d.plannedDate)}</TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{d.executedDate ? formatShortDate(d.executedDate) : '—'}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="flex items-center gap-2 text-sm">
                        <Avatar name={d.assignee.fullName} className="size-6 text-[9px]" />
                        <span className="hidden xl:inline">{d.assignee.fullName}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <DemarcheStatusPill status={d.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
      {creating && <DemarcheFormDialog open onOpenChange={setCreating} />}
      {editing && <DemarcheFormDialog open onOpenChange={(o) => !o && setEditing(null)} demarche={editing} />}
    </>
  );
}
