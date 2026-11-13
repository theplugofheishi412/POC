import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, MapPin, Pencil, Trash2 } from 'lucide-react';
import {
  DOCUMENT_CATEGORY_LABELS,
  EVENT_TYPE_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TEMPLATE_TYPE_LABELS,
  type DocumentDTO,
  type EventDTO,
  type RequeteDTO,
  type TaskDTO,
  type TaskStatus,
  type TemplateDTO,
} from '@workspace/api-zod';
import { api, fileUrl } from '@/lib/api';
import { daysUntil, formatDate, formatDayMonth, formatShortDate, formatSize, formatTime, relativeTime } from '@/lib/format';
import { useApiMutation, useDossierOptions } from '@/hooks/use-data';
import { useSession } from '@/hooks/use-session';
import { EVENT_TYPE_STYLE } from '@/lib/tones';
import { Avatar, ConfirmDialog, EmptyState, Field, Hint, inputClass, NativeSelect, useConfirm } from '@/components/app/common';
import { PriorityPill, RequeteStatusPill } from '@/components/app/badges';
import { FormDialog } from '@/components/app/form';
import { EventFormDialog, TaskFormDialog } from '@/components/forms/ActivityForms';
import { FileTypeIcon, PdfPreviewDialog } from '@/components/forms/DocumentDialogs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Documents                                                          */
/* ------------------------------------------------------------------ */

