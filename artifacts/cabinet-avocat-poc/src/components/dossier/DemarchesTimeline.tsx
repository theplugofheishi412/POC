import { useState } from 'react';
import { Link } from 'wouter';
import { CalendarCheck2, CalendarClock, Paperclip, Pencil, Trash2, Upload } from 'lucide-react';
import { DEMARCHE_TYPE_LABELS, type DemarcheDTO } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { daysUntil, formatDate } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-data';
import { useSession } from '@/hooks/use-session';
import { DEMARCHE_STATUS_TONE, TONE_DOT } from '@/lib/tones';
import { Avatar, ConfirmDialog, EmptyState, useConfirm } from '@/components/app/common';
import { DemarcheStatusPill } from '@/components/app/badges';
import { DemarcheFormDialog } from '@/components/forms/ActivityForms';
import { PdfPreviewDialog, UploadDialog } from '@/components/forms/DocumentDialogs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Chronologie des démarches au palais : de la plus ancienne à la plus
 * récente, avec dates prévues / effectives, résultat et justificatifs.
 */
export function DemarchesTimeline({ items, showDossier, order = 'asc' }: { items: DemarcheDTO[]; showDossier?: boolean; order?: 'asc' | 'desc' }) {
  const { session, can } = useSession();
  const [editing, setEditing] = useState<DemarcheDTO | null>(null);
  const [uploadFor, setUploadFor] = useState<DemarcheDTO | null>(null);
  const [viewDoc, setViewDoc] = useState<{ id: number; name: string } | null>(null);
  const del = useConfirm<DemarcheDTO>();
  const remove = useApiMutation((d: DemarcheDTO) => api.delete(`/demarches/${d.id}`), {
    success: 'Démarche supprimée.',
    invalidate: [['demarches'], ['dossier']],
    onSuccess: () => del.close(),
  });

  if (!items.length) return <EmptyState title="Aucune démarche" description="Les dépôts, retraits et suivis au palais apparaîtront ici dans l’ordre chronologique." />;
  const sorted = [...items].sort((a, b) => (order === 'asc' ? 1 : -1) * ((a.executedDate ?? a.plannedDate).localeCompare(b.executedDate ?? b.plannedDate) || a.id - b.id));
  const me = session!.user.id;
  const canEdit = (d: DemarcheDTO) => can('demarches.write') && (d.assignee.id === me || d.createdBy?.id === me || can('tasks.assign'));

  return (
    <>
      <ol className="relative ml-3 border-l-2 border-border">
        {sorted.map((d) => {
          const overdue = d.status !== 'effectuee' && daysUntil(d.plannedDate) < 0;
          return (
            <li key={d.id} className="relative pb-6 pl-7 last:pb-0">
              <span className={cn('absolute -left-[9px] top-1 size-4 rounded-full border-[3px] border-card', TONE_DOT[DEMARCHE_STATUS_TONE[d.status]])} />
              <div className="rounded-lg border border-border/80 bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{DEMARCHE_TYPE_LABELS[d.type]}</span>
                      <DemarcheStatusPill status={d.status} />
                      {overdue && <span className="text-xs font-medium text-red-600">Date dépassée</span>}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">{d.jurisdiction}</div>
                    {showDossier && (
                      <Link href={`/dossiers/${d.dossierId}?onglet=demarches`} className="mt-0.5 block truncate text-xs text-[#8a6d2b] hover:underline">
                        {d.dossierReference} — {d.dossierTitle}
                      </Link>
                    )}
                  </div>
                  {canEdit(d) && (
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setUploadFor(d)} aria-label="Joindre un justificatif" title="Joindre un justificatif">
                        <Upload />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(d)} aria-label="Modifier">
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => del.ask(d)} aria-label="Supprimer">
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarClock className="size-3.5" /> Prévue le <span className="text-foreground">{formatDate(d.plannedDate)}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarCheck2 className="size-3.5" /> {d.executedDate ? <>Effectuée le <span className="text-foreground">{formatDate(d.executedDate)}</span></> : 'Non effectuée'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Avatar name={d.assignee.fullName} className="size-5 text-[9px]" /> {d.assignee.fullName}
                  </span>
                </div>
                {d.observations && <p className="mt-3 text-sm">{d.observations}</p>}
                {d.result && (
                  <p className="mt-2 rounded-md bg-[#fbf7ee] px-3 py-1.5 text-sm text-[#5f4a1c]">
                    <span className="font-medium">Résultat : </span>
                    {d.result}
                  </p>
                )}
                {d.documents.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.documents.map((doc) => (
                      <button key={doc.id} onClick={() => setViewDoc(doc)} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                        <Paperclip className="size-3" /> {doc.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {editing && <DemarcheFormDialog open onOpenChange={(o) => !o && setEditing(null)} demarche={editing} />}
      {uploadFor && <UploadDialog open onOpenChange={(o) => !o && setUploadFor(null)} dossierId={uploadFor.dossierId} demarcheId={uploadFor.id} defaultCategory="justificatif" />}
      <PdfPreviewDialog open={!!viewDoc} onOpenChange={(o) => !o && setViewDoc(null)} title={viewDoc?.name ?? ''} path={viewDoc ? `/documents/${viewDoc.id}/file` : null} />
      <ConfirmDialog
        open={del.open}
        onOpenChange={(o) => !o && del.close()}
        title="Supprimer cette démarche ?"
        description="La démarche sera retirée de la chronologie du dossier. Les justificatifs joints restent dans les documents du dossier."
        confirmLabel="Supprimer"
        destructive
        pending={remove.isPending}
        onConfirm={() => del.target && remove.mutate(del.target)}
      />
    </>
  );
}
