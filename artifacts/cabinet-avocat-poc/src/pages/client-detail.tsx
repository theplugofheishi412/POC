import { useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowLeft, Building2, FolderPlus, IdCard, Mail, MapPin, Pencil, Phone, Trash2, UserRound } from 'lucide-react';
import { CLIENT_TYPE_LABELS, DOSSIER_CATEGORY_LABELS, PARTY_ROLE_LABELS, type AuditEntryDTO, type ClientDTO, type DossierListItemDTO, type PartyRole } from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { useApiMutation } from '@/hooks/use-data';
import { formatDate, formatShortDate, relativeTime } from '@/lib/format';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatusPill } from '@/components/app/common';
import { ConfidentialityMark, DossierStatusPill } from '@/components/app/badges';
import { ClientFormDialog } from '@/components/forms/ClientForm';
import { DossierFormDialog } from '@/components/forms/DossierForm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ClientDossier = DossierListItemDTO & { partyRole: PartyRole | null; isMainClient: boolean };

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { can } = useSession();
  const [editing, setEditing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);

  const client = useQuery({ queryKey: ['client', id], queryFn: () => api.get<ClientDTO>(`/clients/${id}`) });
  const dossiers = useQuery({ queryKey: ['client', id, 'dossiers'], queryFn: () => api.get<ClientDossier[]>(`/clients/${id}/dossiers`) });
  const history = useQuery({ queryKey: ['client', id, 'history'], queryFn: () => api.get<AuditEntryDTO[]>(`/clients/${id}/history`) });

  const archive = useApiMutation(() => api.post<ClientDTO>(`/clients/${id}/${client.data?.status === 'archive' ? 'restore' : 'archive'}`), {
    success: (c) => (c.status === 'archive' ? 'Fiche archivée.' : 'Fiche réactivée.'),
    invalidate: [['client'], ['clients']],
    onSuccess: () => setConfirm(null),
  });
  const remove = useApiMutation(() => api.delete(`/clients/${id}`), {
    success: 'Fiche client supprimée.',
    invalidate: [['clients']],
    onSuccess: () => navigate('/clients'),
  });

  if (client.isLoading) return <LoadingState />;
  if (client.error || !client.data) return <ErrorState error={client.error} />;
  const c = client.data;
  const Icon = c.type === 'morale' ? Building2 : UserRound;

  return (
    <>
      <Link href="/clients" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Clients
      </Link>
      <PageHeader
        eyebrow={CLIENT_TYPE_LABELS[c.type]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.displayName}
            {c.status === 'archive' && <StatusPill tone="gray">Archivé</StatusPill>}
          </span>
        }
        description={`Client depuis le ${formatDate(c.createdAt)} · ${c.dossierCount} dossier(s) accessible(s)`}
        actions={
          <>
            {can('clients.delete') && (
              <>
                <Button variant="ghost" onClick={() => setConfirm('delete')} title="Supprimer (uniquement sans dossier)">
                  <Trash2 />
                </Button>
                <Button variant="outline" onClick={() => setConfirm('archive')}>
                  {c.status === 'archive' ? <ArchiveRestore /> : <Archive />}
                  {c.status === 'archive' ? 'Réactiver' : 'Archiver'}
                </Button>
              </>
            )}
            {can('clients.write') && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Modifier
              </Button>
            )}
            {can('dossiers.create') && c.status === 'actif' && (
              <Button onClick={() => setOpening(true)}>
                <FolderPlus /> Ouvrir un dossier
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel title="Fiche d’identification">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-[#e8ecf5] text-[#14213d]">
              <Icon className="size-6" />
            </span>
            <div>
              <div className="font-medium">{c.displayName}</div>
              <div className="text-xs text-muted-foreground">{c.type === 'morale' ? [c.legalForm, c.registrationNumber].filter(Boolean).join(' · ') : CLIENT_TYPE_LABELS[c.type]}</div>
            </div>
          </div>
          <dl className="space-y-3 text-sm">
            {c.representativeName && <Info icon={UserRound} label="Représentant légal" value={c.representativeName} />}
            <Info icon={Phone} label="Téléphone" value={c.phone} />
            <Info icon={Mail} label="Email" value={c.email} />
            <Info icon={MapPin} label="Adresse" value={[c.address, c.city].filter(Boolean).join(', ') || null} />
            {c.type === 'physique' && <Info icon={IdCard} label="Pièce d’identité" value={c.idNumber} />}
          </dl>
          {c.notes && (
            <div className="mt-5 rounded-lg bg-muted/60 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Observations</div>
              <p className="whitespace-pre-line text-sm">{c.notes}</p>
            </div>
          )}
        </Panel>

        <Panel bodyClassName="p-0">
          <Tabs defaultValue="dossiers">
            <div className="border-b border-border/70 px-4 pt-3">
              <TabsList>
                <TabsTrigger value="dossiers">Dossiers ({dossiers.data?.length ?? '…'})</TabsTrigger>
                <TabsTrigger value="historique">Historique</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="dossiers" className="m-0 p-4">
              {dossiers.isLoading ? (
                <LoadingState />
              ) : !dossiers.data?.length ? (
                <EmptyState title="Aucun dossier" description="Ce client n’est partie à aucun dossier qui vous est accessible." />
              ) : (
                <ul className="space-y-2.5">
                  {dossiers.data.map((d) => (
                    <li key={d.id}>
                      <Link href={`/dossiers/${d.id}`} className="block rounded-lg border border-border/80 p-3.5 transition-colors hover:border-[#b08d3c]/50 hover:bg-[#fbf7ee]/50">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-[#8a6d2b]">{d.reference}</span>
                          <DossierStatusPill status={d.status} />
                          <ConfidentialityMark level={d.confidentiality} />
                          <span className="ml-auto text-xs text-muted-foreground">
                            {d.isMainClient ? 'Client principal' : d.partyRole ? PARTY_ROLE_LABELS[d.partyRole] : ''}
                          </span>
                        </div>
                        <div className="mt-1.5 font-medium">{d.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {DOSSIER_CATEGORY_LABELS[d.category]} · {d.responsible.fullName} · ouvert le {formatShortDate(d.openedAt)}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="historique" className="m-0 p-4">
              {history.isLoading ? (
                <LoadingState />
              ) : !history.data?.length ? (
                <EmptyState title="Aucun historique" />
              ) : (
                <ol className="relative space-y-3.5 border-l border-border pl-5">
                  {history.data.map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-[#b08d3c]" />
                      <div className="text-[13px]">{h.summary}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.user?.fullName ?? 'Système'} · {relativeTime(h.createdAt)}
                        {h.dossier && ` · ${h.dossier.reference}`}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
          </Tabs>
        </Panel>
      </div>

      <ClientFormDialog open={editing} onOpenChange={setEditing} client={c} />
      <DossierFormDialog open={opening} onOpenChange={setOpening} defaultClientId={c.id} onSaved={(d) => navigate(`/dossiers/${d.id}`)} />
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={c.status === 'archive' ? 'Réactiver cette fiche ?' : 'Archiver cette fiche client ?'}
        description={
          c.status === 'archive'
            ? 'Le client redeviendra sélectionnable pour de nouveaux dossiers.'
            : 'La fiche est conservée avec son historique mais n’apparaît plus dans la liste des clients actifs. Un client ayant des dossiers actifs ne peut pas être archivé.'
        }
        confirmLabel={c.status === 'archive' ? 'Réactiver' : 'Archiver'}
        pending={archive.isPending}
        onConfirm={() => archive.mutate(undefined)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Supprimer définitivement cette fiche ?"
        description="La suppression n’est possible que pour une fiche saisie par erreur, sans aucun dossier. Dans les autres cas, archivez la fiche pour préserver l’historique des procédures."
        confirmLabel="Supprimer"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="break-words">{value || '—'}</dd>
      </div>
    </div>
  );
}
