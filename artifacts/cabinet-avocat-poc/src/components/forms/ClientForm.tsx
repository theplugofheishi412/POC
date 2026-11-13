import { Building2, UserRound } from 'lucide-react';
import { clientSchema, type ClientDTO } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useApiMutation } from '@/hooks/use-data';
import { Field, inputClass } from '@/components/app/common';
import { applyServerErrors, fieldError, FormDialog, useZodForm } from '@/components/app/form';
import { cn } from '@/lib/utils';

const EMPTY = {
  type: 'physique',
  firstName: '',
  lastName: '',
  companyName: '',
  legalForm: '',
  registrationNumber: '',
  representativeName: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  idNumber: '',
  notes: '',
};

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client?: ClientDTO | null;
  onSaved?: (c: ClientDTO) => void;
}) {
  const defaults = client ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, (client as unknown as Record<string, unknown>)[k] ?? ''])) : EMPTY;
  const form = useZodForm(clientSchema, defaults, [open, client?.id]);
  const type = form.watch('type') as 'physique' | 'morale';
  const mutation = useApiMutation(
    (values: Record<string, unknown>) => (client ? api.patch<ClientDTO>(`/clients/${client.id}`, values) : api.post<ClientDTO>('/clients', values)),
    {
      success: client ? 'Fiche client mise à jour.' : 'Client enregistré.',
      invalidate: [['clients'], ['client']],
      onSuccess: (c) => {
        onOpenChange(false);
        onSaved?.(c);
      },
    },
  );
  const submit = form.handleSubmit((values) => mutation.mutate(values, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={client ? 'Modifier la fiche client' : 'Nouveau client'}
      description="Les champs marqués d’un astérisque sont obligatoires. Indiquez au moins un moyen de contact."
      onSubmit={submit}
      pending={mutation.isPending}
      wide
    >
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type de client">
        {(
          [
            ['physique', 'Personne physique', UserRound],
            ['morale', 'Personne morale', Building2],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => form.setValue('type', value)}
            className={cn(
              'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors',
              type === value ? 'border-[#b08d3c] bg-[#fbf7ee] font-medium text-[#14213d]' : 'border-border text-muted-foreground hover:bg-muted/50',
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {type === 'physique' ? (
          <>
            <Field label="Prénom" required error={err('firstName')}>
              <input className={inputClass} {...form.register('firstName')} />
            </Field>
            <Field label="Nom" required error={err('lastName')}>
              <input className={inputClass} {...form.register('lastName')} />
            </Field>
            <Field label="N° de pièce d’identité" hint="Facultatif (CNI, passeport…)" error={err('idNumber')}>
              <input className={inputClass} {...form.register('idNumber')} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Raison sociale" required error={err('companyName')} className="sm:col-span-2">
              <input className={inputClass} {...form.register('companyName')} />
            </Field>
            <Field label="Forme juridique" error={err('legalForm')}>
              <input className={inputClass} placeholder="SARL, SA, SAS, GIE…" {...form.register('legalForm')} />
            </Field>
            <Field label="N° RCCM / immatriculation" error={err('registrationNumber')}>
              <input className={inputClass} {...form.register('registrationNumber')} />
            </Field>
            <Field label="Représentant légal" error={err('representativeName')}>
              <input className={inputClass} placeholder="Nom, qualité" {...form.register('representativeName')} />
            </Field>
          </>
        )}
        <Field label="Téléphone" error={err('phone')}>
          <input className={inputClass} placeholder="+221 77 000 00 00" {...form.register('phone')} />
        </Field>
        <Field label="Email" error={err('email')}>
          <input type="email" className={inputClass} {...form.register('email')} />
        </Field>
        <Field label="Ville" error={err('city')}>
          <input className={inputClass} {...form.register('city')} />
        </Field>
        <Field label="Adresse" error={err('address')} className="sm:col-span-2">
          <input className={inputClass} {...form.register('address')} />
        </Field>
        <Field label="Observations" error={err('notes')} className="sm:col-span-2">
          <textarea rows={3} className={cn(inputClass, 'h-auto py-2')} {...form.register('notes')} />
        </Field>
      </div>
    </FormDialog>
  );
}
