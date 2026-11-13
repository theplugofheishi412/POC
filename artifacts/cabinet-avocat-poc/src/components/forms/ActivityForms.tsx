import {
  DEMARCHE_STATUSES,
  DEMARCHE_STATUS_LABELS,
  DEMARCHE_TYPES,
  DEMARCHE_TYPE_LABELS,
  demarcheSchema,
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  eventSchema,
  JURISDICTIONS,
  PARTY_ROLES,
  PARTY_ROLE_LABELS,
  partySchema,
  ROLE_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  taskSchema,
  type DemarcheDTO,
  type EventDTO,
  type PartyDTO,
  type TaskDTO,
} from '@workspace/api-zod';
import { api } from '@/lib/api';
import { todayIso, toLocalInput } from '@/lib/format';
import { useApiMutation, useClientOptions, useDossierOptions, useUsers } from '@/hooks/use-data';
import { useSession } from '@/hooks/use-session';
import { Field, Hint, inputClass, NativeSelect } from '@/components/app/common';
import { applyServerErrors, fieldError, FormDialog, useZodForm } from '@/components/app/form';
import { cn } from '@/lib/utils';

const textarea = cn(inputClass, 'h-auto py-2');

function DossierSelect({ register, lockedId }: { register: ReturnType<ReturnType<typeof useZodForm>['register']>; lockedId?: number }) {
  const dossiers = useDossierOptions();
  return (
    <NativeSelect {...register} className={lockedId ? 'pointer-events-none opacity-70' : undefined} tabIndex={lockedId ? -1 : undefined}>
      <option value="">— Aucun dossier —</option>
      {dossiers.data
        ?.filter((d) => !lockedId || d.id === lockedId || !['archive'].includes(d.status))
        .map((d) => (
          <option key={d.id} value={d.id}>
            {d.reference} — {d.title}
          </option>
        ))}
    </NativeSelect>
  );
}

