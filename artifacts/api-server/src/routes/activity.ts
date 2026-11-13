import { Router, type IRouter, type Request } from "express";
import {
  and,
  asc,
  db,
  demarchesTable,
  desc,
  documentsTable,
  dossierMembersTable,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  tasksTable,
  eventsTable,
  type Demarche,
  type Dossier,
  type EventRow,
  type Task,
} from "@workspace/db";
import {
  DEMARCHE_STATUSES,
  DEMARCHE_STATUS_LABELS,
  DEMARCHE_TYPES,
  DEMARCHE_TYPE_LABELS,
  demarcheSchema,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  eventSchema,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  taskSchema,
  taskStatusSchema,
  type DemarcheDTO,
  type EventDTO,
  type TaskDTO,
} from "@workspace/api-zod";
import { assertCan, can, currentUser, type AuthUser } from "../lib/auth";
import {
  assertCabinetUser,
  audit,
  canEditDossier,
  dossierSummaries,
  getAccessibleDossier,
  isDossierMember,
  loadUserRefs,
  ref,
  refStrict,
  touchDossier,
  visibleDossierIds,
} from "../lib/access";
import { forbidden, idParam, likePattern, notFound, parseBody, queryInt, queryString } from "../lib/http";
import { shortDate } from "../lib/format";

const router: IRouter = Router();

/**
 * Lorsqu'une tâche ou une démarche est confiée à quelqu'un qui n'a pas
 * encore accès au dossier, l'accès lui est ouvert (et c'est tracé).
 */
async function grantAccessIfNeeded(req: Request, user: AuthUser, dossier: Dossier, assigneeId: number, reason: string) {
  if (await isDossierMember(assigneeId, dossier)) return;
  if (!(await canEditDossier(user, dossier))) return;
  await db.insert(dossierMembersTable).values({ dossierId: dossier.id, userId: assigneeId }).onConflictDoNothing();
  const refs = await loadUserRefs(user.cabinetId);
  await audit(req, {
    action: "dossier.member_add",
    entityType: "dossier",
    entityId: dossier.id,
    dossierId: dossier.id,
    summary: `Accès au dossier ouvert à ${refs.get(assigneeId)?.fullName} (${reason})`,
  });
}

/** Condition « rattaché à un dossier visible ou à aucun dossier ». */
function visibleOrNone(column: typeof tasksTable.dossierId | typeof eventsTable.dossierId, ids: number[]) {
  return ids.length ? or(isNull(column), inArray(column, ids)) : isNull(column);
}

/* ------------------------------------------------------------------ */
/* Démarches au palais de justice                                      */
/* ------------------------------------------------------------------ */

