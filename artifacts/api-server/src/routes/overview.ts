import { Router, type IRouter } from "express";
import {
  and,
  asc,
  auditLogTable,
  clientsTable,
  count,
  db,
  demarchesTable,
  desc,
  documentsTable,
  dossiersTable,
  eq,
  eventsTable,
  gte,
  ilike,
  inArray,
  invoicesTable,
  isNull,
  like,
  lte,
  ne,
  or,
  requetesTable,
  tasksTable,
} from "@workspace/db";
import {
  ACTIVE_DOSSIER_STATUSES,
  DEMARCHE_TYPE_LABELS,
  DOSSIER_CATEGORIES,
  DOSSIER_STATUSES,
  EVENT_TYPE_LABELS,
  type AuditEntryDTO,
  type DashboardDTO,
  type DossierStatus,
  type NotificationDTO,
  type SearchResultDTO,
  type UrgentItemDTO,
} from "@workspace/api-zod";
import { can, currentUser, requirePermission } from "../lib/auth";
import { dossierSummaries, loadUserRefs, ref, visibleDossierIds } from "../lib/access";
import { likePattern, pagination, queryString, today, toIsoDay } from "../lib/http";
import { fcfa, shortDate } from "../lib/format";
import { clientDisplayName } from "../lib/mappers";
import { toEventDTOs, toTaskDTOs } from "./activity";
import { toInvoiceDTOs } from "./billing";
import { resetDemoData } from "../seed";

const router: IRouter = Router();

const OPEN_DEMARCHES = ["a_effectuer", "en_cours", "en_attente", "reportee"];
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

