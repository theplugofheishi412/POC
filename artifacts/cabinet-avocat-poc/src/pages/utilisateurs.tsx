import { useState } from 'react';
import { Check, Minus, Pencil, Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { PERMISSIONS, PERMISSION_LABELS, ROLES, ROLE_LABELS, ROLE_PERMISSIONS, userCreateSchema, userUpdateSchema, type UserDTO } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { useApiMutation, useUsers } from '@/hooks/use-data';
import { relativeTime } from '@/lib/format';
import { Avatar, ErrorState, Field, Hint, inputClass, LoadingState, NativeSelect, PageHeader, Panel, StatusPill } from '@/components/app/common';
import { applyServerErrors, fieldError, FormDialog, useZodForm } from '@/components/app/form';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function UserFormDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user?: UserDTO | null }) {
  const form = useZodForm(
    user ? userUpdateSchema : userCreateSchema,
    user
      ? { firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, title: user.title ?? '', phone: user.phone ?? '', password: '' }
      : { firstName: '', lastName: '', email: '', role: 'collaborateur', title: '', phone: '', password: '' },
    [open, user?.id],
  );
  const mutation = useApiMutation((v: Record<string, unknown>) => (user ? api.patch<UserDTO>(`/users/${user.id}`, v) : api.post<UserDTO>('/users', v)), {
    success: user ? 'Compte mis à jour.' : 'Compte créé.',
    invalidate: [['users']],
    onSuccess: () => onOpenChange(false),
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={user ? `Modifier le compte de ${user.fullName}` : 'Nouvel utilisateur'} onSubmit={submit} pending={mutation.isPending}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" required error={err('firstName')}>
          <input className={inputClass} {...form.register('firstName')} />
        </Field>
        <Field label="Nom" required error={err('lastName')}>
          <input className={inputClass} {...form.register('lastName')} />
        </Field>
        <Field label="Email" required error={err('email')} className="sm:col-span-2">
          <input type="email" className={inputClass} {...form.register('email')} />
        </Field>
        <Field label="Rôle" required error={err('role')}>
          <NativeSelect {...form.register('role')}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Titre affiché" error={err('title')}>
          <input className={inputClass} placeholder="Ex. : Avocate associée" {...form.register('title')} />
        </Field>
        <Field label="Téléphone" error={err('phone')}>
          <input className={inputClass} {...form.register('phone')} />
        </Field>
        <Field label={user ? 'Nouveau mot de passe' : 'Mot de passe'} required={!user} hint={user ? 'Laisser vide pour ne pas changer' : '8 caractères minimum'} error={err('password')}>
          <input type="password" autoComplete="new-password" className={inputClass} {...form.register('password')} />
        </Field>
      </div>
    </FormDialog>
  );
}

export default function UtilisateursPage() {
  const { session, can } = useSession();
  const users = useUsers();
  const [editing, setEditing] = useState<UserDTO | null | 'new'>(null);
  const manage = can('users.manage');
  const toggle = useApiMutation((u: UserDTO) => api.patch<UserDTO>(`/users/${u.id}`, { active: !u.active }), {
    success: (u) => (u.active ? `Compte de ${u.fullName} réactivé.` : `Compte de ${u.fullName} désactivé.`),
    invalidate: [['users']],
  });
  const myRole = session!.user.role;

  return (
    <>
      <PageHeader
        title="Utilisateurs et rôles"
        description="Membres du cabinet et droits associés à chaque profil. Les droits sont contrôlés par le serveur à chaque opération."
        actions={
          manage && (
            <Button onClick={() => setEditing('new')}>
              <Plus /> Nouvel utilisateur
            </Button>
          )
        }
      />
      <div className="mb-6">
        <Hint>
          Vous êtes connecté(e) en tant que <strong>{ROLE_LABELS[myRole]}</strong> : {ROLE_PERMISSIONS[myRole].length} droit(s) sur {PERMISSIONS.length}. La colonne surlignée du tableau ci-dessous
          correspond à votre profil.
        </Hint>
      </div>
      <Panel title="Membres du cabinet" bodyClassName="p-0" className="mb-6">
        {users.isLoading ? (
          <LoadingState />
        ) : users.error ? (
          <ErrorState error={users.error} />
        ) : (
          <ul className="divide-y">
            {users.data?.map((u) => (
              <li key={u.id} className={cn('flex flex-wrap items-center gap-3 px-5 py-3', !u.active && 'opacity-60')}>
                <Avatar name={u.fullName} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {u.fullName}
                    {u.id === session!.user.id && <span className="text-[10px] font-semibold uppercase text-[#8a6d2b]">Vous</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {u.title ?? ROLE_LABELS[u.role]} · {u.email}
                  </div>
                </div>
                <StatusPill tone={u.role === 'associe' || u.role === 'admin' ? 'gold' : u.role === 'stagiaire' ? 'blue' : 'navy'}>{ROLE_LABELS[u.role]}</StatusPill>
                <span className="hidden w-36 text-right text-xs text-muted-foreground md:block">{u.lastLoginAt ? `Connecté ${relativeTime(u.lastLoginAt)}` : 'Jamais connecté'}</span>
                {!u.active && <StatusPill tone="gray">Désactivé</StatusPill>}
                {manage && (
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(u)} aria-label="Modifier">
                      <Pencil />
                    </Button>
                    {u.id !== session!.user.id && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => toggle.mutate(u)} aria-label={u.active ? 'Désactiver' : 'Réactiver'} title={u.active ? 'Désactiver le compte' : 'Réactiver le compte'}>
                        {u.active ? <UserX /> : <UserCheck />}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Matrice des droits par profil" description="Le stagiaire prépare les actes et effectue les démarches, mais ne peut pas valider seul un acte : la validation est réservée aux avocats." bodyClassName="overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b text-xs">
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                <ShieldCheck className="mr-1.5 inline size-4" /> Droit
              </th>
              {ROLES.map((r) => (
                <th key={r} className={cn('px-2 py-3 text-center font-medium', r === myRole && 'bg-[#f7f0df] text-[#5f4614]')}>
                  {ROLE_LABELS[r].replace('Avocat ', 'Avocat ').replace('Administrateur du cabinet', 'Administrateur')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p} className="border-b last:border-0">
                <td className="px-5 py-2 text-[13px]">{PERMISSION_LABELS[p]}</td>
                {ROLES.map((r) => (
                  <td key={r} className={cn('px-2 py-2 text-center', r === myRole && 'bg-[#fbf7ee]')}>
                    {ROLE_PERMISSIONS[r].includes(p) ? <Check className="mx-auto size-4 text-emerald-600" aria-label="Oui" /> : <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Non" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {editing && <UserFormDialog open onOpenChange={(o) => !o && setEditing(null)} user={editing === 'new' ? null : editing} />}
    </>
  );
}