async function toDemarcheDTOs(user: AuthUser, rows: Demarche[]): Promise<DemarcheDTO[]> {
  if (!rows.length) return [];
  const refs = await loadUserRefs(user.cabinetId);
  const dossiers = await dossierSummaries(rows.map((r) => r.dossierId));
  const docs = can(user, "documents.read")
    ? await db
        .select({ id: documentsTable.id, name: documentsTable.name, mimeType: documentsTable.mimeType, demarcheId: documentsTable.demarcheId })
        .from(documentsTable)
        .where(inArray(documentsTable.demarcheId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => ({
    id: r.id,
    dossierId: r.dossierId,
    dossierReference: dossiers.get(r.dossierId)?.reference ?? "",
    dossierTitle: dossiers.get(r.dossierId)?.title ?? "",
    type: r.type as DemarcheDTO["type"],
    jurisdiction: r.jurisdiction,
    assignee: refStrict(refs, r.assigneeId),
    plannedDate: r.plannedDate,
    executedDate: r.executedDate,
    status: r.status as DemarcheDTO["status"],
    observations: r.observations,
    result: r.result,
    documents: docs.filter((d) => d.demarcheId === r.id).map(({ id, name, mimeType }) => ({ id, name, mimeType })),
    createdBy: ref(refs, r.createdBy),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

router.get("/demarches", async (req, res) => {
  const user = currentUser(req);
  const ids = await visibleDossierIds(user);
  if (!ids.length) {
    res.json([]);
    return;
  }
  const dossierId = queryInt(req, "dossierId");
  const status = queryString(req, "status");
  const type = queryString(req, "type");
  const assigneeId = queryInt(req, "assigneeId");
  const search = queryString(req, "search");
  const from = queryString(req, "from");
  const to = queryString(req, "to");
  const rows = await db
    .select()
    .from(demarchesTable)
    .where(
      and(
        inArray(demarchesTable.dossierId, ids),
        dossierId ? eq(demarchesTable.dossierId, dossierId) : undefined,
        status && (DEMARCHE_STATUSES as readonly string[]).includes(status) ? eq(demarchesTable.status, status) : undefined,
        status === "ouvertes" ? inArray(demarchesTable.status, ["a_effectuer", "en_cours", "en_attente", "reportee"]) : undefined,
        type && (DEMARCHE_TYPES as readonly string[]).includes(type) ? eq(demarchesTable.type, type) : undefined,
        assigneeId ? eq(demarchesTable.assigneeId, assigneeId) : undefined,
        from ? gte(demarchesTable.plannedDate, from) : undefined,
        to ? lte(demarchesTable.plannedDate, to) : undefined,
        search ? or(ilike(demarchesTable.jurisdiction, likePattern(search)), ilike(demarchesTable.observations, likePattern(search))) : undefined,
      ),
    )
    .orderBy(dossierId ? asc(demarchesTable.plannedDate) : desc(demarchesTable.plannedDate), asc(demarchesTable.id));
  res.json(await toDemarcheDTOs(user, rows));
});

async function accessibleDemarche(user: AuthUser, id: number) {
  const [d] = await db.select().from(demarchesTable).where(eq(demarchesTable.id, id));
  if (!d) throw notFound("Démarche");
  const dossier = await getAccessibleDossier(user, d.dossierId);
  return { d, dossier };
}

router.get("/demarches/:id", async (req, res) => {
  const user = currentUser(req);
  const { d } = await accessibleDemarche(user, idParam(req));
  const [dto] = await toDemarcheDTOs(user, [d]);
  res.json(dto);
});

router.post("/demarches", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "demarches.write");
  const input = parseBody(demarcheSchema, req);
  const dossier = await getAccessibleDossier(user, input.dossierId);
  await assertCabinetUser(user.cabinetId, input.assigneeId, "La personne chargée");
  if (input.assigneeId !== user.id && !can(user, "tasks.assign")) {
    throw forbidden("Vous pouvez enregistrer une démarche à votre nom uniquement.");
  }
  const [d] = await db
    .insert(demarchesTable)
    .values({
      cabinetId: user.cabinetId,
      dossierId: dossier.id,
      type: input.type,
      jurisdiction: input.jurisdiction,
      assigneeId: input.assigneeId,
      plannedDate: input.plannedDate,
      executedDate: input.executedDate ?? null,
      status: input.status,
      observations: input.observations ?? null,
      result: input.result ?? null,
      createdBy: user.id,
    })
    .returning();
  await grantAccessIfNeeded(req, user, dossier, input.assigneeId, "démarche au palais");
  await touchDossier(dossier.id);
  const refs = await loadUserRefs(user.cabinetId);
  await audit(req, {
    action: "demarche.create",
    entityType: "demarche",
    entityId: d!.id,
    dossierId: dossier.id,
    summary: `Démarche « ${DEMARCHE_TYPE_LABELS[input.type]} » au ${input.jurisdiction} prévue le ${shortDate(input.plannedDate)} — ${refs.get(input.assigneeId)?.fullName} (${DEMARCHE_STATUS_LABELS[input.status]})`,
  });
  const [dto] = await toDemarcheDTOs(user, [d!]);
  res.status(201).json(dto);
});

router.patch("/demarches/:id", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "demarches.write");
  const { d, dossier } = await accessibleDemarche(user, idParam(req));
  if (d.assigneeId !== user.id && d.createdBy !== user.id && !can(user, "tasks.assign")) {
    throw forbidden("Seule la personne chargée de la démarche peut la mettre à jour.");
  }
  const input = parseBody(demarcheSchema, req);
  if (input.dossierId !== d.dossierId) await getAccessibleDossier(user, input.dossierId);
  if (input.assigneeId !== d.assigneeId) {
    await assertCabinetUser(user.cabinetId, input.assigneeId, "La personne chargée");
    if (!can(user, "tasks.assign")) throw forbidden("Vous ne pouvez pas réattribuer cette démarche.");
  }
  const [updated] = await db
    .update(demarchesTable)
    .set({
      dossierId: input.dossierId,
      type: input.type,
      jurisdiction: input.jurisdiction,
      assigneeId: input.assigneeId,
      plannedDate: input.plannedDate,
      executedDate: input.executedDate ?? null,
      status: input.status,
      observations: input.observations ?? null,
      result: input.result ?? null,
      updatedAt: new Date(),
    })
    .where(eq(demarchesTable.id, d.id))
    .returning();
  if (input.assigneeId !== d.assigneeId) await grantAccessIfNeeded(req, user, dossier, input.assigneeId, "démarche au palais");
  await touchDossier(input.dossierId);
  const changes: string[] = [];
  if (input.status !== d.status) changes.push(`statut : ${DEMARCHE_STATUS_LABELS[input.status]}`);
  if (input.executedDate && input.executedDate !== d.executedDate) changes.push(`exécutée le ${shortDate(input.executedDate)}`);
  if (input.plannedDate !== d.plannedDate) changes.push(`replanifiée au ${shortDate(input.plannedDate)}`);
  await audit(req, {
    action: "demarche.update",
    entityType: "demarche",
    entityId: d.id,
    dossierId: input.dossierId,
    summary: `Démarche « ${DEMARCHE_TYPE_LABELS[input.type]} » mise à jour${changes.length ? ` (${changes.join(", ")})` : ""}${input.result ? ` — ${input.result}` : ""}`,
  });
  const [dto] = await toDemarcheDTOs(user, [updated!]);
  res.json(dto);
});

router.delete("/demarches/:id", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "demarches.write");
  const { d, dossier } = await accessibleDemarche(user, idParam(req));
  if (d.createdBy !== user.id && !can(user, "tasks.assign")) throw forbidden("Vous ne pouvez supprimer que les démarches que vous avez créées.");
  await db.delete(demarchesTable).where(eq(demarchesTable.id, d.id));
  await audit(req, {
    action: "demarche.delete",
    entityType: "demarche",
    entityId: d.id,
    dossierId: dossier.id,
    summary: `Suppression de la démarche « ${DEMARCHE_TYPE_LABELS[d.type as keyof typeof DEMARCHE_TYPE_LABELS]} » du ${shortDate(d.plannedDate)}`,
  });
  res.status(204).end();
});

