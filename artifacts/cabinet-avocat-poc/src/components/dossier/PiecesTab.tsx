import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckCircle2, Download, Eye, FilePlus2, FileStack, GripVertical, Paperclip, Pencil, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { bordereauSchema, pieceSchema, type BordereauDTO, type DocumentDTO, type DossierDTO, type PieceDTO } from '@workspace/api-zod';
import { api, fileUrl, printDocument } from '@/lib/api';
import { formatShortDate, todayIso } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-data';
import { useSession } from '@/hooks/use-session';
import { ConfirmDialog, EmptyState, Field, Hint, inputClass, LoadingState, NativeSelect, Panel, useConfirm } from '@/components/app/common';
import { BordereauStatusPill } from '@/components/app/badges';
import { applyServerErrors, fieldError, FormDialog, useZodForm } from '@/components/app/form';
import { PdfPreviewDialog, UploadDialog } from '@/components/forms/DocumentDialogs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

function PieceFormDialog({
  open,
  onOpenChange,
  dossierId,
  piece,
  documents,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dossierId: number;
  piece?: PieceDTO | null;
  documents: DocumentDTO[];
}) {
  const [uploading, setUploading] = useState(false);
  const defaults = piece
    ? { designation: piece.designation, pages: String(piece.pages), pieceDate: piece.pieceDate ?? '', observations: piece.observations ?? '', documentId: piece.document ? String(piece.document.id) : '' }
    : { designation: '', pages: '1', pieceDate: '', observations: '', documentId: '' };
  const form = useZodForm(pieceSchema, defaults, [open, piece?.id]);
  const mutation = useApiMutation(
    (v: Record<string, unknown>) => (piece ? api.patch<PieceDTO>(`/pieces/${piece.id}`, v) : api.post<PieceDTO>(`/dossiers/${dossierId}/pieces`, v)),
    { success: piece ? 'Pièce modifiée.' : 'Pièce ajoutée au dossier.', invalidate: [['pieces', String(dossierId)], ['dossier']], onSuccess: () => onOpenChange(false) },
  );
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  return (
    <>
      <FormDialog open={open} onOpenChange={onOpenChange} title={piece ? `Modifier la pièce n° ${piece.position}` : 'Ajouter une pièce'} onSubmit={submit} pending={mutation.isPending}>
        <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
          <Field label="Désignation" required error={err('designation')} className="sm:col-span-2">
            <input className={inputClass} list="piece-examples" placeholder="Ex. : Contrat de prestation" {...form.register('designation')} />
            <datalist id="piece-examples">
              {['Copie de la pièce d’identité', 'Contrat de prestation', 'Mise en demeure', 'Justificatif de paiement', 'Extrait du registre du commerce', 'Procès-verbal de constat', 'Correspondances'].map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <Field label="Date de la pièce" error={err('pieceDate')}>
            <input type="date" className={inputClass} {...form.register('pieceDate')} />
          </Field>
          <Field label="Nb de pages" required error={err('pages')}>
            <input type="number" min={1} className={inputClass} {...form.register('pages')} />
          </Field>
          <Field label="Observations" error={err('observations')} className="sm:col-span-2">
            <input className={inputClass} placeholder="Ex. : Copie certifiée conforme" {...form.register('observations')} />
          </Field>
          <Field label="Document joint (PDF ou image)" error={err('documentId')} className="sm:col-span-2">
            <div className="flex gap-2">
              <NativeSelect {...form.register('documentId')}>
                <option value="">— Aucun fichier joint —</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
              <Button type="button" variant="outline" onClick={() => setUploading(true)}>
                <Paperclip /> Téléverser
              </Button>
            </div>
          </Field>
        </div>
      </FormDialog>
      <UploadDialog open={uploading} onOpenChange={setUploading} dossierId={dossierId} onUploaded={(d) => form.setValue('documentId', String(d.id))} />
    </>
  );
}

function BordereauDialog({ open, onOpenChange, dossier, pieces, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; dossier: DossierDTO; pieces: PieceDTO[]; onCreated: (b: BordereauDTO) => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const form = useZodForm(
    bordereauSchema.omit({ pieceIds: true }),
    { title: 'Pièces communiquées', bordereauDate: todayIso(), jurisdiction: dossier.jurisdiction ?? '', observations: '' },
    [open],
  );
  useEffect(() => {
    if (open) setSelected(pieces.map((p) => p.id));
  }, [open, pieces]);
  const mutation = useApiMutation((v: Record<string, unknown>) => api.post<BordereauDTO>(`/dossiers/${dossier.id}/bordereaux`, { ...v, pieceIds: selected }), {
    success: (b) => `Bordereau ${b.reference} généré (${b.itemCount} pièces).`,
    invalidate: [['bordereaux'], ['dossier']],
    onSuccess: (b) => {
      onOpenChange(false);
      onCreated(b);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  const pages = pieces.filter((p) => selected.includes(p.id)).reduce((s, p) => s + p.pages, 0);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Générer un bordereau de pièces"
      description="Le bordereau reprend les pièces sélectionnées dans l’ordre du dossier, avec numérotation automatique."
      onSubmit={submit}
      pending={mutation.isPending}
      submitLabel="Générer le bordereau"
      wide
      footerExtra={`${selected.length} pièce(s) · ${pages} page(s)`}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Intitulé" required error={err('title')} className="sm:col-span-2">
          <input className={inputClass} {...form.register('title')} />
        </Field>
        <Field label="Date du bordereau" required error={err('bordereauDate')}>
          <input type="date" className={inputClass} {...form.register('bordereauDate')} />
        </Field>
        <Field label="Juridiction" error={err('jurisdiction')}>
          <input className={inputClass} {...form.register('jurisdiction')} />
        </Field>
        <Field label="Observations" error={err('observations')} className="sm:col-span-2">
          <textarea rows={2} className={cn(inputClass, 'h-auto py-2')} placeholder="Ex. : Pièces communiquées en copie ; originaux tenus à la disposition du Tribunal." {...form.register('observations')} />
        </Field>
      </div>
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs font-medium">
          <span>Pièces à communiquer</span>
          <button type="button" className="text-[#8a6d2b] hover:underline" onClick={() => setSelected(selected.length === pieces.length ? [] : pieces.map((p) => p.id))}>
            {selected.length === pieces.length ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        </div>
        <ul className="max-h-60 divide-y overflow-y-auto">
          {pieces.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/30">
                <Checkbox checked={selected.includes(p.id)} onCheckedChange={(c) => setSelected(c ? [...selected, p.id] : selected.filter((id) => id !== p.id))} />
                <span className="w-6 text-right font-mono text-xs text-muted-foreground">{p.position}</span>
                <span className="flex-1">{p.designation}</span>
                <span className="tabular text-xs text-muted-foreground">{p.pages} p.</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      {selected.length === 0 && <div className="text-xs text-red-600">Sélectionnez au moins une pièce.</div>}
    </FormDialog>
  );
}

export function PiecesTab({ dossier }: { dossier: DossierDTO }) {
  const { can } = useSession();
  const qc = useQueryClient();
  const writable = can('documents.write') && dossier.status !== 'archive';
  const key = String(dossier.id);
  const pieces = useQuery({ queryKey: ['pieces', key], queryFn: () => api.get<PieceDTO[]>(`/dossiers/${dossier.id}/pieces`) });
  const bordereaux = useQuery({ queryKey: ['bordereaux', key], queryFn: () => api.get<BordereauDTO[]>(`/dossiers/${dossier.id}/bordereaux`) });
  const documents = useQuery({ queryKey: ['documents', key], queryFn: () => api.get<DocumentDTO[]>(`/dossiers/${dossier.id}/documents`) });

  const [editing, setEditing] = useState<PieceDTO | null | 'new'>(null);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<BordereauDTO | null>(null);
  const [viewDoc, setViewDoc] = useState<{ id: number; name: string } | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const del = useConfirm<PieceDTO>();
  const delB = useConfirm<BordereauDTO>();

  const reorder = useApiMutation((ids: number[]) => api.post<PieceDTO[]>(`/dossiers/${dossier.id}/pieces/reorder`, { ids }), {
    invalidate: [['pieces', key]],
    success: 'Ordre des pièces mis à jour.',
  });
  const move = (from: number, to: number) => {
    const list = [...(pieces.data ?? [])];
    if (to < 0 || to >= list.length || from === to) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item!);
    // Affichage immédiat, puis confirmation par le serveur.
    qc.setQueryData(['pieces', key], list.map((p, i) => ({ ...p, position: i + 1 })));
    reorder.mutate(list.map((p) => p.id));
  };
  const removePiece = useApiMutation((p: PieceDTO) => api.delete(`/pieces/${p.id}`), {
    success: 'Pièce supprimée, numérotation mise à jour.',
    invalidate: [['pieces', key], ['dossier']],
    onSuccess: () => del.close(),
  });
  const updateB = useApiMutation((v: { b: BordereauDTO; status: 'finalise' | 'brouillon' }) => api.patch<BordereauDTO>(`/bordereaux/${v.b.id}`, { status: v.status }), {
    success: (b) => (b.status === 'finalise' ? `Bordereau ${b.reference} finalisé.` : `Bordereau ${b.reference} repassé en brouillon.`),
    invalidate: [['bordereaux']],
    onSuccess: (b) => setPreview((p) => (p && p.id === b.id ? b : p)),
  });
  const removeB = useApiMutation((b: BordereauDTO) => api.delete(`/bordereaux/${b.id}`), {
    success: 'Bordereau supprimé.',
    invalidate: [['bordereaux'], ['dossier']],
    onSuccess: () => delB.close(),
  });

  const list = pieces.data ?? [];
  const totalPages = list.reduce((s, p) => s + p.pages, 0);

  return (
    <div className="space-y-6">
      <Panel
        title="Pièces justificatives du dossier"
        description={`${list.length} pièce(s) · ${totalPages} page(s) — glissez-déposez les lignes ou utilisez les flèches pour réorganiser`}
        actions={
          writable && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
                <FilePlus2 /> Ajouter une pièce
              </Button>
              <Button size="sm" onClick={() => setGenerating(true)} disabled={!list.length}>
                <FileStack /> Générer un bordereau
              </Button>
            </>
          )
        }
        bodyClassName="p-0"
      >
        {pieces.isLoading ? (
          <LoadingState />
        ) : !list.length ? (
          <div className="p-5">
            <EmptyState title="Aucune pièce" description="Ajoutez les pièces justificatives pour constituer le dossier et générer un bordereau." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="w-8" />
                  <th className="w-12 px-2 py-2.5 text-center font-medium">N°</th>
                  <th className="px-2 py-2.5 font-medium">Désignation</th>
                  <th className="hidden px-2 py-2.5 font-medium md:table-cell">Observations</th>
                  <th className="w-16 px-2 py-2.5 text-right font-medium">Pages</th>
                  <th className="w-[170px] px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p, i) => (
                  <tr
                    key={p.id}
                    draggable={writable}
                    onDragStart={() => setDragId(p.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      const from = list.findIndex((x) => x.id === dragId);
                      if (from >= 0) move(from, i);
                      setDragId(null);
                    }}
                    className={cn('border-b last:border-0 hover:bg-muted/30', dragId === p.id && 'opacity-50')}
                  >
                    <td className="pl-3 text-muted-foreground/60">{writable && <GripVertical className="size-4 cursor-grab" />}</td>
                    <td className="px-2 py-2.5 text-center font-mono text-xs font-semibold">{p.position}</td>
                    <td className="px-2 py-2.5">
                      <div className="font-medium">{p.designation}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {p.pieceDate && <span>du {formatShortDate(p.pieceDate)}</span>}
                        {p.document && (
                          <button className="inline-flex items-center gap-1 text-[#8a6d2b] hover:underline" onClick={() => setViewDoc(p.document)}>
                            <Paperclip className="size-3" /> {p.document.name}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-2 py-2.5 text-xs text-muted-foreground md:table-cell">{p.observations ?? '—'}</td>
                    <td className="tabular px-2 py-2.5 text-right">{p.pages}</td>
                    <td className="px-3 py-2 text-right">
                      {writable && (
                        <div className="inline-flex gap-0.5">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Monter">
                            <ArrowUp />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label="Descendre">
                            <ArrowDown />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(p)} aria-label="Modifier">
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => del.ask(p)} aria-label="Supprimer">
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f7f0df]/60 text-sm font-medium">
                  <td colSpan={4} className="px-5 py-2.5">
                    Total : {list.length} pièce(s)
                  </td>
                  <td className="tabular px-2 py-2.5 text-right">{totalPages}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Bordereaux de communication de pièces" description="Chaque bordereau est une liste figée : modifier les pièces du dossier n’altère pas un bordereau déjà généré." bodyClassName="p-0">
        {bordereaux.isLoading ? (
          <LoadingState />
        ) : !bordereaux.data?.length ? (
          <div className="p-5">
            <EmptyState title="Aucun bordereau" description="Générez un bordereau à partir des pièces du dossier." icon={FileStack} />
          </div>
        ) : (
          <ul className="divide-y">
            {bordereaux.data.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-[#8a6d2b]">{b.reference}</span>
                    <BordereauStatusPill status={b.status} />
                  </div>
                  <div className="mt-0.5 font-medium">{b.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatShortDate(b.bordereauDate)} · {b.itemCount} pièce(s) · {b.totalPages} page(s){b.createdBy ? ` · par ${b.createdBy.fullName}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setPreview(b)}>
                    <Eye /> Aperçu
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => printDocument(`/bordereaux/${b.id}/pdf`)}>
                    <Printer /> Imprimer
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={fileUrl(`/bordereaux/${b.id}/pdf`, true)}>
                      <Download /> PDF
                    </a>
                  </Button>
                  {writable && (b.status === 'brouillon' || can('requetes.validate')) && (
                    <Button variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => delB.ask(b)} aria-label="Supprimer le bordereau">
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing && <PieceFormDialog open onOpenChange={(o) => !o && setEditing(null)} dossierId={dossier.id} piece={editing === 'new' ? null : editing} documents={documents.data ?? []} />}
      <BordereauDialog open={generating} onOpenChange={setGenerating} dossier={dossier} pieces={list} onCreated={(b) => setPreview(b)} />
      <PdfPreviewDialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview ? `Bordereau ${preview.reference}` : ''}
        description={preview?.title}
        path={preview ? `/bordereaux/${preview.id}/pdf` : null}
        notice={
          preview?.status === 'brouillon' ? (
            <Hint tone="warning">
              Brouillon : le PDF porte la mention « BROUILLON ». {can('requetes.validate') ? 'Finalisez-le une fois relu.' : 'La finalisation doit être faite par un avocat.'}
            </Hint>
          ) : undefined
        }
        extraActions={
          preview &&
          can('requetes.validate') &&
          writable && (
            <Button variant={preview.status === 'brouillon' ? 'default' : 'outline'} size="sm" onClick={() => updateB.mutate({ b: preview, status: preview.status === 'brouillon' ? 'finalise' : 'brouillon' })} disabled={updateB.isPending}>
              {preview.status === 'brouillon' ? (
                <>
                  <CheckCircle2 /> Finaliser
                </>
              ) : (
                <>
                  <RotateCcw /> Repasser en brouillon
                </>
              )}
            </Button>
          )
        }
      />
      <PdfPreviewDialog open={!!viewDoc} onOpenChange={(o) => !o && setViewDoc(null)} title={viewDoc?.name ?? ''} path={viewDoc ? `/documents/${viewDoc.id}/file` : null} />
      <ConfirmDialog
        open={del.open}
        onOpenChange={(o) => !o && del.close()}
        title="Supprimer cette pièce ?"
        description={`« ${del.target?.designation} » sera retirée de la liste ; les pièces suivantes seront renumérotées. Les bordereaux déjà générés ne sont pas modifiés.`}
        confirmLabel="Supprimer"
        destructive
        pending={removePiece.isPending}
        onConfirm={() => del.target && removePiece.mutate(del.target)}
      />
      <ConfirmDialog
        open={delB.open}
        onOpenChange={(o) => !o && delB.close()}
        title="Supprimer ce bordereau ?"
        description={`Le bordereau ${delB.target?.reference} sera définitivement supprimé. Les pièces du dossier sont conservées.`}
        confirmLabel="Supprimer"
        destructive
        pending={removeB.isPending}
        onConfirm={() => delB.target && removeB.mutate(delB.target)}
      />
    </div>
  );
}
