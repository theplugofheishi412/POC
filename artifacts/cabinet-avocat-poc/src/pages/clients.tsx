import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2, Mail, Phone, Plus, UserRound } from 'lucide-react';
import { CLIENT_TYPE_LABELS, type ClientDTO, type Paginated } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { formatShortDate } from '@/lib/format';
import { useQueryParam } from '@/lib/url';
import { EmptyState, ErrorState, FilterSelect, LoadingState, PageHeader, Pagination, Panel, SearchInput, StatusPill, useDebounced } from '@/components/app/common';
import { ClientFormDialog } from '@/components/forms/ClientForm';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ClientsPage() {
  const { can } = useSession();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState(useQueryParam('search') ?? '');
  const [type, setType] = useState('tous');
  const [status, setStatus] = useState('actif');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useDebounced(search);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['clients', { q, type, status, page }],
    queryFn: () => api.get<Paginated<ClientDTO>>('/clients', { search: q, type, status, page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Clients et justiciables"
        description="Personnes physiques et morales accompagnées par le cabinet. Un client peut intervenir dans plusieurs dossiers, en qualité de demandeur, défendeur ou représentant."
        actions={
          can('clients.write') && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Nouveau client
            </Button>
          )
        }
      />
      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-4">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Nom, raison sociale, téléphone, email, ville…"
            className="min-w-[240px] flex-1"
          />
          <FilterSelect
            label="Type"
            value={type}
            onChange={(v) => {
              setType(v);
              setPage(1);
            }}
            options={[{ value: 'tous', label: 'Tous les types' }, { value: 'physique', label: 'Personnes physiques' }, { value: 'morale', label: 'Personnes morales' }]}
          />
          <FilterSelect
            label="Statut"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[{ value: 'actif', label: 'Clients actifs' }, { value: 'archive', label: 'Archivés' }, { value: 'tous', label: 'Tous' }]}
          />
        </div>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : !data?.items.length ? (
          <div className="p-6">
            <EmptyState title="Aucun client trouvé" description="Modifiez la recherche ou les filtres, ou enregistrez un nouveau client." />
          </div>
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Client</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Ville</TableHead>
                  <TableHead>Dossiers</TableHead>
                  <TableHead className="hidden sm:table-cell">Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                          {c.type === 'morale' ? <Building2 className="size-4" /> : <UserRound className="size-4" />}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/clients/${c.id}`} className="block truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                            {c.displayName}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {CLIENT_TYPE_LABELS[c.type]}
                            {c.status === 'archive' && ' · archivé'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {c.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="size-3" /> {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="size-3" /> {c.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{c.city ?? '—'}</TableCell>
                    <TableCell>
                      {c.activeDossierCount > 0 ? (
                        <StatusPill tone="blue">{c.activeDossierCount} actif{c.activeDossierCount > 1 ? 's' : ''}</StatusPill>
                      ) : (
                        <span className="text-xs text-muted-foreground">{c.dossierCount ? `${c.dossierCount} clos` : 'Aucun'}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">{formatShortDate(c.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </div>
        )}
      </Panel>
      <ClientFormDialog open={creating} onOpenChange={setCreating} onSaved={(c) => navigate(`/clients/${c.id}`)} />
    </>
  );
}
