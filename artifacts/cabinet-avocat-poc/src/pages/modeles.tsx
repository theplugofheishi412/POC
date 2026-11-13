import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookText, Copy, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS, templateSchema, type TemplateDTO } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { useApiMutation } from '@/hooks/use-data';
import { RichTextPreview } from '@/lib/richtext';
import { ConfirmDialog, EmptyState, ErrorState, Field, Hint, inputClass, LoadingState, NativeSelect, PageHeader, Panel, useConfirm } from '@/components/app/common';
import { applyServerErrors, fieldError, FormDialog, useZodForm } from '@/components/app/form';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function TemplateFormDialog({ open, onOpenChange, template, base }: { open: boolean; onOpenChange: (o: boolean) => void; template?: TemplateDTO | null; base?: TemplateDTO | null }) {
  const fields = useQuery({ queryKey: ['template-fields'], queryFn: () => api.get<{ key: string; label: string }[]>('/templates/fields') });
  const src = template ?? base;
  const form = useZodForm(
    templateSchema,
    { name: template ? template.name : base ? `${base.name} (version du cabinet)` : '', type: src?.type ?? 'autre', description: src?.description ?? '', body: src?.body ?? '# Titre du document\n\n> {{cabinet.ville}}, le {{date.jour}}\n\n' },
    [open, template?.id, base?.id],
  );
  const mutation = useApiMutation((v: Record<string, unknown>) => (template ? api.patch(`/templates/${template.id}`, v) : api.post('/templates', v)), {
    success: template ? 'Modèle mis à jour.' : 'Modèle créé.',
    invalidate: [['templates']],
    onSuccess: () => onOpenChange(false),
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  const insert = (key: string) => form.setValue('body', `${form.getValues('body') as string}{{${key}}}`);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={template ? 'Modifier le modèle' : 'Nouveau modèle du cabinet'} onSubmit={submit} pending={mutation.isPending} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du modèle" required error={err('name')}>
          <input className={inputClass} {...form.register('name')} />
        </Field>
        <Field label="Type de document" required error={err('type')}>
          <NativeSelect {...form.register('type')}>
            {TEMPLATE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TEMPLATE_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Description" error={err('description')} className="sm:col-span-2">
          <input className={inputClass} {...form.register('description')} />
        </Field>
        <Field label="Contenu" required error={err('body')} className="sm:col-span-2" hint="# titre · ## intertitre · > à droite · ^ centré · - liste · {{champ}} pour une variable">
          <textarea rows={14} className={cn(inputClass, 'h-auto py-2 font-mono text-xs leading-relaxed')} {...form.register('body')} />
        </Field>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-foreground/80">Variables remplies automatiquement (cliquez pour insérer)</div>
        <div className="flex flex-wrap gap-1">
          {fields.data?.map((f) => (
            <button type="button" key={f.key} title={f.label} onClick={() => insert(f.key)} className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[10.5px] hover:bg-muted">
              {`{{${f.key}}}`}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Toute autre variable (ex. {'{{montant_reclame}}'}) sera demandée lors de la création de la requête.</p>
      </div>
    </FormDialog>
  );
}

export default function ModelesPage() {
  const { can } = useSession();
  const templates = useQuery({ queryKey: ['templates'], queryFn: () => api.get<TemplateDTO[]>('/templates') });
  const [selected, setSelected] = useState<TemplateDTO | null>(null);
  const [form, setForm] = useState<{ template?: TemplateDTO; base?: TemplateDTO } | null>(null);
  const del = useConfirm<TemplateDTO>();
  const remove = useApiMutation((t: TemplateDTO) => api.delete(`/templates/${t.id}`), {
    success: 'Modèle supprimé.',
    invalidate: [['templates']],
    onSuccess: () => {
      del.close();
      setSelected(null);
    },
  });

  if (templates.isLoading) return <LoadingState />;
  if (templates.error) return <ErrorState error={templates.error} />;
  const list = templates.data ?? [];
  const current = selected ? list.find((t) => t.id === selected.id) ?? null : list[0] ?? null;

  return (
    <>
      <PageHeader
        title="Modèles de documents"
        description="Trames de requêtes et de courriers. Les modèles fournis sont des exemples de démonstration ; créez vos propres modèles pour refléter les usages du cabinet."
        actions={
          can('templates.write') && (
            <Button onClick={() => setForm({})}>
              <Plus /> Nouveau modèle
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel bodyClassName="p-2">
          <ul className="space-y-1">
            {list.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelected(t)}
                  className={cn('w-full rounded-lg px-3 py-2.5 text-left transition-colors', current?.id === t.id ? 'bg-[#14213d] text-white' : 'hover:bg-muted')}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {t.isSystem ? <Lock className="size-3.5 opacity-60" /> : <BookText className="size-3.5 text-[#b08d3c]" />}
                    {t.name}
                  </div>
                  <div className={cn('text-xs', current?.id === t.id ? 'text-white/70' : 'text-muted-foreground')}>
                    {TEMPLATE_TYPE_LABELS[t.type]} · {t.isSystem ? 'Modèle fourni' : `Cabinet${t.createdBy ? ` — ${t.createdBy.fullName}` : ''}`}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        {current ? (
          <Panel
            title={current.name}
            description={current.description ?? undefined}
            actions={
              can('templates.write') && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setForm({ base: current })}>
                    <Copy /> Dupliquer
                  </Button>
                  {!current.isSystem && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setForm({ template: current })}>
                        <Pencil /> Modifier
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => del.ask(current)}>
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </>
              )
            }
          >
            {current.customFields.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Champs demandés à la création :</span>
                {current.customFields.map((f) => (
                  <span key={f} className="rounded bg-[#f7f0df] px-1.5 py-0.5 font-mono text-[10.5px] text-[#7a5a1c]">
                    {f}
                  </span>
                ))}
              </div>
            )}
            <div className="rounded-md border bg-white px-8 py-7">
              <RichTextPreview source={current.body.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi, '«$1»')} />
            </div>
            <div className="mt-4">
              <Hint tone="warning">Modèle de démonstration à faire valider par un avocat avant toute utilisation réelle.</Hint>
            </div>
          </Panel>
        ) : (
          <EmptyState title="Aucun modèle" />
        )}
      </div>
      {form && <TemplateFormDialog open onOpenChange={(o) => !o && setForm(null)} template={form.template} base={form.base} />}
      <ConfirmDialog
        open={del.open}
        onOpenChange={(o) => !o && del.close()}
        title="Supprimer ce modèle ?"
        description="Les requêtes déjà créées à partir de ce modèle sont conservées."
        confirmLabel="Supprimer"
        destructive
        pending={remove.isPending}
        onConfirm={() => del.target && remove.mutate(del.target)}
      />
    </>
  );
}
