import { useState } from 'react';
import { Link } from 'wouter';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AuditEntryDTO, Paginated } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Avatar, EmptyState, ErrorState, FilterSelect, Hint, LoadingState, PageHeader, Pagination, Panel, SearchInput, useDebounced } from '@/components/app/common';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ENTITIES = [
  ['tous', 'Toutes les opérations'],
  ['auth', 'Connexions'],
  ['client', 'Clients'],
  ['dossier', 'Dossiers'],
  ['party', 'Parties'],
  ['document', 'Documents (consultations, téléchargements)'],
  ['piece', 'Pièces'],
  ['bordereau', 'Bordereaux'],
  ['requete', 'Requêtes'],
  ['demarche', 'Démarches'],
  ['event', 'Agenda'],
  ['task', 'Tâches'],
  ['invoice', 'Factures'],
  ['payment', 'Paiements'],
  ['user', 'Utilisateurs'],
] as const;

export default function JournalPage() {
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('tous');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['audit', { q, entity, page }],
    queryFn: () => api.get<Paginated<AuditEntryDTO>>('/audit', { search: q, entity, page, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <PageHeader title="Journal d’audit" description="Traçabilité des opérations sensibles : connexions, consultations et téléchargements de documents confidentiels, modifications, validations, exports." />
      <div className="mb-4">
        <Hint>Le journal est en lecture seule et ne peut pas être modifié depuis l’application.</Hint>
      </div>
      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap gap-2 border-b border-border/70 p-4">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Rechercher dans le journal…"
            className="min-w-[220px] flex-1"
          />
          <FilterSelect
            label="Type d’opération"
            value={entity}
            onChange={(v) => {
              setEntity(v);
              setPage(1);
            }}
            options={ENTITIES.map(([value, label]) => ({ value, label }))}
          />
        </div>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} />
          </div>
        ) : !data?.items.length ? (
          <div className="p-6">
            <EmptyState title="Aucune opération" />
          </div>
        ) : (
          <div className={isFetching ? 'opacity-70' : undefined}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Date</TableHead>
                  <TableHead>Opération</TableHead>
                  <TableHead className="hidden md:table-cell">Utilisateur</TableHead>
                  <TableHead className="hidden lg:table-cell">Dossier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap pl-5 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
                    <TableCell>
                      <div className="text-sm">{a.summary}</div>
                      <div className="font-mono text-[10.5px] text-muted-foreground">{a.action}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {a.user ? (
                        <span className="flex items-center gap-2 text-sm">
                          <Avatar name={a.user.fullName} className="size-6 text-[9px]" /> {a.user.fullName}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {a.dossier ? (
                        <Link href={`/dossiers/${a.dossier.id}?onglet=historique`} className="font-mono text-xs text-[#8a6d2b] hover:underline">
                          {a.dossier.reference}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </div>
        )}
      </Panel>
    </>
  );
}