router.get("/dashboard", async (req, res) => {
  const user = currentUser(req);
  const ids = await visibleDossierIds(user);
  const visible = ids.length ? ids : [0];
  const inVisible = (col: typeof dossiersTable.id | typeof eventsTable.dossierId | typeof demarchesTable.dossierId | typeof tasksTable.dossierId | typeof auditLogTable.dossierId) =>
    inArray(col, visible);
  const now = new Date();
  const todayStr = today();

  const [{ n: clients }] = (await db
    .select({ n: count() })
    .from(clientsTable)
    .where(and(eq(clientsTable.cabinetId, user.cabinetId), eq(clientsTable.status, "actif")))) as [{ n: number }];

  const dossierRows = await db
    .select({ status: dossiersTable.status, category: dossiersTable.category })
    .from(dossiersTable)
    .where(inVisible(dossiersTable.id));
  const byStatus = DOSSIER_STATUSES.map((status) => ({ status, count: dossierRows.filter((d) => d.status === status).length }));
  const byCategory = DOSSIER_CATEGORIES.map((category) => ({ category, count: dossierRows.filter((d) => d.category === category).length }));

  const eventScope = and(eq(eventsTable.cabinetId, user.cabinetId), or(isNull(eventsTable.dossierId), inVisible(eventsTable.dossierId)));
  const [{ n: hearings }] = (await db
    .select({ n: count() })
    .from(eventsTable)
    .where(and(eventScope, eq(eventsTable.type, "audience"), eq(eventsTable.status, "prevu"), gte(eventsTable.startAt, now)))) as [{ n: number }];
  const upcoming = await db
    .select()
    .from(eventsTable)
    .where(and(eventScope, eq(eventsTable.status, "prevu"), gte(eventsTable.endAt, now)))
    .orderBy(asc(eventsTable.startAt))
    .limit(8);

  const openDemarches = await db
    .select()
    .from(demarchesTable)
    .where(and(inVisible(demarchesTable.dossierId), inArray(demarchesTable.status, OPEN_DEMARCHES)))
    .orderBy(asc(demarchesTable.plannedDate));

  const taskScope = and(
    eq(tasksTable.cabinetId, user.cabinetId),
    or(isNull(tasksTable.dossierId), inVisible(tasksTable.dossierId)),
    can(user, "dossiers.view_all") ? undefined : or(eq(tasksTable.assigneeId, user.id), eq(tasksTable.createdBy, user.id), inVisible(tasksTable.dossierId)),
  );
  const openTasks = await db
    .select()
    .from(tasksTable)
    .where(and(taskScope, ne(tasksTable.status, "terminee")))
    .orderBy(asc(tasksTable.dueDate));

  let unpaidInvoices = 0;
  let unpaidAmount = 0;
  const urgent: UrgentItemDTO[] = [];
  if (can(user, "billing.read") && ids.length) {
    const invRows = await db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.cabinetId, user.cabinetId), inArray(invoicesTable.dossierId, ids), eq(invoicesTable.status, "emise")));
    const invoices = (await toInvoiceDTOs(user, invRows)).filter((i) => i.paymentState !== "payee");
    unpaidInvoices = invoices.length;
    unpaidAmount = invoices.reduce((s, i) => s + i.balance, 0);
    for (const i of invoices.filter((x) => x.overdue)) {
      urgent.push({
        kind: "facture",
        id: i.id,
        title: `Facture ${i.number} en retard`,
        subtitle: `${i.client.displayName} — reste ${fcfa(i.balance)}`,
        date: i.dueDate,
        overdue: true,
        href: `/facturation?facture=${i.id}`,
      });
    }
  }

  // Échéances urgentes : 3 jours pour les tâches/démarches, 7 jours pour l'agenda.
  const soon = toIsoDay(addDays(3));
  const dossierMap = await dossierSummaries([
    ...openTasks.map((t) => t.dossierId).filter((x): x is number => !!x),
    ...openDemarches.map((d) => d.dossierId),
  ]);
  for (const t of openTasks.filter((t) => t.dueDate && t.dueDate <= soon)) {
    urgent.push({
      kind: "tache",
      id: t.id,
      title: t.title,
      subtitle: t.dossierId ? `${dossierMap.get(t.dossierId)?.reference} — tâche` : "Tâche interne",
      date: t.dueDate!,
      overdue: t.dueDate! < todayStr,
      href: "/taches",
    });
  }
  for (const d of openDemarches.filter((d) => d.plannedDate <= soon)) {
    urgent.push({
      kind: "demarche",
      id: d.id,
      title: DEMARCHE_TYPE_LABELS[d.type as keyof typeof DEMARCHE_TYPE_LABELS],
      subtitle: `${dossierMap.get(d.dossierId)?.reference} — ${d.jurisdiction}`,
      date: d.plannedDate,
      overdue: d.plannedDate < todayStr,
      href: `/dossiers/${d.dossierId}?onglet=demarches`,
    });
  }
  const weekEvents = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        eventScope,
        eq(eventsTable.status, "prevu"),
        inArray(eventsTable.type, ["audience", "echeance", "depot_requete"]),
        gte(eventsTable.endAt, now),
        lte(eventsTable.startAt, addDays(7)),
      ),
    );
  for (const e of weekEvents) {
    urgent.push({
      kind: "evenement",
      id: e.id,
      title: e.title,
      subtitle: EVENT_TYPE_LABELS[e.type as keyof typeof EVENT_TYPE_LABELS],
      date: e.startAt.toISOString(),
      overdue: false,
      href: `/agenda?date=${toIsoDay(e.startAt)}`,
    });
  }
  urgent.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date));

  const refs = await loadUserRefs(user.cabinetId);
  const activity = await db
    .select()
    .from(auditLogTable)
    .where(
      and(
        eq(auditLogTable.cabinetId, user.cabinetId),
        or(isNull(auditLogTable.dossierId), inVisible(auditLogTable.dossierId)),
        ne(auditLogTable.entityType, "user"),
      ),
    )
    .orderBy(desc(auditLogTable.createdAt), desc(auditLogTable.id))
    .limit(12);
  const actDossiers = await dossierSummaries(activity.map((a) => a.dossierId).filter((x): x is number => !!x));

  const payload: DashboardDTO = {
    stats: {
      clients: Number(clients),
      activeDossiers: dossierRows.filter((d) => ACTIVE_DOSSIER_STATUSES.includes(d.status as DossierStatus)).length,
      closedDossiers: dossierRows.filter((d) => d.status === "cloture" || d.status === "archive").length,
      upcomingHearings: Number(hearings),
      pendingDemarches: openDemarches.length,
      openTasks: openTasks.length,
      unpaidInvoices,
      unpaidAmount,
    },
    byCategory,
    byStatus,
    upcomingEvents: await toEventDTOs(user, upcoming),
    urgent: urgent.slice(0, 10),
    recentActivity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      summary: a.summary,
      dossier: a.dossierId && actDossiers.get(a.dossierId) ? { id: a.dossierId, reference: actDossiers.get(a.dossierId)!.reference } : null,
      user: ref(refs, a.userId),
      createdAt: a.createdAt.toISOString(),
    })),
    myTasks: await toTaskDTOs(user, openTasks.filter((t) => t.assigneeId === user.id).slice(0, 6)),
  };
  res.json(payload);
});

