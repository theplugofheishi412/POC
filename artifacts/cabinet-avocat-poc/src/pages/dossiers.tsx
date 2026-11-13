import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Gavel, Plus } from 'lucide-react';
import {
  CONFIDENTIALITY_LABELS,
  CONFIDENTIALITY_LEVELS,
  DOSSIER_CATEGORIES,
  DOSSIER_CATEGORY_LABELS,
  DOSSIER_STATUSES,
  DOSSIER_STATUS_LABELS,
  type DossierListItemDTO,
  type Paginated,
} from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { useUsers } from '@/hooks/use-data';
import { formatDayMonth, formatShortDate, formatTime } from '@/lib/format';
import { useQueryParam } from '@/lib/url';
import { Avatar, EmptyState, ErrorState, FilterSelect, LoadingState, PageHeader, Pagination, Panel, SearchInput, useDebounced } from '@/components/app/common';
import { ConfidentialityMark, DossierStatusPill } from '@/components/app/badges';
import { DossierFormDialog } from '@/components/forms/DossierForm';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function DossiersPage() {
  const { can } = useSession();
  const [, navigate] = useLocation();
  const users = useUsers();
  const [search, setSearch] = useState(useQueryParam('search') ?? '');
  const [status, setStatus] = useState(useQueryParam('status') ?? 'tous');
  const [scope, setScope] = useState(useQueryParam('scope') ?? 'tous');
  const [category, setCategory] = useState('tous');
  const [responsibleId, setResponsibleId] = useState('tous');
  const [confidentiality, setConfidentiality] = useState('tous');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(useQueryParam('nouveau') === '1');
  const q = useDebounced(search);
  const filters = { search: q, status, scope, category, responsibleId, confidentiality, page, pageSize: 10 };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['dossiers', filters],
    queryFn: () => api.get<Paginated<DossierListItemDTO>>('/dossiers', filters),
    placeholderData: keepPreviousData,
  });
  const set = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };
  const activeFilters = [status, scope, category, responsibleId, confidentiality].filter((v) => v !== 'tous').length + (q ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Dossiers juridiques"
        description="Suivi des dossiers, de l’ouverture à l’archivage. Seuls les dossiers auxquels vous avez accès sont affichés."
        actions={
          can('dossiers.create') && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Ouvrir un dossier
            </Button>
          )
        }
      />
      <Panel bodyClassName="p-0">
        <div className="space-y-2 border-b border-border/70 p-4">
          <div className="flex flex-wrap gap-2">
            <SearchInput value={search} onChange={set(setSearch)} placeholder="Référence, intitulé, client, partie adverse, n° de rôle…" className="min-w-[260px] flex-1" />
            <FilterSelect
              label="Périmètre"
              value={scope}
              onChange={set(setScope)}
              options={[
                { value: 'tous', label: 'Tous les dossiers' },
                { value: 'actifs', label: 'Dossiers actifs' },
                { value: 'mes', label: 'Mes dossiers' },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Statut" value={status} onChange={set(setStatus)} options={[{ value: 'tous', label: 'Tous les statuts' }, ...DOSSIER_STATUSES.map((s) => ({ value: s, label: DOSSIER_STATUS_LABELS[s] }))]} />
            <FilterSelect label="Domaine" value={category} onChange={set(setCategory)} options={[{ value: 'tous', label: 'Tous les domaines' }, ...DOSSIER_CATEGORIES.map((c) => ({ value: c, label: DOSSIER_CATEGORY_LABELS[c] }))]} />
            <FilterSelect
              label="Avocat responsable"
              value={responsibleId}
              onChange={set(setResponsibleId)}
              options={[{ value: 'tous', label: 'Tous les avocats' }, ...(users.data ?? []).filter((u) => ['associe', 'collaborateur'].includes(u.role)).map((u) => ({ value: String(u.id), label: u.fullName }))]}
            />
            <FilterSelect label="Confidentialité" value={confidentiality} onChange={set(setConfidentiality)} options={[{ value: 'tous', label: 'Toute confidentialité' }, ...CONFIDENTIALITY_LEVELS.map((c) => ({ value: c, label: CONFIDENTIALITY_LABELS[c] }))]} />
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatus('tous');
                  setScope('tous');
                  setCategory('tous');
                  setResponsibleId('tous');
                  setConfidentiality('tous');
                  setPage(1);
                }}
              >
                Réinitialiser ({activeFilters})
              </Button>
            )}
          </div>
        </div>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : !data?.items.length ? (
          <div className="p-6">
            <EmptyState title="Aucun dossier ne correspond" description="Élargissez la recherche ou réinitialisez les filtres." />
          </div>
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Dossier</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead className="hidden xl:table-cell">Domaine</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden lg:table-cell">Prochaine audience</TableHead>
                  <TableHead className="hidden sm:table-cell">Responsable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate(`/dossiers/${d.id}`)}>
                    <TableCell className="max-w-[420px] pl-5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[#8a6d2b]">{d.reference}</span>
                        <ConfidentialityMark level={d.confidentiality} />
                      </div>
                      <Link href={`/dossiers/${d.id}`} className="mt-0.5 block truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {d.title}
                      </Link>
                      <div className="truncate text-xs text-muted-foreground">
                        {d.procedureType} · ouvert le {formatShortDate(d.openedAt)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{d.client.displayName}</TableCell>
                    <TableCell className="hidden text-sm xl:table-cell">{DOSSIER_CATEGORY_LABELS[d.category]}</TableCell>
                    <TableCell>
                      <DossierStatusPill status={d.status} />
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {d.nextHearing ? (
                        <span className="flex items-center gap-1.5">
                          <Gavel className="size-3.5 text-[#b08d3c]" /> {formatDayMonth(d.nextHearing)} · {formatTime(d.nextHearing)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2 text-sm">
                        <Avatar name={d.responsible.fullName} className="size-7 text-[10px]" />
                        <span className="hidden truncate xl:inline">{d.responsible.fullName}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </div>
        )}
      </Panel>
      <DossierFormDialog open={creating} onOpenChange={setCreating} onSaved={(d) => navigate(`/dossiers/${d.id}`)} />
    </>
  );
}
