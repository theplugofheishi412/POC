import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlarmClock, Bell, CalendarPlus, ChevronLeft, ChevronRight, MapPin, Pencil, Trash2, UserRound } from 'lucide-react';
import { EVENT_STATUS_LABELS, EVENT_TYPES, EVENT_TYPE_LABELS, type EventDTO } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { useApiMutation, useUsers } from '@/hooks/use-data';
import { formatDateTime, formatTime, relativeTime, toDate } from '@/lib/format';
import { useQueryParam } from '@/lib/url';
import { EVENT_TYPE_STYLE } from '@/lib/tones';
import { ConfirmDialog, ErrorState, FilterSelect, PageHeader, Panel } from '@/components/app/common';
import { EventFormDialog } from '@/components/forms/ActivityForms';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type View = 'mois' | 'semaine' | 'jour';
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7h → 19h
const HOUR_PX = 52;
const URGENT_TYPES = ['echeance', 'audience', 'depot_requete'];

function isUrgent(e: EventDTO) {
  const diff = new Date(e.startAt).getTime() - Date.now();
  return e.status === 'prevu' && URGENT_TYPES.includes(e.type) && diff > -3_600_000 && diff < 3 * 86_400_000;
}

function EventChip({ e, onClick, compact }: { e: EventDTO; onClick: () => void; compact?: boolean }) {
  const s = EVENT_TYPE_STYLE[e.type];
  return (
    <button
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
      className={cn(
        'block w-full truncate rounded border-l-[3px] px-1.5 text-left text-[11px] leading-5 transition-opacity hover:opacity-80',
        s.bar,
        s.bg,
        s.text,
        e.status === 'annule' && 'line-through opacity-50',
        isUrgent(e) && 'ring-1 ring-red-500/60',
      )}
      title={`${formatTime(e.startAt)} — ${e.title}`}
    >
      {!compact && <span className="tabular mr-1 font-medium">{formatTime(e.startAt)}</span>}
      {e.title}
    </button>
  );
}