/* ------------------------------------------------------------------ */
/* Agenda                                                             */
/* ------------------------------------------------------------------ */

export async function toEventDTOs(user: AuthUser, rows: EventRow[]): Promise<EventDTO[]> {
  if (!rows.length) return [];
  const refs = await loadUserRefs(user.cabinetId);
  const dossiers = await dossierSummaries(rows.map((r) => r.dossierId).filter((x): x is number => !!x));
  return rows.map((e) => ({
    id: e.id,
    type: e.type as EventDTO["type"],
    title: e.title,
    dossier: e.dossierId ? (dossiers.get(e.dossierId) ?? null) : null,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    location: e.location,
    assignee: ref(refs, e.assigneeId),
    description: e.description,
    reminderMinutes: e.reminderMinutes,
    status: e.status as EventDTO["status"],
    createdBy: ref(refs, e.createdBy),
  }));
}

router.get("/events", async (req, res) => {
  const user = currentUser(req);
  const ids = await visibleDossierIds(user);
  const from = queryString(req, "from");
  const to = queryString(req, "to");
  const type = queryString(req, "type");
  const assigneeId = queryInt(req, "assigneeId");
  const dossierId = queryInt(req, "dossierId");
  const rows = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.cabinetId, user.cabinetId),
        visibleOrNone(eventsTable.dossierId, ids),
        from && !Number.isNaN(Date.parse(from)) ? gte(eventsTable.endAt, new Date(from)) : undefined,
        to && !Number.isNaN(Date.parse(to)) ? lte(eventsTable.startAt, new Date(to)) : undefined,
        type && (EVENT_TYPES as readonly string[]).includes(type) ? eq(eventsTable.type, type) : undefined,
        assigneeId ? eq(eventsTable.assigneeId, assigneeId) : undefined,
        dossierId ? eq(eventsTable.dossierId, dossierId) : undefined,
      ),
    )
    .orderBy(asc(eventsTable.startAt))
    .limit(1000);
  res.json(await toEventDTOs(user, rows));
});