function UserOptions({ includeEmpty, filter }: { includeEmpty?: string; filter?: (role: string) => boolean }) {
  const users = useUsers();
  return (
    <>
      {includeEmpty !== undefined && <option value="">{includeEmpty}</option>}
      {users.data
        ?.filter((u) => u.active && (!filter || filter(u.role)))
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.fullName} — {ROLE_LABELS[u.role]}
          </option>
        ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Démarche au palais                                                 */
/* ------------------------------------------------------------------ */

export function DemarcheFormDialog({
  open,
  onOpenChange,
  demarche,
  dossierId,
  defaultJurisdiction,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demarche?: DemarcheDTO | null;
  dossierId?: number;
  defaultJurisdiction?: string | null;
}) {
  const { session, can } = useSession();
  const canAssign = can('tasks.assign');
  const defaults = demarche
    ? {
        dossierId: String(demarche.dossierId),
        type: demarche.type,
        jurisdiction: demarche.jurisdiction,
        assigneeId: String(demarche.assignee.id),
        plannedDate: demarche.plannedDate,
        executedDate: demarche.executedDate ?? '',
        status: demarche.status,
        observations: demarche.observations ?? '',
        result: demarche.result ?? '',
      }
    : {
        dossierId: dossierId ? String(dossierId) : '',
        type: 'depot_requete',
        jurisdiction: defaultJurisdiction ?? '',
        assigneeId: String(session!.user.id),
        plannedDate: todayIso(1),
        executedDate: '',
        status: 'a_effectuer',
        observations: '',
        result: '',
      };
  const form = useZodForm(demarcheSchema, defaults, [open, demarche?.id]);
  const status = form.watch('status');
  const mutation = useApiMutation(
    (v: Record<string, unknown>) => (demarche ? api.patch<DemarcheDTO>(`/demarches/${demarche.id}`, v) : api.post<DemarcheDTO>('/demarches', v)),
    {
      success: demarche ? 'Démarche mise à jour.' : 'Démarche enregistrée.',
      invalidate: [['demarches'], ['dossier']],
      onSuccess: () => onOpenChange(false),
    },
  );
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={demarche ? 'Mettre à jour la démarche' : 'Enregistrer une démarche au palais'}
      description="Dépôt, retrait, renseignement ou suivi effectué auprès d’une juridiction ou d’un greffe."
      onSubmit={submit}
      pending={mutation.isPending}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dossier concerné" required error={err('dossierId')} className="sm:col-span-2">
          <DossierSelect register={form.register('dossierId')} lockedId={dossierId} />
        </Field>
        <Field label="Type de démarche" required error={err('type')}>
          <NativeSelect {...form.register('type')}>
            {DEMARCHE_TYPES.map((t) => (
              <option key={t} value={t}>
                {DEMARCHE_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Juridiction / lieu" required error={err('jurisdiction')}>
          <input className={inputClass} list="demarche-jurisdictions" {...form.register('jurisdiction')} />
          <datalist id="demarche-jurisdictions">
            {JURISDICTIONS.map((j) => (
              <option key={j} value={j} />
            ))}
          </datalist>
        </Field>
        <Field label="Personne chargée" required error={err('assigneeId')} hint={!canAssign ? 'Vous ne pouvez enregistrer que vos propres démarches.' : undefined}>
          <NativeSelect {...form.register('assigneeId')} className={canAssign ? undefined : 'pointer-events-none opacity-70'} tabIndex={canAssign ? undefined : -1}>
            <UserOptions filter={(r) => r !== 'comptable'} />
          </NativeSelect>
        </Field>
        <Field label="Statut" required error={err('status')}>
          <NativeSelect {...form.register('status')}>
            {DEMARCHE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DEMARCHE_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date prévue" required error={err('plannedDate')}>
          <input type="date" className={inputClass} {...form.register('plannedDate')} />
        </Field>
        <Field label="Date d’exécution" required={status === 'effectuee'} error={err('executedDate')}>
          <input type="date" className={inputClass} {...form.register('executedDate')} />
        </Field>
        <Field label="Observations" error={err('observations')} className="sm:col-span-2">
          <textarea rows={3} className={textarea} placeholder="Ex. : Requête déposée, en attente du numéro de rôle." {...form.register('observations')} />
        </Field>
        <Field label="Résultat / suite donnée" error={err('result')} className="sm:col-span-2">
          <input className={inputClass} placeholder="Ex. : Récépissé délivré, enrôlée sous le n° …" {...form.register('result')} />
        </Field>
      </div>
      <Hint>Les justificatifs (récépissé, accusé de dépôt…) se joignent depuis la démarche une fois enregistrée.</Hint>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Événement d'agenda                                                 */
/* ------------------------------------------------------------------ */

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  dossierId,
  defaultStart,
  defaultType = 'audience',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event?: EventDTO | null;
  dossierId?: number;
  defaultStart?: Date;
  defaultType?: string;
}) {
  const start = defaultStart ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  })();
  const defaults = event
    ? {
        type: event.type,
        title: event.title,
        dossierId: event.dossier ? String(event.dossier.id) : '',
        startAt: toLocalInput(new Date(event.startAt)),
        endAt: toLocalInput(new Date(event.endAt)),
        location: event.location ?? '',
        assigneeId: event.assignee ? String(event.assignee.id) : '',
        description: event.description ?? '',
        reminderMinutes: String(event.reminderMinutes),
        status: event.status,
      }
    : {
        type: defaultType,
        title: '',
        dossierId: dossierId ? String(dossierId) : '',
        startAt: toLocalInput(start),
        endAt: toLocalInput(new Date(start.getTime() + 60 * 60_000)),
        location: '',
        assigneeId: '',
        description: '',
        reminderMinutes: '1440',
        status: 'prevu',
      };
  const form = useZodForm(eventSchema, defaults, [open, event?.id, defaultStart?.getTime()]);
  const mutation = useApiMutation(
    (v: Record<string, unknown>) => {
      // datetime-local → ISO avec fuseau du navigateur
      const body = { ...v, startAt: new Date(String(v.startAt)).toISOString(), endAt: new Date(String(v.endAt)).toISOString() };
      return event ? api.patch<EventDTO>(`/events/${event.id}`, body) : api.post<EventDTO>('/events', body);
    },
    { success: event ? 'Événement mis à jour.' : 'Événement ajouté à l’agenda.', invalidate: [['events'], ['dossier'], ['dossiers']], onSuccess: () => onOpenChange(false) },
  );
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={event ? 'Modifier l’événement' : 'Nouvel événement'} onSubmit={submit} pending={mutation.isPending} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required error={err('type')}>
          <NativeSelect {...form.register('type')}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Statut" error={err('status')}>
          <NativeSelect {...form.register('status')}>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EVENT_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Intitulé" required error={err('title')} className="sm:col-span-2">
          <input className={inputClass} placeholder="Ex. : Audience de mise en état — Société A c. Société B" {...form.register('title')} />
        </Field>
        <Field label="Dossier" error={err('dossierId')} className="sm:col-span-2">
          <DossierSelect register={form.register('dossierId')} lockedId={dossierId} />
        </Field>
        <Field label="Début" required error={err('startAt')}>
          <input type="datetime-local" className={inputClass} {...form.register('startAt')} />
        </Field>
        <Field label="Fin" required error={err('endAt')}>
          <input type="datetime-local" className={inputClass} {...form.register('endAt')} />
        </Field>
        <Field label="Lieu / juridiction" error={err('location')}>
          <input className={inputClass} list="event-locations" {...form.register('location')} />
          <datalist id="event-locations">
            {['Cabinet — salle de réunion', ...JURISDICTIONS].map((j) => (
              <option key={j} value={j} />
            ))}
          </datalist>
        </Field>
        <Field label="Collaborateur chargé" error={err('assigneeId')}>
          <NativeSelect {...form.register('assigneeId')}>
            <UserOptions includeEmpty="— Toute l’équipe —" />
          </NativeSelect>
        </Field>
        <Field label="Rappel" error={err('reminderMinutes')}>
          <NativeSelect {...form.register('reminderMinutes')}>
            <option value="0">Aucun rappel</option>
            <option value="60">1 heure avant</option>
            <option value="1440">La veille</option>
            <option value="2880">2 jours avant</option>
            <option value="10080">1 semaine avant</option>
          </NativeSelect>
        </Field>
        <Field label="Notes" error={err('description')} className="sm:col-span-2">
          <textarea rows={2} className={textarea} {...form.register('description')} />
        </Field>
      </div>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Tâche                                                              */
/* ------------------------------------------------------------------ */

export function TaskFormDialog({ open, onOpenChange, task, dossierId }: { open: boolean; onOpenChange: (o: boolean) => void; task?: TaskDTO | null; dossierId?: number }) {
  const { session, can } = useSession();
  const canAssign = can('tasks.assign');
  const defaults = task
    ? {
        title: task.title,
        description: task.description ?? '',
        dossierId: task.dossier ? String(task.dossier.id) : '',
        assigneeId: String(task.assignee.id),
        dueDate: task.dueDate ?? '',
        priority: task.priority,
        status: task.status,
      }
    : { title: '', description: '', dossierId: dossierId ? String(dossierId) : '', assigneeId: String(session!.user.id), dueDate: todayIso(3), priority: 'normale', status: 'a_faire' };
  const form = useZodForm(taskSchema, defaults, [open, task?.id]);
  const mutation = useApiMutation((v: Record<string, unknown>) => (task ? api.patch<TaskDTO>(`/tasks/${task.id}`, v) : api.post<TaskDTO>('/tasks', v)), {
    success: (t) => (task ? 'Tâche mise à jour.' : `Tâche attribuée à ${t.assignee.fullName}.`),
    invalidate: [['tasks'], ['dossier']],
    onSuccess: () => onOpenChange(false),
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={task ? 'Modifier la tâche' : 'Attribuer une tâche'} onSubmit={submit} pending={mutation.isPending} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre" required error={err('title')} className="sm:col-span-2">
          <input className={inputClass} list="task-examples" placeholder="Ex. : Préparer le bordereau de pièces" {...form.register('title')} />
          <datalist id="task-examples">
            {['Préparer un bordereau de pièces', 'Rédiger une requête', 'Effectuer les photocopies', 'Déposer un document au palais', 'Contacter le client', 'Préparer l’audience'].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Dossier associé" error={err('dossierId')} className="sm:col-span-2">
          <DossierSelect register={form.register('dossierId')} lockedId={dossierId} />
        </Field>
        <Field label="Responsable" required error={err('assigneeId')} hint={!canAssign ? 'Vous ne pouvez créer des tâches que pour vous-même.' : undefined}>
          <NativeSelect {...form.register('assigneeId')} className={canAssign ? undefined : 'pointer-events-none opacity-70'} tabIndex={canAssign ? undefined : -1}>
            <UserOptions />
          </NativeSelect>
        </Field>
        <Field label="Date limite" error={err('dueDate')}>
          <input type="date" className={inputClass} {...form.register('dueDate')} />
        </Field>
        <Field label="Priorité" error={err('priority')}>
          <NativeSelect {...form.register('priority')}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Statut" error={err('status')}>
          <NativeSelect {...form.register('status')}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Description / consignes" error={err('description')} className="sm:col-span-2">
          <textarea rows={3} className={textarea} {...form.register('description')} />
        </Field>
      </div>
      <Hint>Si la personne n’a pas encore accès au dossier, l’accès lui est ouvert automatiquement (opération tracée dans l’historique).</Hint>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Partie au dossier                                                  */
/* ------------------------------------------------------------------ */

export function PartyFormDialog({ open, onOpenChange, dossierId, party }: { open: boolean; onOpenChange: (o: boolean) => void; dossierId: number; party?: PartyDTO | null }) {
  const clients = useClientOptions();
  const defaults = party
    ? { clientId: party.clientId ? String(party.clientId) : '', name: party.clientId ? '' : party.name, role: party.role, counsel: party.counsel ?? '', notes: party.notes ?? '' }
    : { clientId: '', name: '', role: 'defendeur', counsel: '', notes: '' };
  const form = useZodForm(partySchema, defaults, [open, party?.id]);
  const clientId = form.watch('clientId');
  const mutation = useApiMutation(
    (v: Record<string, unknown>) => (party ? api.patch(`/dossiers/${dossierId}/parties/${party.id}`, v) : api.post(`/dossiers/${dossierId}/parties`, v)),
    { success: party ? 'Partie modifiée.' : 'Partie ajoutée au dossier.', invalidate: [['dossier']], onSuccess: () => onOpenChange(false) },
  );
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={party ? 'Modifier la partie' : 'Ajouter une partie'} onSubmit={submit} pending={mutation.isPending}>
      <div className="grid gap-4">
        <Field label="Qualité" required error={err('role')}>
          <NativeSelect {...form.register('role')}>
            {PARTY_ROLES.map((r) => (
              <option key={r} value={r}>
                {PARTY_ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Client ou justiciable enregistré" hint="Laissez vide pour saisir une partie extérieure (partie adverse…)" error={err('clientId')}>
          <NativeSelect {...form.register('clientId')}>
            <option value="">— Partie extérieure —</option>
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {!clientId && (
          <Field label="Nom ou raison sociale" required error={err('name')}>
            <input className={inputClass} {...form.register('name')} />
          </Field>
        )}
        <Field label="Conseil (avocat de la partie)" error={err('counsel')}>
          <input className={inputClass} placeholder="Me …" {...form.register('counsel')} />
        </Field>
        <Field label="Notes" error={err('notes')}>
          <input className={inputClass} {...form.register('notes')} />
        </Field>
      </div>
    </FormDialog>
  );
}
