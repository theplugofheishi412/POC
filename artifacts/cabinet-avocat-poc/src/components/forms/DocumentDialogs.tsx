import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, Loader2, Printer, UploadCloud } from 'lucide-react';
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, type DocumentCategory, type DocumentDTO } from '@workspace/api-zod';
import { api, fileUrl, printDocument } from '@/lib/api';
import { formatSize } from '@/lib/format';
import { useApiMutation } from '@/hooks/use-data';
import { Field, Hint, inputClass, NativeSelect } from '@/components/app/common';
import { FormDialog } from '@/components/app/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
const MAX = 10 * 1024 * 1024;

/** Téléversement d'un fichier (PDF ou image) dans un dossier. */
export function UploadDialog({
  open,
  onOpenChange,
  dossierId,
  demarcheId,
  defaultCategory = 'piece',
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dossierId: number;
  demarcheId?: number;
  defaultCategory?: DocumentCategory;
  onUploaded?: (d: DocumentDTO) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setName('');
      setDescription('');
      setCategory(defaultCategory);
      setError(null);
    }
  }, [open, defaultCategory]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPT.split(',').includes(f.type)) return setError('Format non accepté. Formats autorisés : PDF, PNG, JPEG, WEBP.');
    if (f.size > MAX) return setError('Fichier trop volumineux (10 Mo maximum).');
    setError(null);
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
  };

  const upload = useApiMutation(
    () => api.upload<DocumentDTO>(`/dossiers/${dossierId}/documents`, file!, { name, category, description, demarcheId }),
    {
      success: 'Document ajouté au dossier.',
      invalidate: [['documents'], ['dossier'], ['demarches']],
      onSuccess: (d) => {
        onOpenChange(false);
        onUploaded?.(d);
      },
    },
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Joindre un document"
      description="PDF ou image (PNG, JPEG, WEBP), 10 Mo maximum. Le format réel du fichier est vérifié par le serveur."
      submitLabel="Téléverser"
      pending={upload.isPending}
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return setError('Sélectionnez un fichier.');
        if (!name.trim()) return setError('Indiquez un nom de document.');
        upload.mutate(undefined);
      }}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
        onClick={() => input.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors',
          drag ? 'border-[#b08d3c] bg-[#fbf7ee]' : 'border-border hover:bg-muted/40',
        )}
      >
        <UploadCloud className="size-7 text-muted-foreground" />
        {file ? (
          <div className="text-sm">
            <span className="font-medium">{file.name}</span> <span className="text-muted-foreground">· {formatSize(file.size)}</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Glissez un fichier ici ou cliquez pour parcourir</div>
        )}
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du document" required className="sm:col-span-2">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Catégorie">
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Description">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}

/** Aperçu d'un PDF généré ou d'un fichier, avec téléchargement et impression. */
export function PdfPreviewDialog({
  open,
  onOpenChange,
  title,
  path,
  description,
  extraActions,
  notice,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  path: string | null;
  description?: string;
  extraActions?: React.ReactNode;
  notice?: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [path, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-3 p-4 sm:p-5">
        <DialogHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pr-8">
          <div className="min-w-0">
            <DialogTitle className="font-serif text-lg">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </div>
          {path && (
            <div className="flex flex-wrap gap-2">
              {extraActions}
              <Button variant="outline" size="sm" onClick={() => printDocument(path)}>
                <Printer /> Imprimer
              </Button>
              <Button size="sm" asChild>
                <a href={fileUrl(path, true)}>
                  <Download /> Télécharger
                </a>
              </Button>
            </div>
          )}
        </DialogHeader>
        {notice}
        <div className="relative flex-1 overflow-hidden rounded-md border bg-muted">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Génération du document…
            </div>
          )}
          {path && open && <iframe key={path} title={title} src={fileUrl(path)} className="relative h-full w-full bg-white" onLoad={() => setLoaded(true)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FileTypeIcon({ mime }: { mime: string }) {
  return (
    <span className={cn('grid size-8 shrink-0 place-items-center rounded-md text-[9px] font-bold uppercase', mime === 'application/pdf' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700')}>
      {mime === 'application/pdf' ? 'PDF' : mime.split('/')[1]?.slice(0, 4)}
    </span>
  );
}

export { FileUp, Hint };
