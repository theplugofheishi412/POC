import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Stamp,
  Trash2,
  Undo2,
} from 'lucide-react';
import { TEMPLATE_TYPE_LABELS, type RequeteDTO, type RequeteVersionDTO } from '@workspace/api-zod';
import { api, fileUrl } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { useApiMutation } from '@/hooks/use-data';
import { formatDateTime } from '@/lib/format';
import { RichTextPreview } from '@/lib/richtext';
import { ConfirmDialog, ErrorState, Hint, inputClass, LoadingState, PageHeader, Panel } from '@/components/app/common';
import { RequeteStatusPill } from '@/components/app/badges';
import { PdfPreviewDialog } from '@/components/forms/DocumentDialogs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const SNIPPETS: [string, string, string][] = [
  ['# ', 'Titre', 'Titre centré'],
  ['## ', 'Intertitre', 'Intertitre de section'],
  ['> ', 'Droite', 'Ligne alignée à droite (lieu, date, destinataire)'],
  ['^ ', 'Centré', 'Ligne centrée en gras (PAR CES MOTIFS)'],
  ['- ', 'Liste', 'Élément de liste'],
];

export default function RequeteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { can } = useSession();
  const query = useQuery({ queryKey: ['requete', id], queryFn: () => api.get<RequeteDTO>(`/requetes/${id}`) });
  const r = query.data;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [comment, setComment] = useState('');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [version, setVersion] = useState<RequeteVersionDTO | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (r) {
      setTitle(r.title);
      setContent(r.content);
      setComment('');
    }
  }, [r?.id, r?.currentVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = [['requete'], ['requetes'], ['dossier']];
  const save = useApiMutation(() => api.patch<RequeteDTO>(`/requetes/${id}`, { title, content, comment }), {
    success: (x) => `Version ${x.currentVersion} enregistrée.`,
    invalidate,
  });
  const transition = useApiMutation((t: 'submit' | 'validate' | 'reject' | 'deposit') => api.post<RequeteDTO>(`/requetes/${id}/${t}`, {}), {
    success: (x) =>
      ({ a_valider: 'Soumise pour validation à l’avocat.', validee: 'Acte validé.', brouillon: 'Renvoyée en correction.', deposee: 'Marquée comme déposée.' })[x.status],
    invalidate,
  });
  const restore = useApiMutation((v: RequeteVersionDTO) => api.post<RequeteDTO>(`/requetes/${id}/restore/${v.id}`, {}), {
    success: (x) => `Version restaurée (nouvelle version ${x.currentVersion}).`,
    invalidate,
    onSuccess: () => setVersion(null),
  });
  const remove = useApiMutation(() => api.delete(`/requetes/${id}`), { success: 'Requête supprimée.', invalidate, onSuccess: () => navigate('/requetes') });

  if (query.isLoading) return <LoadingState />;
  if (query.error || !r) return <ErrorState error={query.error} />;

  const dirty = title !== r.title || content !== r.content;
  const locked = r.status === 'deposee' || !can('documents.write');
  const canValidate = can('requetes.validate');
  const missing = (content.match(/\[à compléter[^\]]*\]/g) ?? []).length;

  const insert = (prefix: string) => {
    const el = area.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  return (
    <>
      <Link href={`/dossiers/${r.dossierId}?onglet=requetes`} className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> {r.dossierReference} — {r.dossierTitle}
      </Link>
      <PageHeader
        eyebrow={`${TEMPLATE_TYPE_LABELS[r.type]} · version ${r.currentVersion}`}
        title={r.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <RequeteStatusPill status={r.status} />
            {r.validatedBy && r.validatedAt && (
              <span>
                Validée par {r.validatedBy.fullName} le {formatDateTime(r.validatedAt)}
              </span>
            )}
            {!r.validatedBy && r.createdBy && <span>Préparée par {r.createdBy.fullName}</span>}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setPdfOpen(true)} disabled={dirty} title={dirty ? 'Enregistrez avant d’exporter' : undefined}>
              <Eye /> Aperçu PDF
            </Button>
            <Button variant="outline" asChild disabled={dirty}>
              <a href={fileUrl(`/requetes/${r.id}/word`)} aria-disabled={dirty} className={dirty ? 'pointer-events-none opacity-50' : undefined}>
                <FileText /> Word
              </a>
            </Button>
            {(r.status === 'brouillon' || canValidate) && can('documents.write') && (
              <Button variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)} aria-label="Supprimer">
                <Trash2 />
              </Button>
            )}
          </>
        }
      />

      {/* Circuit de validation */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <Stamp className="size-5 text-[#b08d3c]" />
        <div className="min-w-0 flex-1 text-sm">
          {r.status === 'brouillon' && (canValidate ? 'Brouillon : relisez puis validez l’acte, ou laissez-le en préparation.' : 'Brouillon : une fois prêt, soumettez-le à l’avocat responsable pour validation.')}
          {r.status === 'a_valider' && (canValidate ? 'Cet acte attend votre validation.' : 'Soumis à l’avocat : en attente de validation. Vous ne pouvez pas valider seul cet acte.')}
          {r.status === 'validee' && 'Acte validé par un avocat. Toute modification annulera la validation.'}
          {r.status === 'deposee' && 'Acte déposé : il n’est plus modifiable.'}
        </div>
        {!locked && r.status === 'brouillon' && !canValidate && (
          <Button size="sm" onClick={() => transition.mutate('submit')} disabled={dirty || transition.isPending}>
            <Send /> Soumettre pour validation
          </Button>
        )}
        {!locked && canValidate && ['brouillon', 'a_valider'].includes(r.status) && (
          <Button size="sm" onClick={() => transition.mutate('validate')} disabled={dirty || transition.isPending} className="bg-emerald-700 text-white">
            <CheckCircle2 /> Valider l’acte
          </Button>
        )}
        {!locked && canValidate && ['a_valider', 'validee'].includes(r.status) && (
          <Button size="sm" variant="outline" onClick={() => transition.mutate('reject')} disabled={transition.isPending}>
            <Undo2 /> Renvoyer en correction
          </Button>
        )}
        {!locked && r.status === 'validee' && (
          <Button size="sm" variant="outline" onClick={() => transition.mutate('deposit')} disabled={transition.isPending}>
            <Send /> Marquer comme déposée
          </Button>
        )}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1fr_1fr_280px] xl:grid-cols-[1fr_1fr]">
        <Panel
          title="Rédaction"
          description={missing > 0 ? `${missing} champ(s) à compléter (surlignés dans l’aperçu)` : 'Texte libre avec mise en forme légère'}
          actions={
            !locked && (
              <Button size="sm" onClick={() => save.mutate(undefined)} disabled={!dirty || save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer une version
              </Button>
            )
          }
          bodyClassName="space-y-3"
        >
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} aria-label="Intitulé" />
          {!locked && (
            <div className="flex flex-wrap gap-1">
              {SNIPPETS.map(([prefix, label, hint]) => (
                <button key={prefix} type="button" title={hint} onClick={() => insert(prefix)} className="rounded border bg-muted/40 px-2 py-0.5 text-[11px] hover:bg-muted">
                  <span className="font-mono text-[#8a6d2b]">{prefix.trim()}</span> {label}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={area}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={locked}
            spellCheck
            lang="fr"
            className={cn(inputClass, 'h-[560px] resize-y py-3 font-mono text-[12.5px] leading-relaxed')}
          />
          {!locked && (
            <input className={inputClass} placeholder="Commentaire de version (facultatif) — ex. : ajout des moyens" value={comment} onChange={(e) => setComment(e.target.value)} />
          )}
        </Panel>

        <Panel title="Aperçu" description="Rendu fidèle au PDF exporté" bodyClassName="bg-muted/40 p-4">
          <div className="relative mx-auto min-h-[600px] max-w-[640px] bg-white px-10 py-10 shadow-sm ring-1 ring-border">
            {!['validee', 'deposee'].includes(r.status) && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
                <span className="-rotate-[35deg] select-none text-7xl font-bold text-red-600/[0.06]">PROJET</span>
              </div>
            )}
            <RichTextPreview source={content} />
          </div>
        </Panel>

        <Panel title="Versions" description="Historique conservé" className="xl:col-span-2 2xl:col-span-1" bodyClassName="p-0">
          <ul className="max-h-[680px] divide-y overflow-y-auto">
            {r.versions?.map((v) => (
              <li key={v.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Version {v.version}</span>
                  {v.version === r.currentVersion ? (
                    <span className="text-[10px] font-semibold uppercase text-emerald-700">Actuelle</span>
                  ) : (
                    <button className="text-xs text-[#8a6d2b] hover:underline" onClick={() => setVersion(v)}>
                      Consulter
                    </button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(v.createdAt)} · {v.createdBy?.fullName ?? '—'}
                </div>
                {v.comment && <div className="mt-0.5 text-xs italic text-muted-foreground">{v.comment}</div>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-6">
        <Hint tone="warning">
          <span className="inline-flex items-center gap-1 font-medium">
            <ShieldAlert className="size-3.5" /> Modèle de démonstration.
          </span>{' '}
          Le contenu généré automatiquement doit être vérifié et approuvé par un avocat ; il ne constitue pas un acte juridiquement validé.
        </Hint>
      </div>

      <PdfPreviewDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        title={r.title}
        description={`Version ${r.currentVersion}`}
        path={`/requetes/${r.id}/pdf?v=${r.currentVersion}`}
        extraActions={
          <Button variant="outline" size="sm" asChild>
            <a href={fileUrl(`/requetes/${r.id}/word`)}>
              <Download /> Word
            </a>
          </Button>
        }
      />
      <Dialog open={!!version} onOpenChange={(o) => !o && setVersion(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {version && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-serif">
                  <History className="size-5 text-[#b08d3c]" /> Version {version.version}
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(version.createdAt)} · {version.createdBy?.fullName}
                  {version.comment ? ` — ${version.comment}` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border bg-white px-8 py-6">
                <RichTextPreview source={version.content} />
              </div>
              {!locked && (
                <div className="flex justify-end">
                  <Button onClick={() => restore.mutate(version)} disabled={restore.isPending}>
                    <RotateCcw /> Restaurer cette version
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer cette requête ?"
        description="La requête et toutes ses versions seront définitivement supprimées."
        confirmLabel="Supprimer"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}