export default function AgendaPage() {
  const { can } = useSession();
  const users = useUsers();
  const initial = useQueryParam('date');
  const [cursor, setCursor] = useState<Date>(initial ? toDate(initial) : new Date());
  const [view, setView] = useState<View>(initial ? 'jour' : 'mois');
  const [type, setType] = useState('tous');
  const [assigneeId, setAssigneeId] = useState('tous');
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [form, setForm] = useState<{ event?: EventDTO; start?: Date } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const range = useMemo(() => {
    if (view === 'mois') return { from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), to: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) };
    if (view === 'semaine') return { from: startOfWeek(cursor, { weekStartsOn: 1 }), to: endOfWeek(cursor, { weekStartsOn: 1 }) };
    return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
  }, [cursor, view]);

  const events = useQuery({
    queryKey: ['events', { from: range.from.toISOString(), to: range.to.toISOString(), type, assigneeId }],
    queryFn: () => api.get<EventDTO[]>('/events', { from: range.from.toISOString(), to: range.to.toISOString(), type, assigneeId }),
  });
  const upcoming = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: () => api.get<EventDTO[]>('/events', { from: new Date().toISOString(), to: addDays(new Date(), 14).toISOString() }),
  });

  const remove = useApiMutation((e: EventDTO) => api.delete(`/events/${e.id}`), {
    success: 'Événement supprimé.',
    invalidate: [['events'], ['dossier']],
    onSuccess: () => {
      setConfirmDelete(false);
      setSelected(null);
    },
  });

  const list = events.data ?? [];
  const onDay = (d: Date) => list.filter((e) => isSameDay(new Date(e.startAt), d));
  const move = (dir: 1 | -1) => setCursor(view === 'mois' ? addMonths(cursor, dir) : view === 'semaine' ? addWeeks(cursor, dir) : addDays(cursor, dir));
  const createAt = (d: Date, hour = 9) => {
    if (!can('events.write')) return;
    const start = new Date(d);
    start.setHours(hour, 0, 0, 0);
    setForm({ start });
  };
  const title =
    view === 'mois'
      ? format(cursor, 'MMMM yyyy', { locale: fr })
      : view === 'semaine'
        ? `Semaine du ${format(range.from, 'd MMMM', { locale: fr })} au ${format(range.to, 'd MMMM yyyy', { locale: fr })}`
        : format(cursor, 'EEEE d MMMM yyyy', { locale: fr });

  const deadlines = (upcoming.data ?? []).filter((e) => e.status === 'prevu' && URGENT_TYPES.includes(e.type)).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Agenda et audiences"
        description="Audiences, rendez-vous clients, dépôts, déplacements au tribunal, échéances de procédure et réunions internes."
        actions={
          can('events.write') && (
            <Button onClick={() => setForm({})}>
              <CalendarPlus /> Nouvel événement
            </Button>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Panel bodyClassName="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-4">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="size-8" onClick={() => move(-1)} aria-label="Précédent">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
                Aujourd’hui
              </Button>
              <Button variant="outline" size="icon" className="size-8" onClick={() => move(1)} aria-label="Suivant">
                <ChevronRight />
              </Button>
            </div>
            <h2 className="ml-1 font-serif text-lg font-semibold first-letter:uppercase">{title}</h2>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <FilterSelect label="Type" value={type} onChange={setType} options={[{ value: 'tous', label: 'Tous les types' }, ...EVENT_TYPES.map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] }))]} className="min-w-[140px]" />
              <FilterSelect
                label="Collaborateur"
                value={assigneeId}
                onChange={setAssigneeId}
                options={[{ value: 'tous', label: 'Toute l’équipe' }, ...(users.data ?? []).map((u) => ({ value: String(u.id), label: u.fullName }))]}
                className="min-w-[140px]"
              />
              <div className="flex rounded-md border p-0.5">
                {(['mois', 'semaine', 'jour'] as View[]).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={cn('rounded px-2.5 py-1 text-xs capitalize', view === v ? 'bg-[#14213d] text-white' : 'text-muted-foreground hover:bg-muted')}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {events.error ? (
            <div className="p-4">
              <ErrorState error={events.error} onRetry={() => events.refetch()} />
            </div>
          ) : view === 'mois' ? (
            <div className={cn('transition-opacity', events.isFetching && 'opacity-70')}>
              <div className="grid grid-cols-7 border-b text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                  <div key={d} className="py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) }, (_, i) => addDays(range.from, i)).map((day) => {
                  const items = onDay(day);
                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => createAt(day)}
                      onDoubleClick={() => {
                        setCursor(day);
                        setView('jour');
                      }}
                      className={cn('min-h-[104px] cursor-pointer border-b border-r p-1.5 transition-colors hover:bg-muted/30', !isSameMonth(day, cursor) && 'bg-muted/30 text-muted-foreground')}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCursor(day);
                          setView('jour');
                        }}
                        className={cn('mb-1 grid size-6 place-items-center rounded-full text-xs', isToday(day) ? 'bg-[#14213d] font-semibold text-white' : 'hover:bg-muted')}
                      >
                        {day.getDate()}
                      </button>
                      <div className="space-y-0.5">
                        {items.slice(0, 3).map((e) => (
                          <EventChip key={e.id} e={e} onClick={() => setSelected(e)} />
                        ))}
                        {items.length > 3 && (
                          <button
                            className="px-1 text-[11px] text-muted-foreground hover:underline"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setCursor(day);
                              setView('jour');
                            }}
                          >
                            + {items.length - 3} autre(s)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <TimeGrid
              days={view === 'semaine' ? Array.from({ length: 7 }, (_, i) => addDays(range.from, i)) : [startOfDay(cursor)]}
              events={list}
              onSelect={setSelected}
              onCreate={createAt}
            />
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3 text-[11px] text-muted-foreground">
            {EVENT_TYPES.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className={cn('h-3 w-1 rounded-sm border-l-[3px]', EVENT_TYPE_STYLE[t].bar)} /> {EVENT_TYPE_LABELS[t]}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm ring-1 ring-red-500" /> Échéance sous 72 h
            </span>
            {can('events.write') && <span className="ml-auto">Cliquez sur un jour ou un créneau pour créer un événement.</span>}
          </div>
        </Panel>

        <Panel title="Échéances et audiences à venir" description="14 prochains jours">
          {deadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune échéance.</p>
          ) : (
            <ul className="space-y-2.5">
              {deadlines.map((e) => {
                const urgent = isUrgent(e);
                return (
                  <li key={e.id}>
                    <button onClick={() => setSelected(e)} className={cn('w-full rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/40', urgent ? 'border-red-300 bg-red-50/50' : 'border-border')}>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium">
                        <AlarmClock className={cn('size-3.5', urgent ? 'text-red-600' : 'text-muted-foreground')} />
                        <span className={urgent ? 'text-red-700' : 'text-muted-foreground'}>
                          {EVENT_TYPE_LABELS[e.type]} · {relativeTime(e.startAt)}
                        </span>
                      </div>
                      <div className="mt-1 text-[13px] font-medium leading-snug">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(e.startAt)}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <div className={cn('mb-1 w-fit rounded px-2 py-0.5 text-[11px] font-medium', EVENT_TYPE_STYLE[selected.type].bg, EVENT_TYPE_STYLE[selected.type].text)}>{EVENT_TYPE_LABELS[selected.type]}</div>
                <DialogTitle className="font-serif text-xl">{selected.title}</DialogTitle>
                <DialogDescription>
                  {formatDateTime(selected.startAt)} → {formatTime(selected.endAt)} · {EVENT_STATUS_LABELS[selected.status]}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2.5 text-sm">
                {selected.dossier && (
                  <Link href={`/dossiers/${selected.dossier.id}?onglet=agenda`} className="block rounded-md bg-muted/50 px-3 py-2 hover:bg-muted">
                    <span className="font-mono text-xs text-[#8a6d2b]">{selected.dossier.reference}</span> {selected.dossier.title}
                  </Link>
                )}
                {selected.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" /> {selected.location}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <UserRound className="size-4 text-muted-foreground" /> {selected.assignee?.fullName ?? 'Toute l’équipe'}
                </div>
                {selected.reminderMinutes > 0 && (
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 text-muted-foreground" /> Rappel{' '}
                    {selected.reminderMinutes >= 1440 ? `${selected.reminderMinutes / 1440} jour(s)` : `${selected.reminderMinutes / 60} h`} avant
                  </div>
                )}
                {selected.description && <p className="whitespace-pre-line rounded-md border px-3 py-2">{selected.description}</p>}
              </div>
              {can('events.write') && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Supprimer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setForm({ event: selected });
                      setSelected(null);
                    }}
                  >
                    <Pencil /> Modifier
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {form && <EventFormDialog open onOpenChange={(o) => !o && setForm(null)} event={form.event} defaultStart={form.start} />}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer cet événement ?"
        description="L’événement sera retiré de l’agenda du cabinet."
        confirmLabel="Supprimer"
        destructive
        pending={remove.isPending}
        onConfirm={() => selected && remove.mutate(selected)}
      />
    </>
  );
}

function TimeGrid({ days, events, onSelect, onCreate }: { days: Date[]; events: EventDTO[]; onSelect: (e: EventDTO) => void; onCreate: (d: Date, h: number) => void }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => (
            <div key={d.toISOString()} className={cn('py-2 text-center text-xs', isToday(d) && 'font-semibold text-[#14213d]')}>
              <span className="capitalize">{format(d, days.length > 1 ? 'EEE d' : 'EEEE d MMMM', { locale: fr })}</span>
            </div>
          ))}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div>
            {HOURS.map((h) => (
              <div key={h} className="pr-2 text-right text-[10px] text-muted-foreground" style={{ height: HOUR_PX }}>
                {h}h
              </div>
            ))}
          </div>
          {days.map((d) => {
            const dayEvents = events.filter((e) => isSameDay(new Date(e.startAt), d));
            return (
              <div key={d.toISOString()} className={cn('relative border-l', isToday(d) && 'bg-[#fbf7ee]/40')}>
                {HOURS.map((h) => (
                  <div key={h} onClick={() => onCreate(d, h)} className="cursor-pointer border-b border-dashed border-border/60 hover:bg-muted/40" style={{ height: HOUR_PX }} />
                ))}
                {dayEvents.map((e) => {
                  const start = new Date(e.startAt);
                  const end = new Date(e.endAt);
                  const top = Math.max(0, (start.getHours() + start.getMinutes() / 60 - HOURS[0]!) * HOUR_PX);
                  const height = Math.max(22, ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_PX - 2);
                  const s = EVENT_TYPE_STYLE[e.type];
                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e)}
                      className={cn('absolute inset-x-1 overflow-hidden rounded border-l-[3px] px-1.5 py-0.5 text-left text-[11px] shadow-sm hover:opacity-85', s.bar, s.bg, s.text, isUrgent(e) && 'ring-1 ring-red-500/60', e.status === 'annule' && 'opacity-50')}
                      style={{ top, height }}
                    >
                      <div className="font-medium leading-tight">{e.title}</div>
                      <div className="opacity-75">
                        {formatTime(e.startAt)} – {formatTime(e.endAt)}
                        {e.location ? ` · ${e.location}` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

