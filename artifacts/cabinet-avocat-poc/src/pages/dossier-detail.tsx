import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, FilePlus2, FileText, History, Landmark, ListPlus, Pencil, Plus, Trash2, Upload, UserPlus } from 'lucide-react';
import {
  CONFIDENTIALITY_LABELS,
  DOSSIER_CATEGORY_LABELS,
  DOSSIER_STATUSES,
  DOSSIER_STATUS_LABELS,
  PARTY_ROLE_LABELS,
  type AuditEntryDTO,
  type DemarcheDTO,
  type DocumentDTO,
  type DossierDTO,
  type DossierStatus,
  type EventDTO,
  type InvoiceDTO,
  type PartyDTO,
  type RequeteDTO,
  type TaskDTO,
} from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { useApiMutation } from '@/hooks/use-data';
import { fcfa, formatDate, formatDateTime, formatShortDate } from '@/lib/format';
import { useQueryParam, replaceQueryParam } from '@/lib/url';
import { Avatar, ConfirmDialog, EmptyState, ErrorState, LoadingState, NativeSelect, PageHeader, Panel, useConfirm } from '@/components/app/common';
import { ConfidentialityMark, DossierStatusPill, PaymentPill } from '@/components/app/badges';
import { DossierFormDialog } from '@/components/forms/DossierForm';
import { DemarcheFormDialog, EventFormDialog, PartyFormDialog, TaskFormDialog } from '@/components/forms/ActivityForms';
import { UploadDialog } from '@/components/forms/DocumentDialogs';
import { PiecesTab } from '@/components/dossier/PiecesTab';
import { DemarchesTimeline } from '@/components/dossier/DemarchesTimeline';
import { DocumentsList, EventList, RequeteCreateDialog, RequeteList, TaskList } from '@/components/dossier/Lists';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function useDossierData<T>(dossierId: string, kind: string, path: string, enabled = true) {
  return useQuery({ queryKey: [kind, dossierId], queryFn: () => api.get<T>(path), enabled });
}