async function accessibleEvent(user: AuthUser, id: number) {
  const [e] = await db
    .select()
    .from(eventsTable)
    .where(and(eq(eventsTable.id, id), eq(eventsTable.cabinetId, user.cabinetId)));
  if (!e) throw notFound("Événement");
  if (e.dossierId) await getAccessibleDossier(user, e.dossierId);
  return e;
}

async function eventValues(user: AuthUser, input: ReturnType<typeof eventSchema.parse>) {
  if (input.dossierId) await getAccessibleDossier(user, input.dossierId);
  if (input.assigneeId) await assertCabinetUser(user.cabinetId, input.assigneeId, "Le collaborateur");
  return {
    type: input.type,
    title: input.title,
    dossierId: input.dossierId ?? null,
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
    location: input.location ?? null,
    assigneeId: input.assigneeId ?? null,
    description: input.description ?? null,
    reminderMinutes: input.reminderMinutes,
    status: input.status,
  };
}

const eventDate = (d: Date) =>
  `${shortDate(d)} à ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;

router.post("/events", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "events.write");
  const input = parseBody(eventSchema, req);
  const values = await eventValues(user, input);
  const [e] = await db.insert(eventsTable).values({ ...values, cabinetId: user.cabinetId, createdBy: user.id }).returning();
  if (e!.dossierId) await touchDossier(e!.dossierId);
  await audit(req, {
    action: "event.create",
    entityType: "event",
    entityId: e!.id,
    dossierId: e!.dossierId,
    summary: `${EVENT_TYPE_LABELS[input.type]} programmé(e) le ${eventDate(e!.startAt)} : ${input.title}`,
  });
  const [dto] = await toEventDTOs(user, [e!]);
  res.status(201).json(dto);
});

router.patch("/events/:id", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "events.write");
  const existing = await accessibleEvent(user, idParam(req));
  const input = parseBody(eventSchema, req);
  const values = await eventValues(user, input);
  const [e] = await db.update(eventsTable).set(values).where(eq(eventsTable.id, existing.id)).returning();
  if (e!.dossierId) await touchDossier(e!.dossierId);
  const moved = existing.startAt.getTime() !== e!.startAt.getTime();
  await audit(req, {
    action: "event.update",
    entityType: "event",
    entityId: e!.id,
    dossierId: e!.dossierId,
    summary: `${EVENT_TYPE_LABELS[input.type]} « ${input.title} » ${moved ? `déplacé(e) au ${eventDate(e!.startAt)}` : "mis(e) à jour"}${input.status === "annule" ? " (annulé)" : ""}`,
  });
  const [dto] = await toEventDTOs(user, [e!]);
  res.json(dto);
});

router.delete("/events/:id", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "events.write");
  const e = await accessibleEvent(user, idParam(req));
  await db.delete(eventsTable).where(eq(eventsTable.id, e.id));
  await audit(req, {
    action: "event.delete",
    entityType: "event",
    entityId: e.id,
    dossierId: e.dossierId,
    summary: `Suppression de l'événement « ${e.title} » du ${eventDate(e.startAt)}`,
  });
  res.status(204).end();
});