export function DocumentsList({ items, showDossier }: { items: DocumentDTO[]; showDossier?: boolean }) {
  const { can } = useSession();
  const [view, setView] = useState<DocumentDTO | null>(null);
  const del = useConfirm<DocumentDTO>();
  const remove = useApiMutation((d: DocumentDTO) => api.delete(`/documents/${d.id}`), {
    success: 'Document supprimé.',
    invalidate: [['documents'], ['dossier'], ['pieces'], ['demarches']],
    onSuccess: () => del.close(),
  });
  if (!items.length) return <EmptyState title="Aucun document" description="Joignez des PDF ou des images (pièces, actes, décisions, justificatifs)." />;
  return (
    <>
      <ul className="divide-y">
        {items.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
            <FileTypeIcon mime={d.mimeType} />
            <div className="min-w-0 flex-1">
              <button className="block max-w-full truncate text-left text-sm font-medium hover:underline" onClick={() => setView(d)}>
                {d.name}
              </button>
              <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <span>{DOCUMENT_CATEGORY_LABELS[d.category]}</span>
                <span>· {formatSize(d.size)}</span>
                <span>· {formatShortDate(d.createdAt)}</span>
                {d.uploadedBy && <span>· {d.uploadedBy.fullName}</span>}
                {showDossier && (
                  <Link href={`/dossiers/${d.dossierId}?onglet=documents`} className="font-mono text-[#8a6d2b] hover:underline">
                    · {d.dossierReference}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setView(d)} aria-label="Consulter">
                <Eye />
              </Button>
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <a href={fileUrl(`/documents/${d.id}/file`, true)} aria-label="Télécharger">
                  <Download />
                </a>
              </Button>
              {can('documents.write') && (
                <Button variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => del.ask(d)} aria-label="Supprimer">
                  <Trash2 />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <PdfPreviewDialog open={!!view} onOpenChange={(o) => !o && setView(null)} title={view?.name ?? ''} description={view?.originalName} path={view ? `/documents/${view.id}/file` : null} />
      <ConfirmDialog
        open={del.open}
        onOpenChange={(o) => !o && del.close()}
        title="Supprimer ce document ?"
        description={`« ${del.target?.name} » sera définitivement supprimé. Les pièces qui y faisaient référence n’auront plus de fichier joint.`}
        confirmLabel="Supprimer"
        destructive
        pending={remove.isPending}
        onConfirm={() => del.target && remove.mutate(del.target)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tâches (liste compacte)                                            */
/* ------------------------------------------------------------------ */

export function TaskList({ items }: { items: TaskDTO[] }) {
  const { session, can } = useSession();
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const status = useApiMutation((v: { id: number; status: TaskStatus }) => api.post<TaskDTO>(`/tasks/${v.id}/status`, { status: v.status }), {
    success: (t) => `Tâche « ${t.title} » : ${TASK_STATUS_LABELS[t.status]}.`,
    invalidate: [['tasks'], ['dossier']],
  });
  if (!items.length) return <EmptyState title="Aucune tâche" />;
  const me = session!.user.id;
  return (
    <>
      <ul className="divide-y">
        {items.map((t) => {
          const late = t.status !== 'terminee' && t.dueDate && daysUntil(t.dueDate) < 0;
          const mayChange = t.assignee.id === me || t.createdBy?.id === me || can('tasks.assign');
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={t.assignee.fullName} />
              <div className="min-w-0 flex-1">
                <div className={cn('text-sm font-medium', t.status === 'terminee' && 'text-muted-foreground line-through')}>{t.title}</div>
                <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span>{t.assignee.fullName}</span>
                  {t.dueDate && <span className={late ? 'font-medium text-red-600' : undefined}>· échéance {formatShortDate(t.dueDate)}</span>}
                  {t.createdBy && <span>· confiée par {t.createdBy.fullName}</span>}
                </div>
              </div>
              <PriorityPill priority={t.priority} />
              <NativeSelect
                aria-label="Statut"
                value={t.status}
                disabled={!mayChange || status.isPending}
                onChange={(e) => status.mutate({ id: t.id, status: e.target.value as TaskStatus })}
                className="h-8 w-[130px] text-xs"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
              {(t.createdBy?.id === me || can('tasks.assign')) && (
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(t)} aria-label="Modifier">
                  <Pencil />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {editing && <TaskFormDialog open onOpenChange={(o) => !o && setEditing(null)} task={editing} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Événements (liste)                                                 */
/* ------------------------------------------------------------------ */

export function EventList({ items }: { items: EventDTO[] }) {
  const { can } = useSession();
  const [editing, setEditing] = useState<EventDTO | null>(null);
  if (!items.length) return <EmptyState title="Aucun événement" description="Audiences, rendez-vous et échéances liés à ce dossier." />;
  return (
    <>
      <ul className="space-y-2">
        {items.map((e) => (
          <li key={e.id} className={cn('flex items-center gap-4 rounded-md border-l-[3px] px-4 py-2.5', EVENT_TYPE_STYLE[e.type].bar, EVENT_TYPE_STYLE[e.type].bg, e.status !== 'prevu' && 'opacity-60')}>
            <div className="w-20 shrink-0 text-xs">
              <div className="font-medium">{formatDayMonth(e.startAt)}</div>
              <div className="text-muted-foreground">{formatTime(e.startAt)}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn('text-sm font-medium', EVENT_TYPE_STYLE[e.type].text)}>{e.title}</div>
              <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <span>{EVENT_TYPE_LABELS[e.type]}</span>
                {e.location && (
                  <span className="inline-flex items-center gap-1">
                    · <MapPin className="size-3" /> {e.location}
                  </span>
                )}
                {e.assignee && <span>· {e.assignee.fullName}</span>}
                {e.status === 'annule' && <span>· annulé</span>}
                {e.status === 'termine' && <span>· terminé</span>}
              </div>
            </div>
            {can('events.write') && (
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(e)} aria-label="Modifier">
                <Pencil />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editing && <EventFormDialog open onOpenChange={(o) => !o && setEditing(null)} event={editing} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Requêtes                                                           */
/* ------------------------------------------------------------------ */

export function RequeteList({ items, showDossier }: { items: RequeteDTO[]; showDossier?: boolean }) {
  const [, navigate] = useLocation();
  if (!items.length) return <EmptyState title="Aucune requête" description="Préparez une requête ou un courrier à partir d’un modèle." />;
  return (
    <ul className="divide-y">
      {items.map((r) => (
        <li key={r.id}>
          <button className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-muted/30" onClick={() => navigate(`/requetes/${r.id}`)}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{r.title}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">v{r.currentVersion}</span>
              </div>
              <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <span>{TEMPLATE_TYPE_LABELS[r.type]}</span>
                {showDossier && <span className="font-mono text-[#8a6d2b]">· {r.dossierReference}</span>}
                <span>· modifiée {relativeTime(r.updatedAt)}</span>
                {r.createdBy && <span>· {r.createdBy.fullName}</span>}
              </div>
            </div>
            <RequeteStatusPill status={r.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Création d'une requête : dossier + modèle + champs à compléter. */
export function RequeteCreateDialog({ open, onOpenChange, dossierId }: { open: boolean; onOpenChange: (o: boolean) => void; dossierId?: number }) {
  const [, navigate] = useLocation();
  const dossiers = useDossierOptions();
  const templates = useQuery({ queryKey: ['templates'], queryFn: () => api.get<TemplateDTO[]>('/templates'), enabled: open });
  const [dossier, setDossier] = useState<string>(dossierId ? String(dossierId) : '');
  const [templateId, setTemplateId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const tpl = templates.data?.find((t) => String(t.id) === templateId);

  const create = useApiMutation(
    () => api.post<RequeteDTO>('/requetes', { dossierId: Number(dossier), templateId: templateId ? Number(templateId) : null, title, fields }),
    {
      success: 'Requête préparée — relisez et complétez le contenu.',
      invalidate: [['requetes'], ['dossier']],
      onSuccess: (r) => {
        onOpenChange(false);
        navigate(`/requetes/${r.id}`);
      },
    },
  );
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setTemplateId('');
          setTitle('');
          setFields({});
          setError(null);
        }
      }}
      title="Préparer une requête ou un acte"
      description="Les informations du dossier (parties, juridiction, avocat…) sont insérées automatiquement dans le modèle."
      submitLabel="Créer le projet"
      pending={create.isPending}
      wide
      onSubmit={(e) => {
        e.preventDefault();
        if (!dossier) return setError('Sélectionnez un dossier.');
        if (!title.trim()) return setError('Indiquez un intitulé.');
        setError(null);
        create.mutate(undefined);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dossier" required className="sm:col-span-2">
          <NativeSelect value={dossier} onChange={(e) => setDossier(e.target.value)} className={dossierId ? 'pointer-events-none opacity-70' : undefined}>
            <option value="">Sélectionner…</option>
            {dossiers.data
              ?.filter((d) => d.status !== 'archive')
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.reference} — {d.title}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label="Modèle" className="sm:col-span-2">
          <NativeSelect
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const t = templates.data?.find((x) => String(x.id) === e.target.value);
              if (t && !title) setTitle(t.name);
              setFields({});
            }}
          >
            <option value="">— Document vierge —</option>
            {templates.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isSystem ? '' : ' (modèle du cabinet)'}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {tpl?.description && <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">{tpl.description}</p>}
        <Field label="Intitulé" required className="sm:col-span-2">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {tpl?.customFields.map((f) => (
          <Field key={f} label={f.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())} className="sm:col-span-2" hint="Facultatif : peut être complété dans l’éditeur">
            <textarea rows={f.length > 10 ? 2 : 1} className={cn(inputClass, 'h-auto py-2')} value={fields[f] ?? ''} onChange={(e) => setFields({ ...fields, [f]: e.target.value })} />
          </Field>
        ))}
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <Hint tone="warning">Le document produit est un projet issu d’un modèle de démonstration : il doit être relu et validé par un avocat avant tout usage.</Hint>
    </FormDialog>
  );
}

export { formatDate };