function Synthesis({ d }: { d: DossierDTO }) {
  const [partyEdit, setPartyEdit] = useState<PartyDTO | null | 'new'>(null);
  const del = useConfirm<PartyDTO>();
  const remove = useApiMutation((p: PartyDTO) => api.delete(`/dossiers/${d.id}/parties/${p.id}`), {
    success: 'Partie retirée du dossier.',
    invalidate: [['dossier']],
    onSuccess: () => del.close(),
  });
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Panel title="Description">
          <p className="whitespace-pre-line text-sm leading-relaxed">{d.description || <span className="text-muted-foreground">Aucune description.</span>}</p>
        </Panel>
        <Panel
          title="Parties concernées"
          description="Plusieurs parties peuvent intervenir dans un même dossier"
          actions={
            d.canEdit && (
              <Button variant="outline" size="sm" onClick={() => setPartyEdit('new')}>
                <UserPlus /> Ajouter une partie
              </Button>
            )
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {d.parties.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-[#8a6d2b]">{PARTY_ROLE_LABELS[p.role]}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {p.clientId ? (
                      <Link href={`/clients/${p.clientId}`} className="hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      p.name
                    )}
                    {p.clientId === d.client.id && <span className="ml-2 rounded bg-[#e8ecf5] px-1.5 py-0.5 text-[10px] font-semibold text-[#14213d]">CLIENT</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.counsel ? `Conseil : ${p.counsel}` : p.clientId === d.client.id ? `Conseil : ${d.responsible.fullName} (cabinet)` : 'Conseil non renseigné'}
                    {p.notes && ` · ${p.notes}`}
                  </div>
                </div>
                {d.canEdit && (
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setPartyEdit(p)} aria-label="Modifier">
                      <Pencil />
                    </Button>
                    {p.clientId !== d.client.id && (
                      <Button variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => del.ask(p)} aria-label="Retirer">
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel title="Informations">
          <dl className="space-y-3 text-sm">
            {(
              [
                ['Client principal', <Link key="c" href={`/clients/${d.client.id}`} className="font-medium hover:underline">{d.client.displayName}</Link>],
                ['Domaine juridique', DOSSIER_CATEGORY_LABELS[d.category]],
                ['Type de procédure', d.procedureType],
                ['Juridiction', d.jurisdiction ?? '—'],
                ['N° de rôle', d.roleNumber ?? 'Non attribué'],
                ['Date d’ouverture', formatDate(d.openedAt)],
                ...(d.closedAt ? [['Date de clôture', formatDate(d.closedAt)] as const] : []),
                ['Confidentialité', CONFIDENTIALITY_LABELS[d.confidentiality]],
                ['Prochaine audience', d.nextHearing ? formatDateTime(d.nextHearing) : '—'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Équipe">
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <Avatar name={d.responsible.fullName} />
              <div>
                <div className="text-sm font-medium">{d.responsible.fullName}</div>
                <div className="text-xs text-[#8a6d2b]">Avocat responsable</div>
              </div>
            </li>
            {d.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.fullName} />
                <div>
                  <div className="text-sm">{m.fullName}</div>
                  <div className="text-xs text-muted-foreground">Collaborateur associé</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {partyEdit && <PartyFormDialog open onOpenChange={(o) => !o && setPartyEdit(null)} dossierId={d.id} party={partyEdit === 'new' ? null : partyEdit} />}
      <ConfirmDialog
        open={del.open}
        onOpenChange={(o) => !o && del.close()}
        title="Retirer cette partie ?"
        description={`${del.target?.name} ne figurera plus parmi les parties du dossier.`}
        confirmLabel="Retirer"
        destructive
        pending={remove.isPending}
        onConfirm={() => del.target && remove.mutate(del.target)}
      />
    </div>
  );
}

export default function DossierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const [tab, setTab] = useState(useQueryParam('onglet') ?? 'synthese');
  const [dialog, setDialog] = useState<null | 'edit' | 'upload' | 'demarche' | 'event' | 'task' | 'requete'>(null);

  const dossier = useQuery({ queryKey: ['dossier', id], queryFn: () => api.get<DossierDTO>(`/dossiers/${id}`) });
  const docsAllowed = can('documents.read');
  const documents = useDossierData<DocumentDTO[]>(id, 'documents', `/dossiers/${id}/documents`, docsAllowed && tab === 'documents');
  const requetes = useQuery({ queryKey: ['requetes', id], queryFn: () => api.get<RequeteDTO[]>('/requetes', { dossierId: id }), enabled: docsAllowed && tab === 'requetes' });
  const demarches = useQuery({ queryKey: ['demarches', id], queryFn: () => api.get<DemarcheDTO[]>('/demarches', { dossierId: id }), enabled: tab === 'demarches' });
  const events = useQuery({ queryKey: ['events', 'dossier', id], queryFn: () => api.get<EventDTO[]>('/events', { dossierId: id }), enabled: tab === 'agenda' });
  const tasks = useQuery({ queryKey: ['tasks', 'dossier', id], queryFn: () => api.get<TaskDTO[]>('/tasks', { dossierId: id }), enabled: tab === 'taches' });
  const invoices = useQuery({ queryKey: ['invoices', 'dossier', id], queryFn: () => api.get<InvoiceDTO[]>('/invoices', { dossierId: id }), enabled: can('billing.read') && tab === 'facturation' });
  const history = useQuery({ queryKey: ['dossier', id, 'history'], queryFn: () => api.get<AuditEntryDTO[]>(`/dossiers/${id}/history`), enabled: tab === 'historique' });

  const setStatus = useApiMutation((status: DossierStatus) => api.post<DossierDTO>(`/dossiers/${id}/status`, { status }), {
    success: (d) => `Statut : ${DOSSIER_STATUS_LABELS[d.status]}.`,
    invalidate: [['dossier'], ['dossiers']],
  });

  if (dossier.isLoading) return <LoadingState />;
  if (dossier.error || !dossier.data) return <ErrorState error={dossier.error} />;
  const d = dossier.data;
  const writable = d.status !== 'archive';
  const changeTab = (t: string) => {
    setTab(t);
    replaceQueryParam('onglet', t === 'synthese' ? null : t);
  };

  const tabs: { value: string; label: string; count?: number; show: boolean }[] = [
    { value: 'synthese', label: 'Synthèse', show: true },
    { value: 'pieces', label: 'Pièces & bordereaux', count: d.counts.pieces, show: docsAllowed },
    { value: 'documents', label: 'Documents', count: d.counts.documents, show: docsAllowed },
    { value: 'requetes', label: 'Requêtes', count: d.counts.requetes, show: docsAllowed },
    { value: 'demarches', label: 'Démarches', count: d.counts.demarches, show: true },
    { value: 'agenda', label: 'Agenda', count: d.counts.events, show: true },
    { value: 'taches', label: 'Tâches', count: d.counts.tasks, show: true },
    { value: 'facturation', label: 'Facturation', count: d.counts.invoices, show: can('billing.read') },
    { value: 'historique', label: 'Historique', show: true },
  ];

  return (
    <>
      <Link href="/dossiers" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Dossiers
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2 font-mono normal-case tracking-normal">
            {d.reference} <ConfidentialityMark level={d.confidentiality} />
          </span>
        }
        title={d.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <DossierStatusPill status={d.status} />
            <span>
              {DOSSIER_CATEGORY_LABELS[d.category]} · {d.procedureType} · {d.responsible.fullName} · ouvert le {formatShortDate(d.openedAt)}
            </span>
          </span>
        }
        actions={
          d.canEdit && (
            <>
              <NativeSelect
                aria-label="Changer le statut"
                value={d.status}
                onChange={(e) => setStatus.mutate(e.target.value as DossierStatus)}
                disabled={setStatus.isPending}
                className="h-9 w-[200px] bg-card"
              >
                {DOSSIER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    Statut : {DOSSIER_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil /> Modifier
              </Button>
            </>
          )
        }
      />

      {writable && (
        <div className="mb-5 flex flex-wrap gap-2">
          {can('documents.write') && (
            <>
              <Button variant="outline" size="sm" onClick={() => changeTab('pieces')}>
                <FilePlus2 /> Pièces & bordereau
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDialog('upload')}>
                <Upload /> Joindre un document
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDialog('requete')}>
                <FileText /> Préparer une requête
              </Button>
            </>
          )}
          {can('demarches.write') && (
            <Button variant="outline" size="sm" onClick={() => setDialog('demarche')}>
              <Landmark /> Démarche au palais
            </Button>
          )}
          {can('events.write') && (
            <Button variant="outline" size="sm" onClick={() => setDialog('event')}>
              <CalendarPlus /> Programmer une audience
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setDialog('task')}>
            <ListPlus /> Attribuer une tâche
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={changeTab}>
        <div className="-mx-1 mb-5 overflow-x-auto px-1">
          <TabsList className="h-auto flex-nowrap">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="whitespace-nowrap">
                  {t.label}
                  {t.count !== undefined && t.count > 0 && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] tabular">{t.count}</span>}
                </TabsTrigger>
              ))}
          </TabsList>
        </div>
        <TabsContent value="synthese">
          <Synthesis d={d} />
        </TabsContent>
        {docsAllowed && (
          <TabsContent value="pieces">
            <PiecesTab dossier={d} />
          </TabsContent>
        )}
        {docsAllowed && (
          <TabsContent value="documents">
            <Panel
              title="Documents du dossier"
              description="Accès réservé aux personnes autorisées sur ce dossier"
              actions={
                can('documents.write') &&
                writable && (
                  <Button size="sm" onClick={() => setDialog('upload')}>
                    <Upload /> Joindre un document
                  </Button>
                )
              }
            >
              {documents.isLoading ? <LoadingState /> : <DocumentsList items={documents.data ?? []} />}
            </Panel>
          </TabsContent>
        )}
        {docsAllowed && (
          <TabsContent value="requetes">
            <Panel
              title="Requêtes et actes"
              actions={
                can('documents.write') &&
                writable && (
                  <Button size="sm" onClick={() => setDialog('requete')}>
                    <Plus /> Préparer une requête
                  </Button>
                )
              }
            >
              {requetes.isLoading ? <LoadingState /> : <RequeteList items={requetes.data ?? []} />}
            </Panel>
          </TabsContent>
        )}
        <TabsContent value="demarches">
          <Panel
            title="Chronologie des démarches au palais"
            description="Dépôts, retraits, renseignements et suivis, dans l’ordre chronologique"
            actions={
              can('demarches.write') &&
              writable && (
                <Button size="sm" onClick={() => setDialog('demarche')}>
                  <Plus /> Enregistrer une démarche
                </Button>
              )
            }
          >
            {demarches.isLoading ? <LoadingState /> : <DemarchesTimeline items={demarches.data ?? []} />}
          </Panel>
        </TabsContent>
        <TabsContent value="agenda">
          <Panel
            title="Audiences, rendez-vous et échéances"
            actions={
              can('events.write') &&
              writable && (
                <Button size="sm" onClick={() => setDialog('event')}>
                  <CalendarPlus /> Programmer
                </Button>
              )
            }
          >
            {events.isLoading ? <LoadingState /> : <EventList items={events.data ?? []} />}
          </Panel>
        </TabsContent>
        <TabsContent value="taches">
          <Panel
            title="Tâches du dossier"
            actions={
              writable && (
                <Button size="sm" onClick={() => setDialog('task')}>
                  <ListPlus /> Attribuer une tâche
                </Button>
              )
            }
          >
            {tasks.isLoading ? <LoadingState /> : <TaskList items={tasks.data ?? []} />}
          </Panel>
        </TabsContent>
        {can('billing.read') && (
          <TabsContent value="facturation">
            <Panel
              title="Factures du dossier"
              actions={
                <Button size="sm" variant="outline" asChild>
                  <Link href="/facturation">Ouvrir la facturation</Link>
                </Button>
              }
            >
              {invoices.isLoading ? (
                <LoadingState />
              ) : !invoices.data?.length ? (
                <EmptyState title="Aucune facture pour ce dossier" />
              ) : (
                <ul className="divide-y">
                  {invoices.data.map((i) => (
                    <li key={i.id}>
                      <Link href={`/facturation?facture=${i.id}`} className="flex flex-wrap items-center gap-3 py-3 hover:opacity-80">
                        <span className="font-mono text-xs">{i.number}</span>
                        <span className="text-xs text-muted-foreground">émise le {formatShortDate(i.issueDate)}</span>
                        <span className="tabular ml-auto text-sm font-medium">{fcfa(i.total)}</span>
                        <PaymentPill state={i.paymentState} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </TabsContent>
        )}
        <TabsContent value="historique">
          <Panel title="Historique des événements du dossier" description="Journal horodaté de toutes les opérations (traçabilité)">
            {history.isLoading ? (
              <LoadingState />
            ) : !history.data?.length ? (
              <EmptyState title="Aucun événement" icon={History} />
            ) : (
              <ol className="relative space-y-4 border-l-2 border-border pl-6">
                {history.data.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[31px] top-1 size-3 rounded-full border-2 border-card bg-[#b08d3c]" />
                    <div className="text-sm">{h.summary}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(h.createdAt)} · {h.user?.fullName ?? 'Système'}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <DossierFormDialog open={dialog === 'edit'} onOpenChange={(o) => !o && setDialog(null)} dossier={d} />
      {dialog === 'upload' && <UploadDialog open onOpenChange={(o) => !o && setDialog(null)} dossierId={d.id} />}
      {dialog === 'demarche' && <DemarcheFormDialog open onOpenChange={(o) => !o && setDialog(null)} dossierId={d.id} defaultJurisdiction={d.jurisdiction} />}
      {dialog === 'event' && <EventFormDialog open onOpenChange={(o) => !o && setDialog(null)} dossierId={d.id} />}
      {dialog === 'task' && <TaskFormDialog open onOpenChange={(o) => !o && setDialog(null)} dossierId={d.id} />}
      {dialog === 'requete' && <RequeteCreateDialog open onOpenChange={(o) => !o && setDialog(null)} dossierId={d.id} />}
    </>
  );
}
