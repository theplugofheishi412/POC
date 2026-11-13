import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, FileStack, Printer } from 'lucide-react';
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, type BordereauDTO, type DocumentDTO } from '@workspace/api-zod';
import { api, fileUrl, printDocument } from '@/lib/api';
import { useDossierOptions } from '@/hooks/use-data';
import { formatShortDate } from '@/lib/format';
import { EmptyState, ErrorState, Field, FilterSelect, Hint, LoadingState, NativeSelect, PageHeader, Panel, SearchInput, useDebounced } from '@/components/app/common';
import { BordereauStatusPill } from '@/components/app/badges';
import { FormDialog } from '@/components/app/form';
import { DocumentsList } from '@/components/dossier/Lists';
import { PdfPreviewDialog } from '@/components/forms/DocumentDialogs';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function DocumentsPage() {
  const [, navigate] = useLocation();
  const dossiers = useDossierOptions();
  const [tab, setTab] = useState('bordereaux');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('tous');
  const [preview, setPreview] = useState<BordereauDTO | null>(null);
  const [choose, setChoose] = useState(false);
  const [target, setTarget] = useState('');
  const q = useDebounced(search);

  const bordereaux = useQuery({ queryKey: ['bordereaux', 'all'], queryFn: () => api.get<BordereauDTO[]>('/bordereaux') });
  const documents = useQuery({ queryKey: ['documents', 'all', { q, category }], queryFn: () => api.get<DocumentDTO[]>('/documents', { search: q, category }), enabled: tab === 'documents' });

  return (
    <>
      <PageHeader
        title="Pièces, bordereaux et documents"
        description="Vue transversale des bordereaux de communication de pièces et des documents de tous les dossiers qui vous sont accessibles."
        actions={
          <Button onClick={() => setChoose(true)}>
            <FileStack /> Constituer un bordereau
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="bordereaux">Bordereaux ({bordereaux.data?.length ?? '…'})</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="bordereaux">
          <Panel bodyClassName="p-0">
            {bordereaux.isLoading ? (
              <LoadingState />
            ) : bordereaux.error ? (
              <div className="p-4">
                <ErrorState error={bordereaux.error} />
              </div>
            ) : !bordereaux.data?.length ? (
              <div className="p-6">
                <EmptyState title="Aucun bordereau" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Bordereau</TableHead>
                    <TableHead className="hidden md:table-cell">Dossier</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="hidden lg:table-cell">Pièces</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bordereaux.data.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="max-w-[300px] pl-5">
                        <div className="font-mono text-xs text-[#8a6d2b]">{b.reference}</div>
                        <div className="truncate font-medium">{b.title}</div>
                      </TableCell>
                      <TableCell className="hidden max-w-[260px] md:table-cell">
                        <Link href={`/dossiers/${b.dossierId}?onglet=pieces`} className="block truncate text-sm hover:underline">
                          {b.dossierReference} — {b.dossierTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden text-sm sm:table-cell">{formatShortDate(b.bordereauDate)}</TableCell>
                      <TableCell className="tabular hidden text-sm lg:table-cell">
                        {b.itemCount} pièces · {b.totalPages} p.
                      </TableCell>
                      <TableCell>
                        <BordereauStatusPill status={b.status} />
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <div className="inline-flex gap-0.5">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setPreview(b)} aria-label="Aperçu">
                            <Eye />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => printDocument(`/bordereaux/${b.id}/pdf`)} aria-label="Imprimer">
                            <Printer />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" asChild>
                            <a href={fileUrl(`/bordereaux/${b.id}/pdf`, true)} aria-label="Télécharger le PDF">
                              <Download />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="documents">
          <Panel bodyClassName="p-0">
            <div className="flex flex-wrap gap-2 border-b border-border/70 p-4">
              <SearchInput value={search} onChange={setSearch} placeholder="Nom du document…" className="min-w-[220px] flex-1" />
              <FilterSelect label="Catégorie" value={category} onChange={setCategory} options={[{ value: 'tous', label: 'Toutes les catégories' }, ...DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: DOCUMENT_CATEGORY_LABELS[c] }))]} />
            </div>
            <div className="px-5 py-2">{documents.isLoading ? <LoadingState /> : documents.error ? <ErrorState error={documents.error} /> : <DocumentsList items={documents.data ?? []} showDossier />}</div>
          </Panel>
        </TabsContent>
      </Tabs>

      <PdfPreviewDialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title={preview ? `Bordereau ${preview.reference}` : ''} description={preview?.title} path={preview ? `/bordereaux/${preview.id}/pdf` : null} />
      <FormDialog
        open={choose}
        onOpenChange={setChoose}
        title="Constituer un bordereau"
        description="Les pièces et bordereaux se gèrent depuis le dossier concerné (onglet « Pièces & bordereaux »)."
        submitLabel="Ouvrir les pièces du dossier"
        onSubmit={(e) => {
          e.preventDefault();
          if (target) navigate(`/dossiers/${target}?onglet=pieces`);
        }}
      >
        <Field label="Dossier" required>
          <NativeSelect value={target} onChange={(e) => setTarget(e.target.value)}>
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
        <Hint>Dans le dossier : ajoutez ou réordonnez les pièces, puis cliquez sur « Générer un bordereau » pour obtenir le PDF prêt à imprimer.</Hint>
      </FormDialog>
    </>
  );
}