/* ------------------------------------------------------------------ */
/* Tâches                                                             */
/* ------------------------------------------------------------------ */

export async function toTaskDTOs(user: AuthUser, rows: Task[]): Promise<TaskDTO[]> {
  if (!rows.length) return [];
  const refs = await loadUserRefs(user.cabinetId);
  const dossiers = await dossierSummaries(rows.map((r) => r.dossierId).filter((x): x is number => !!x));
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    dossier: t.dossierId ? (dossiers.get(t.dossierId) ?? null) : null,
    assignee: refStrict(refs, t.assigneeId),
    createdBy: ref(refs, t.createdBy),
    dueDate: t.dueDate,
    priority: t.priority as TaskDTO["priority"],
    status: t.status as TaskDTO["status"],
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));
}

router.get("/tasks", async (req, res) => {
  const user = currentUser(req);
  const ids = await visibleDossierIds(user);
  const assigneeId = queryInt(req, "assigneeId");
  const dossierId = queryInt(req, "dossierId");
  const status = queryString(req, "status");
  const search = queryString(req, "search");
  const mine = req.query.mine === "1";
  const rows = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.cabinetId, user.cabinetId),
        visibleOrNone(tasksTable.dossierId, ids),
        // Les tâches sans dossier ne sont visibles que de leurs protagonistes (sauf associés).
        can(user, "dossiers.view_all")
          ? undefined
          : or(eq(tasksTable.assigneeId, user.id), eq(tasksTable.createdBy, user.id), inArray(tasksTable.dossierId, ids.length ? ids : [0])),
        mine ? eq(tasksTable.assigneeId, user.id) : assigneeId ? eq(tasksTable.assigneeId, assigneeId) : undefined,
        dossierId ? eq(tasksTable.dossierId, dossierId) : undefined,
        status && (TASK_STATUSES as readonly string[]).includes(status) ? eq(tasksTable.status, status) : undefined,
        search ? ilike(tasksTable.title, likePattern(search)) : undefined,
      ),
    )
    .orderBy(asc(tasksTable.dueDate), desc(tasksTable.id));
  res.json(await toTaskDTOs(user, rows));
});

async function accessibleTask(user: AuthUser, id: number) {
  const [t] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.cabinetId, user.cabinetId)));
  if (!t) throw notFound("Tâche");
  if (t.dossierId) await getAccessibleDossier(user, t.dossierId);
  else if (!can(user, "dossiers.view_all") && t.assigneeId !== user.id && t.createdBy !== user.id) throw notFound("Tâche");
  return t;
}

router.post("/tasks", async (req, res) => {
  const user = currentUser(req);
  const input = parseBody(taskSchema, req);
  await assertCabinetUser(user.cabinetId, input.assigneeId, "Le responsable");
  if (input.assigneeId !== user.id && !can(user, "tasks.assign")) {
    throw forbidden("Vous pouvez créer des tâches pour vous-même uniquement.");
  }
  const dossier = input.dossierId ? await getAccessibleDossier(user, input.dossierId) : null;
  const [t] = await db
    .insert(tasksTable)
    .values({
      cabinetId: user.cabinetId,
      dossierId: dossier?.id ?? null,
      title: input.title,
      description: input.description ?? null,
      assigneeId: input.assigneeId,
      createdBy: user.id,
      dueDate: input.dueDate ?? null,
      priority: input.priority,
      status: input.status,
      completedAt: input.status === "terminee" ? new Date() : null,
    })
    .returning();
  if (dossier) {
    await grantAccessIfNeeded(req, user, dossier, input.assigneeId, `tâche « ${input.title} »`);
    await touchDossier(dossier.id);
  }
  const refs = await loadUserRefs(user.cabinetId);
  await audit(req, {
    action: "task.create",
    entityType: "task",
    entityId: t!.id,
    dossierId: dossier?.id ?? null,
    summary: `Tâche « ${input.title} » attribuée à ${refs.get(input.assigneeId)?.fullName} (priorité ${TASK_PRIORITY_LABELS[input.priority].toLowerCase()}${input.dueDate ? `, échéance ${shortDate(input.dueDate)}` : ""})`,
  });
  const [dto] = await toTaskDTOs(user, [t!]);
  res.status(201).json(dto);
});

