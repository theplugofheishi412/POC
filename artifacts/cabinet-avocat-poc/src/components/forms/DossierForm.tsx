import {
  CONFIDENTIALITY_LABELS,
  CONFIDENTIALITY_LEVELS,
  DOSSIER_CATEGORIES,
  DOSSIER_CATEGORY_LABELS,
  DOSSIER_STATUSES,
  DOSSIER_STATUS_LABELS,
  dossierSchema,
  JURISDICTIONS,
  ROLE_LABELS,
  type DossierDTO,
} from '@workspace/api-zod';
import { api } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { useApiMutation, useClientOptions, useUsers } from '@/hooks/use-data';
import { useSession } from '@/hooks/use-session';
import { Field, Hint, inputClass, NativeSelect } from '@/components/app/common';
import { applyServerErrors, fieldError, FormDialog, useZodForm } from '@/components/app/form';
import { cn } from '@/lib/utils';

const LAWYER_ROLES = ['associe', 'collaborateur'];

export function DossierFormDialog({
  open,
  onOpenChange,
  dossier,
  defaultClientId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dossier?: DossierDTO | null;
  defaultClientId?: number;
  onSaved?: (d: DossierDTO) => void;
}) {
  const { session, can } = useSession();
  const users = useUsers();
  const clients = useClientOptions();
  const canAssign = can('dossiers.assign');
  const defaults = dossier
    ? {
        title: dossier.title,
        clientId: String(dossier.client.id),
        category: dossier.category,
        procedureType: dossier.procedureType,
        jurisdiction: dossier.jurisdiction ?? '',
        responsibleId: String(dossier.responsible.id),
        status: dossier.status,
        confidentiality: dossier.confidentiality,
        openedAt: dossier.openedAt,
        roleNumber: dossier.roleNumber ?? '',
        description: dossier.description ?? '',
        memberIds: dossier.members.map((m) => m.id),
      }
    : {
        title: '',
        clientId: defaultClientId ? String(defaultClientId) : '',
        category: 'commercial',
        procedureType: '',
        jurisdiction: '',
        responsibleId: String(session!.user.id),
        status: 'nouveau',
        confidentiality: 'standard',
        openedAt: todayIso(),
        roleNumber: '',
        description: '',
        memberIds: [],
      };
  const form = useZodForm(dossierSchema, defaults, [open, dossier?.id, defaultClientId]);
  const memberIds = (form.watch('memberIds') as number[]) ?? [];
  const responsibleId = Number(form.watch('responsibleId'));

  const mutation = useApiMutation(
    (values: Record<string, unknown>) => (dossier ? api.patch<DossierDTO>(`/dossiers/${dossier.id}`, values) : api.post<DossierDTO>('/dossiers', values)),
    {
      success: (d) => (dossier ? 'Dossier mis à jour.' : `Dossier ${d.reference} ouvert.`),
      invalidate: [['dossiers'], ['dossier'], ['clients'], ['client']],
      onSuccess: (d) => {
        onOpenChange(false);
        onSaved?.(d);
      },
    },
  );
  const submit = form.handleSubmit((values) => mutation.mutate(values, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  const activeUsers = (users.data ?? []).filter((u) => u.active);
  const lawyers = activeUsers.filter((u) => LAWYER_ROLES.includes(u.role) || u.id === responsibleId);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={dossier ? `Modifier le dossier ${dossier.reference}` : 'Ouvrir un dossier'}
      description={dossier ? undefined : 'La référence unique (DOS-AAAA-NNN) est attribuée automatiquement.'}
      onSubmit={submit}
      pending={mutation.isPending}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Intitulé du dossier" required error={err('title')} className="sm:col-span-2">
          <input className={inputClass} placeholder="Ex. : Société A c. Société B — rupture de contrat" {...form.register('title')} />
        </Field>
        <Field label="Client principal" required error={err('clientId')}>
          <NativeSelect {...form.register('clientId')}>
            <option value="">Sélectionner…</option>
            {dossier && !clients.data?.some((c) => c.id === dossier.client.id) && <option value={dossier.client.id}>{dossier.client.displayName}</option>}
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Domaine juridique" required error={err('category')}>
          <NativeSelect {...form.register('category')}>
            {DOSSIER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOSSIER_CATEGORY_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Type de procédure" required error={err('procedureType')}>
          <input className={inputClass} placeholder="Ex. : Injonction de payer, référé…" {...form.register('procedureType')} />
        </Field>
        <Field label="Juridiction compétente" error={err('jurisdiction')}>
          <input className={inputClass} list="jurisdictions" {...form.register('jurisdiction')} />
          <datalist id="jurisdictions">
            {JURISDICTIONS.map((j) => (
              <option key={j} value={j} />
            ))}
          </datalist>
        </Field>
        <Field label="Avocat responsable" required error={err('responsibleId')} hint={!canAssign ? 'Seul un associé peut confier le dossier à un autre avocat.' : undefined}>
          {/* Verrouillé visuellement (un champ désactivé ne serait pas soumis). */}
          <NativeSelect {...form.register('responsibleId')} aria-readonly={!canAssign} tabIndex={canAssign ? undefined : -1} className={canAssign ? undefined : 'pointer-events-none opacity-70'}>
            {lawyers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} — {ROLE_LABELS[u.role]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date d’ouverture" required error={err('openedAt')}>
          <input type="date" className={inputClass} {...form.register('openedAt')} />
        </Field>
        <Field label="Statut" error={err('status')}>
          <NativeSelect {...form.register('status')}>
            {DOSSIER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DOSSIER_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Niveau de confidentialité" error={err('confidentiality')}>
          <NativeSelect {...form.register('confidentiality')}>
            {CONFIDENTIALITY_LEVELS.map((c) => (
              <option key={c} value={c}>
                {CONFIDENTIALITY_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="N° de rôle / répertoire" hint="Attribué par le greffe après dépôt" error={err('roleNumber')}>
          <input className={inputClass} {...form.register('roleNumber')} />
        </Field>
        <Field label="Description" error={err('description')} className="sm:col-span-2">
          <textarea rows={3} className={cn(inputClass, 'h-auto py-2')} {...form.register('description')} />
        </Field>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-foreground/80">Collaborateurs associés au dossier</div>
        <div className="flex flex-wrap gap-2">
          {activeUsers
            .filter((u) => u.id !== responsibleId && u.role !== 'comptable')
            .map((u) => {
              const checked = memberIds.includes(u.id);
              return (
                <button
                  type="button"
                  key={u.id}
                  disabled={!canAssign}
                  onClick={() => form.setValue('memberIds', checked ? memberIds.filter((id) => id !== u.id) : [...memberIds, u.id])}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    checked ? 'border-[#14213d] bg-[#14213d] text-white' : 'border-border bg-card hover:bg-muted',
                  )}
                >
                  {u.fullName} <span className="opacity-70">· {ROLE_LABELS[u.role]}</span>
                </button>
              );
            })}
        </div>
        {form.watch('confidentiality') === 'confidentiel' && (
          <div className="mt-3">
            <Hint tone="warning">Dossier confidentiel : seuls l’avocat responsable, les collaborateurs cochés et les associés y auront accès.</Hint>
          </div>
        )}
      </div>
    </FormDialog>
  );
}
