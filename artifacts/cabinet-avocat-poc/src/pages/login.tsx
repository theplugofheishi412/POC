import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Gavel, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { loginSchema, ROLE_LABELS, type DemoAccountDTO } from '@workspace/api-zod';
import { useSession } from '@/hooks/use-session';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Avatar, Field, inputClass } from '@/components/app/common';
import { fieldError, useZodForm } from '@/components/app/form';
import { cn } from '@/lib/utils';

const ROLE_HINTS: Record<string, string> = {
  admin: 'Paramétrage, utilisateurs, réinitialisation de la démo',
  associe: 'Parcours recommandé : accès complet aux dossiers',
  collaborateur: 'Valide les actes, suit ses dossiers',
  juriste: 'Recherches, pièces et modèles',
  stagiaire: 'Prépare, dépose, mais ne valide pas seul',
  assistant: 'Accueil, clients, agenda, démarches',
  comptable: 'Facturation et encaissements uniquement',
};

export default function LoginPage() {
  const { login, demoLogin } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const form = useZodForm(loginSchema, { email: '', password: '' });
  const accounts = useQuery({ queryKey: ['demo-accounts'], queryFn: () => api.get<DemoAccountDTO[]>('/auth/demo-accounts') });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values as { email: string; password: string });
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  const quick = async (id: number) => {
    setError(null);
    setPendingId(id);
    try {
      await demoLogin(id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#14213d] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #c9a55a 0 1px, transparent 1px 22px)' }}
        />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#c9a55a]/15 ring-1 ring-[#c9a55a]/40">
            <Gavel className="size-5 text-[#d9b86e]" />
          </span>
          <div>
            <div className="font-serif text-xl font-semibold">TechSolution Cabinet</div>
            <div className="text-xs uppercase tracking-[0.18em] text-[#c9a55a]">Gestion de cabinet d’avocats</div>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-serif text-4xl font-semibold leading-tight">
            Vos dossiers, vos pièces et vos audiences, <span className="text-[#d9b86e]">réunis au même endroit.</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/70">
            Du premier rendez-vous au dépôt au greffe : clients, dossiers, bordereaux de pièces, requêtes, démarches au palais, agenda,
            tâches de l’équipe et facturation en FCFA.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {[
              'Bordereaux de pièces générés en PDF, prêts à imprimer',
              'Circuit de validation des actes par l’avocat',
              'Accès aux dossiers selon le rôle et la confidentialité',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="size-1.5 rounded-full bg-[#c9a55a]" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-white/50">
          <ShieldCheck className="size-4" /> Prototype de démonstration — toutes les données sont fictives.
        </div>
      </aside>

      <main className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-[460px]">
          <div className="mb-8 lg:hidden">
            <div className="font-serif text-2xl font-semibold text-[#14213d]">TechSolution Cabinet</div>
            <div className="text-xs uppercase tracking-[0.18em] text-[#9a7a34]">Gestion de cabinet d’avocats</div>
          </div>
          <h2 className="font-serif text-2xl font-semibold">Connexion</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accédez à l’espace sécurisé du cabinet.</p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            <Field label="Adresse email" error={fieldError(form, 'email')}>
              <input type="email" autoComplete="username" className={inputClass} placeholder="prenom.nom@cabinet-demo.example" {...form.register('email')} />
            </Field>
            <Field label="Mot de passe" error={fieldError(form, 'password')}>
              <input type="password" autoComplete="current-password" className={inputClass} {...form.register('password')} />
            </Field>
            {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
              Se connecter
            </Button>
          </form>

          <div className="my-7 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou accès direct avec un compte de démonstration <span className="h-px flex-1 bg-border" />
          </div>

          <ul className="space-y-2">
            {accounts.isLoading && <li className="text-center text-xs text-muted-foreground">Chargement des comptes…</li>}
            {accounts.isError && (
              <li className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Le serveur de l’application ne répond pas. Vérifiez que l’API est démarrée (voir le guide de lancement).
              </li>
            )}
            {accounts.data?.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => quick(a.id)}
                  disabled={pendingId !== null}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-[#b08d3c]/60 hover:bg-[#fbf7ee] disabled:opacity-60',
                    a.role === 'associe' ? 'border-[#b08d3c]/50 ring-1 ring-[#b08d3c]/20' : 'border-border',
                  )}
                >
                  <Avatar name={a.fullName} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {a.fullName}
                      {a.role === 'associe' && <span className="rounded bg-[#f7f0df] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7a5a1c]">Recommandé</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ROLE_LABELS[a.role]} — {ROLE_HINTS[a.role]}
                    </span>
                  </span>
                  {pendingId === a.id ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            Les identifiants des comptes de démonstration figurent dans le guide de prise en main remis avec le prototype.
          </p>
        </div>
      </main>
    </div>
  );
}
