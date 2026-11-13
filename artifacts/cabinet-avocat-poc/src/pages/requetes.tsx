import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { REQUETE_STATUSES, REQUETE_STATUS_LABELS, type RequeteDTO } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { ErrorState, FilterSelect, Hint, LoadingState, PageHeader, Panel, SearchInput, StatCard, useDebounced } from '@/components/app/common';
import { RequeteCreateDialog, RequeteList } from '@/components/dossier/Lists';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FilePen, Hourglass, Send } from 'lucide-react';

export default function RequetesPage() {
  const { can } = useSession();
  const [status, setStatus] = useState('tous');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const q = useDebounced(search);
  const all = useQuery({ queryKey: ['requetes', 'all'], queryFn: () => api.get<RequeteDTO[]>('/requetes') });
  const list = useQuery({ queryKey: ['requetes', { status, q }], queryFn: () => api.get<RequeteDTO[]>('/requetes', { status, search: q }) });
  const count = (s: string) => (all.data ?? []).filter((r) => r.status === s).length;

  return (
    <>
      <PageHeader
        title="Requêtes et actes"
        description="Préparation des requêtes, courriers et actes à partir de modèles, avec historique des versions et validation par un avocat."
        actions={
          can('documents.write') && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Préparer une requête
            </Button>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Brouillons" value={count('brouillon')} icon={FilePen} tone="gray" onClick={() => setStatus('brouillon')} />
        <StatCard label="À valider par un avocat" value={count('a_valider')} icon={Hourglass} tone="orange" onClick={() => setStatus('a_valider')} />
        <StatCard label="Validées" value={count('validee')} icon={CheckCircle2} tone="green" onClick={() => setStatus('validee')} />
        <StatCard label="Déposées" value={count('deposee')} icon={Send} tone="navy" onClick={() => setStatus('deposee')} />
      </div>
      <div className="mb-4">
        <Hint tone="warning">
          Les contenus produits à partir des modèles sont des <strong>projets de démonstration</strong>. Ils ne constituent pas des actes juridiquement validés tant
          qu’un avocat ne les a pas relus et approuvés.
        </Hint>
      </div>
      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap gap-2 border-b border-border/70 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Intitulé ou contenu…" className="min-w-[220px] flex-1" />
          <FilterSelect label="Statut" value={status} onChange={setStatus} options={[{ value: 'tous', label: 'Tous les statuts' }, ...REQUETE_STATUSES.map((s) => ({ value: s, label: REQUETE_STATUS_LABELS[s] }))]} />
        </div>
        <div className="px-5">{list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} /> : <RequeteList items={list.data ?? []} showDossier />}</div>
      </Panel>
      <RequeteCreateDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
