import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ListPlus, Pencil, Trash2 } from 'lucide-react';
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskDTO, type TaskStatus } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { useApiMutation, useUsers } from '@/hooks/use-data';
import { daysUntil, formatShortDate } from '@/lib/format';
import { useQueryParam } from '@/lib/url';
import { TASK_STATUS_TONE, TONE_DOT } from '@/lib/tones';
import { Avatar, ConfirmDialog, ErrorState, FilterSelect, LoadingState, PageHeader, SearchInput, useConfirm, useDebounced } from '@/components/app/common';
import { PriorityPill } from '@/components/app/badges';
import { TaskFormDialog } from '@/components/forms/ActivityForms';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function TachesPage() {
  const { session, can } = useSession();
  const me = session!.user.id;
  const users = useUsers();
  const qc = useQueryClient();
  const [assignee, setAssignee] = useState(useQueryParam('mine') === '1' ? String(me) : 'tous');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [dragged, setDragged] = useState<TaskDTO | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const del = useConfirm<TaskDTO>();
  const q = useDebounced(search);
  const key = ['tasks', 'board', { assignee, q }];

  const tasks = useQuery({ queryKey: key, queryFn: () => api.get<TaskDTO[]>('/tasks', { assigneeId: assignee, search: q }) });
  const setStatus = useApiMutation((v: { task: TaskDTO; status: TaskStatus }) => api.post<TaskDTO>(`/tasks/${v.task.id}/status`, { status: v.status }), {
    success: (t) => `« ${t.title} » → ${TASK_STATUS_LABELS[t.status]}`,
    invalidate: [['tasks']],
    onSuccess: () => undefined,
  });
  const remove = useApiMutation((t: TaskDTO) => api.delete(`/tasks/${t.id}`), { success: 'Tâche supprimée.', invalidate: [['tasks']], onSuccess: () => del.close() });

  const mayMove = (t: TaskDTO) => t.assignee.id === me || t.createdBy?.id === me || can('tasks.assign');
  const mayEdit = (t: TaskDTO) => t.createdBy?.id === me || can('tasks.assign');
  const drop = (status: TaskStatus) => {
    setOver(null);
    if (!dragged || dragged.status === status) return;
    if (!mayMove(dragged)) return;
    // Mise à jour optimiste du tableau, confirmée par le serveur.
    qc.setQueryData<TaskDTO[]>(key, (old) => old?.map((t) => (t.id === dragged.id ? { ...t, status } : t)));
    setStatus.mutate({ task: dragged, status });
    setDragged(null);
  };

  return (
    <>
      <PageHeader
        title="Tâches de l’équipe"
        description="Attribuez, suivez et faites avancer les tâches du cabinet. Glissez une carte d’une colonne à l’autre pour changer son statut."
        actions={
          <Button onClick={() => setCreating(true)}>
            <ListPlus /> {can('tasks.assign') ? 'Attribuer une tâche' : 'Nouvelle tâche'}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une tâche…" className="min-w-[220px] flex-1 sm:max-w-sm" />
        <FilterSelect
          label="Responsable"
          value={assignee}
          onChange={setAssignee}
          options={[{ value: 'tous', label: 'Toute l’équipe' }, { value: String(me), label: 'Mes tâches' }, ...(users.data ?? []).filter((u) => u.id !== me).map((u) => ({ value: String(u.id), label: u.fullName }))]}
        />
      </div>
      {tasks.isLoading ? (
        <LoadingState />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((status) => {
            const column = (tasks.data ?? []).filter((t) => t.status === status);
            return (
              <section
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(status);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={() => drop(status)}
                className={cn('flex min-h-[320px] flex-col rounded-xl border bg-muted/40 transition-colors', over === status && 'border-[#b08d3c] bg-[#fbf7ee]')}
              >
                <header className="flex items-center gap-2 px-3.5 py-3">
                  <span className={cn('size-2 rounded-full', TONE_DOT[TASK_STATUS_TONE[status]])} />
                  <h2 className="font-sans text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h2>
                  <span className="ml-auto rounded-full bg-card px-2 text-xs tabular text-muted-foreground">{column.length}</span>
                </header>
                <div className="flex-1 space-y-2.5 px-2.5 pb-3">
                  {column.map((t) => {
                    const late = t.status !== 'terminee' && t.dueDate && daysUntil(t.dueDate) < 0;
                    const soon = t.status !== 'terminee' && t.dueDate && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 1;
                    return (
                      <article
                        key={t.id}
                        draggable={mayMove(t)}
                        onDragStart={() => setDragged(t)}
                        onDragEnd={() => setDragged(null)}
                        className={cn('group rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)]', mayMove(t) && 'cursor-grab active:cursor-grabbing', dragged?.id === t.id && 'opacity-50')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className={cn('font-sans text-[13px] font-medium leading-snug', t.status === 'terminee' && 'text-muted-foreground line-through')}>{t.title}</h3>
                          {mayEdit(t) && (
                            <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
                              <button onClick={() => setEditing(t)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Modifier">
                                <Pencil className="size-3.5" />
                              </button>
                              <button onClick={() => del.ask(t)} className="rounded p-1 text-red-600 hover:bg-red-50" aria-label="Supprimer">
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        {t.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                        {t.dossier && (
                          <Link href={`/dossiers/${t.dossier.id}?onglet=taches`} className="mt-2 block truncate text-[11px] text-[#8a6d2b] hover:underline">
                            <span className="font-mono">{t.dossier.reference}</span> · {t.dossier.title}
                          </Link>
                        )}
                        <div className="mt-2.5 flex items-center gap-2">
                          <PriorityPill priority={t.priority} />
                          {t.dueDate && (
                            <span className={cn('flex items-center gap-1 text-[11px]', late ? 'font-medium text-red-600' : soon ? 'text-amber-700' : 'text-muted-foreground')}>
                              <CalendarClock className="size-3" /> {formatShortDate(t.dueDate)}
                            </span>
                          )}
                          <Avatar name={t.assignee.fullName} className="ml-auto size-6 text-[9px]" />
                        </div>
                        {/* Alternative au glisser-déposer (mobile, clavier) */}
                        {mayMove(t) && (
                          <select
                            aria-label="Changer le statut"
                            value={t.status}
                            onChange={(e) => setStatus.mutate({ task: t, status: e.target.value as TaskStatus })}
                            className="mt-2 w-full rounded border border-border bg-transparent px-1.5 py-1 text-[11px] text-muted-foreground md:hidden"
                          >
                            {TASK_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {TASK_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        )}
                      </article>
                    );
                  })}
                  {column.length === 0 && <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Aucune tâche</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {creating && <TaskFormDialog open onOpenChange={setCreating} />}
      {editing && <TaskFormDialog open onOpenChange={(o) => !o && setEditing(null)} task={editing} />}
      <ConfirmDialog
        open={del.open}
        onOpenChange={(o) => !o && del.close()}
        title="Supprimer cette tâche ?"
        description={`« ${del.target?.title} » sera définitivement supprimée.`}
        confirmLabel="Supprimer"
        destructive
        pending={remove.isPending}
        onConfirm={() => del.target && remove.mutate(del.target)}
      />
    </>
  );
}