router.get("/notifications", async (req, res) => {
  const user = currentUser(req);
  const ids = await visibleDossierIds(user);
  const now = new Date();
  const todayStr = today();
  const items: NotificationDTO[] = [];

  const events = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.cabinetId, user.cabinetId),
        eq(eventsTable.status, "prevu"),
        or(eq(eventsTable.assigneeId, user.id), eq(eventsTable.createdBy, user.id)),
        gte(eventsTable.startAt, now),
        lte(eventsTable.startAt, addDays(7)),
      ),
    )
    .orderBy(asc(eventsTable.startAt));
  for (const e of events) {
    if (e.startAt.getTime() - now.getTime() > e.reminderMinutes * 60_000) continue;
    items.push({
      id: `event-${e.id}`,
      kind: "rappel",
      title: `Rappel : ${EVENT_TYPE_LABELS[e.type as keyof typeof EVENT_TYPE_LABELS]}`,
      body: `${e.title} — ${shortDate(e.startAt)} à ${String(e.startAt.getHours()).padStart(2, "0")}h${String(e.startAt.getMinutes()).padStart(2, "0")}`,
      date: e.startAt.toISOString(),
      href: `/agenda?date=${toIsoDay(e.startAt)}`,
    });
  }

  const myTasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.assigneeId, user.id), ne(tasksTable.status, "terminee")));
  for (const t of myTasks) {
    if (t.dueDate && t.dueDate < todayStr) {
      items.push({ id: `late-${t.id}`, kind: "retard", title: "Tâche en retard", body: `${t.title} (échéance ${shortDate(t.dueDate)})`, date: t.dueDate, href: "/taches" });
    }
    if (t.createdBy && t.createdBy !== user.id && now.getTime() - t.createdAt.getTime() < 3 * 86_400_000) {
      const refs = await loadUserRefs(user.cabinetId);
      items.push({
        id: `assign-${t.id}`,
        kind: "assignation",
        title: "Nouvelle tâche attribuée",
        body: `${refs.get(t.createdBy)?.fullName} vous a confié : ${t.title}`,
        date: t.createdAt.toISOString(),
        href: "/taches",
      });
    }
  }

  if (can(user, "requetes.validate") && ids.length) {
    const pending = await db
      .select()
      .from(requetesTable)
      .where(and(inArray(requetesTable.dossierId, ids), eq(requetesTable.status, "a_valider")));
    for (const r of pending) {
      items.push({
        id: `validate-${r.id}-${r.currentVersion}`,
        kind: "validation",
        title: "Acte à valider",
        body: r.title,
        date: r.updatedAt.toISOString(),
        href: `/requetes/${r.id}`,
      });
    }
  }
  items.sort((a, b) => b.date.localeCompare(a.date));
  res.json(items);
});