router.patch("/tasks/:id", async (req, res) => {
  const user = currentUser(req);
  const t = await accessibleTask(user, idParam(req));
  if (t.createdBy !== user.id && !can(user, "tasks.assign")) {
    throw forbidden("Seule la personne qui a attribué la tâche peut la modifier. Vous pouvez en changer le statut.");
  }
  const input = parseBody(taskSchema, req);
  await assertCabinetUser(user.cabinetId, input.assigneeId, "Le responsable");
  if (input.assigneeId !== t.assigneeId && input.assigneeId !== user.id && !can(user, "tasks.assign")) {
    throw forbidden("Vous ne pouvez pas réattribuer cette tâche.");
  }
  const dossier = input.dossierId ? await getAccessibleDossier(user, input.dossierId) : null;
  const [updated] = await db
    .update(tasksTable)
    .set({
      dossierId: dossier?.id ?? null,
      title: input.title,
      description: input.description ?? null,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate ?? null,
      priority: input.priority,
      status: input.status,
      completedAt: input.status === "terminee" ? (t.completedAt ?? new Date()) : null,
    })
    .where(eq(tasksTable.id, t.id))
    .returning();
  if (dossier && input.assigneeId !== t.assigneeId) await grantAccessIfNeeded(req, user, dossier, input.assigneeId, `tâche « ${input.title} »`);
  await audit(req, {
    action: "task.update",
    entityType: "task",
    entityId: t.id,
    dossierId: dossier?.id ?? null,
    summary: `Tâche « ${input.title} » modifiée${input.status !== t.status ? ` (${TASK_STATUS_LABELS[input.status]})` : ""}`,
  });
  const [dto] = await toTaskDTOs(user, [updated!]);
  res.json(dto);
});

router.post("/tasks/:id/status", async (req, res) => {
  const user = currentUser(req);
  const t = await accessibleTask(user, idParam(req));
  if (t.assigneeId !== user.id && t.createdBy !== user.id && !can(user, "tasks.assign")) {
    throw forbidden("Seul le responsable de la tâche peut en changer le statut.");
  }
  const { status } = parseBody(taskStatusSchema, req);
  const [updated] = await db
    .update(tasksTable)
    .set({ status, completedAt: status === "terminee" ? new Date() : null })
    .where(eq(tasksTable.id, t.id))
    .returning();
  if (t.dossierId) await touchDossier(t.dossierId);
  await audit(req, {
    action: "task.status",
    entityType: "task",
    entityId: t.id,
    dossierId: t.dossierId,
    summary: `Tâche « ${t.title} » : ${TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS]} → ${TASK_STATUS_LABELS[status]}`,
  });
  const [dto] = await toTaskDTOs(user, [updated!]);
  res.json(dto);
});

router.delete("/tasks/:id", async (req, res) => {
  const user = currentUser(req);
  const t = await accessibleTask(user, idParam(req));
  if (t.createdBy !== user.id && !can(user, "tasks.assign")) throw forbidden("Vous ne pouvez supprimer que les tâches que vous avez créées.");
  await db.delete(tasksTable).where(eq(tasksTable.id, t.id));
  await audit(req, { action: "task.delete", entityType: "task", entityId: t.id, dossierId: t.dossierId, summary: `Suppression de la tâche « ${t.title} »` });
  res.status(204).end();
});

export default router;