router.get("/search", async (req, res) => {
  const user = currentUser(req);
  const q = queryString(req, "q");
  const empty: SearchResultDTO = { clients: [], dossiers: [], documents: [] };
  if (!q || q.length < 2) {
    res.json(empty);
    return;
  }
  const p = likePattern(q);
  const ids = await visibleDossierIds(user);
  const clients = await db
    .select()
    .from(clientsTable)
    .where(
      and(
        eq(clientsTable.cabinetId, user.cabinetId),
        or(ilike(clientsTable.firstName, p), ilike(clientsTable.lastName, p), ilike(clientsTable.companyName, p), ilike(clientsTable.email, p), ilike(clientsTable.phone, p)),
      ),
    )
    .limit(6);
  const dossiers = ids.length
    ? await db
        .select({ id: dossiersTable.id, reference: dossiersTable.reference, title: dossiersTable.title, status: dossiersTable.status })
        .from(dossiersTable)
        .where(and(inArray(dossiersTable.id, ids), or(ilike(dossiersTable.reference, p), ilike(dossiersTable.title, p), ilike(dossiersTable.roleNumber, p))))
        .limit(6)
    : [];
  const documents =
    ids.length && can(user, "documents.read")
      ? await db
          .select({ id: documentsTable.id, name: documentsTable.name, dossierId: documentsTable.dossierId, dossierReference: dossiersTable.reference })
          .from(documentsTable)
          .innerJoin(dossiersTable, eq(dossiersTable.id, documentsTable.dossierId))
          .where(and(inArray(documentsTable.dossierId, ids), ilike(documentsTable.name, p)))
          .limit(6)
      : [];
  const result: SearchResultDTO = {
    clients: clients.map((c) => ({ id: c.id, displayName: clientDisplayName(c), type: c.type as "physique" | "morale", city: c.city })),
    dossiers: dossiers.map((d) => ({ ...d, status: d.status as DossierStatus })),
    documents,
  };
  res.json(result);
});

router.get("/audit", requirePermission("audit.read"), async (req, res) => {
  const user = currentUser(req);
  const { page, pageSize, offset } = pagination(req, 25);
  const search = queryString(req, "search");
  const entity = queryString(req, "entity");
  const where = and(
    eq(auditLogTable.cabinetId, user.cabinetId),
    search ? ilike(auditLogTable.summary, likePattern(search)) : undefined,
    entity ? like(auditLogTable.action, `${entity.replace(/[^a-z_]/g, "")}.%`) : undefined,
  );
  const [{ total }] = (await db.select({ total: count() }).from(auditLogTable).where(where)) as [{ total: number }];
  const rows = await db.select().from(auditLogTable).where(where).orderBy(desc(auditLogTable.createdAt), desc(auditLogTable.id)).limit(pageSize).offset(offset);
  const refs = await loadUserRefs(user.cabinetId);
  const dossiers = await dossierSummaries(rows.map((r) => r.dossierId).filter((x): x is number => !!x));
  const items: AuditEntryDTO[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    dossier: r.dossierId && dossiers.get(r.dossierId) ? { id: r.dossierId, reference: dossiers.get(r.dossierId)!.reference } : null,
    user: ref(refs, r.userId),
    createdAt: r.createdAt.toISOString(),
  }));
  res.json({ items, total: Number(total), page, pageSize });
});

router.post("/demo/reset", requirePermission("demo.reset"), async (req, res) => {
  const user = currentUser(req);
  req.log.warn({ userId: user.id }, "Réinitialisation des données de démonstration");
  await resetDemoData();
  // L'utilisateur courant doit se reconnecter : ses sessions ont été purgées.
  res.clearCookie("cabinet_session", { path: "/" });
  res.json({ ok: true });
});

export default router;
