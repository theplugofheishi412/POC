import { Router, type IRouter } from "express";
import {
  and,
  asc,
  auditLogTable,
  bordereauxTable,
  clientsTable,
  count,
  db,
  demarchesTable,
  desc,
  documentsTable,
  dossierMembersTable,
  dossierPartiesTable,
  dossiersTable,
  eq,
  eventsTable,
  gte,
  ilike,
  inArray,
  invoicesTable,
  or,
  piecesTable,
  requetesTable,
  sql,
  tasksTable,
  type Dossier,
} from "@workspace/db";
import {
  CONFIDENTIALITY_LEVELS,
  DOSSIER_CATEGORIES,
  DOSSIER_CATEGORY_LABELS,
  DOSSIER_STATUSES,
  DOSSIER_STATUS_LABELS,
  dossierSchema,
  dossierStatusSchema,
  PARTY_ROLE_LABELS,
  partySchema,
  type AuditEntryDTO,
  type DossierDTO,
  type DossierListItemDTO,
  type PartyDTO,
} from "@workspace/api-zod";
import { assertCan, can, currentUser, type AuthUser } from "../lib/auth";
import {
  assertCabinetUser,
  audit,
  canEditDossier,
  dossierVisibility,
  getAccessibleDossier,
  loadUserRefs,
  ref,
  refStrict,
  touchDossier,
} from "../lib/access";
import { forbidden, HttpError, idParam, likePattern, notFound, pagination, parseBody, queryInt, queryString, today } from "../lib/http";
import { clientDisplayName } from "../lib/mappers";

const router: IRouter = Router();

/* ------------------------------------------------------------------ */
/* Lecture                                                            */
/* ------------------------------------------------------------------ */

type SQLCondition = ReturnType<typeof and>;

/** Liste des dossiers visibles, enrichis (client, responsable, audience). */
export async function listDossiers(
  user: AuthUser,
  opts: { extra?: SQLCondition; limit?: number; offset?: number; order?: "recent" | "reference" } = {},
): Promise<DossierListItemDTO[]> {
  const rows = await db
    .select({ d: dossiersTable, client: clientsTable })
    .from(dossiersTable)
    .innerJoin(clientsTable, eq(clientsTable.id, dossiersTable.clientId))
    .where(and(dossierVisibility(user), opts.extra))
    .orderBy(opts.order === "reference" ? asc(dossiersTable.reference) : desc(dossiersTable.updatedAt))
    .limit(opts.limit ?? 500)
    .offset(opts.offset ?? 0);
  const refs = await loadUserRefs(user.cabinetId);
  const ids = rows.map((r) => r.d.id);
  const hearings = ids.length
    ? await db
        .select({ dossierId: eventsTable.dossierId, next: sql<string>`min(${eventsTable.startAt})` })
        .from(eventsTable)
        .where(
          and(
            inArray(eventsTable.dossierId, ids),
            eq(eventsTable.type, "audience"),
            eq(eventsTable.status, "prevu"),
            gte(eventsTable.startAt, new Date()),
          ),
        )
        .groupBy(eventsTable.dossierId)
    : [];
  const nextHearing = new Map(hearings.map((h) => [h.dossierId, h.next]));
  return rows.map(({ d, client }) => ({
    id: d.id,
    reference: d.reference,
    title: d.title,
    category: d.category as DossierListItemDTO["category"],
    procedureType: d.procedureType,
    jurisdiction: d.jurisdiction,
    status: d.status as DossierListItemDTO["status"],
    confidentiality: d.confidentiality as DossierListItemDTO["confidentiality"],
    openedAt: d.openedAt,
    client: { id: client.id, displayName: clientDisplayName(client) },
    responsible: refStrict(refs, d.responsibleId),
    nextHearing: nextHearing.get(d.id) ? new Date(nextHearing.get(d.id)!).toISOString() : null,
    updatedAt: d.updatedAt.toISOString(),
  }));
}

router.get("/dossiers", async (req, res) => {
  const user = currentUser(req);
  const { page, pageSize, offset } = pagination(req);
  const conditions: SQLCondition[] = [];
  const search = queryString(req, "search");
  const status = queryString(req, "status");
  const category = queryString(req, "category");
  const responsibleId = queryInt(req, "responsibleId");
  const confidentiality = queryString(req, "confidentiality");
  const scope = queryString(req, "scope"); // "actifs" | "mes" | undefined

  if (search) {
    const p = likePattern(search);
    conditions.push(
      or(
        ilike(dossiersTable.reference, p),
        ilike(dossiersTable.title, p),
        ilike(dossiersTable.procedureType, p),
        ilike(dossiersTable.jurisdiction, p),
        ilike(dossiersTable.roleNumber, p),
        ilike(clientsTable.companyName, p),
        ilike(clientsTable.lastName, p),
        ilike(clientsTable.firstName, p),
        sql`${dossiersTable.id} in (select ${dossierPartiesTable.dossierId} from ${dossierPartiesTable} where ${dossierPartiesTable.name} ilike ${p})`,
      ),
    );
  }
  if (status && (DOSSIER_STATUSES as readonly string[]).includes(status)) conditions.push(eq(dossiersTable.status, status));
  if (scope === "actifs") conditions.push(sql`${dossiersTable.status} not in ('cloture', 'archive')`);
  if (category && (DOSSIER_CATEGORIES as readonly string[]).includes(category)) conditions.push(eq(dossiersTable.category, category));
  if (confidentiality && (CONFIDENTIALITY_LEVELS as readonly string[]).includes(confidentiality)) {
    conditions.push(eq(dossiersTable.confidentiality, confidentiality));
  }
  if (responsibleId) conditions.push(eq(dossiersTable.responsibleId, responsibleId));
  if (scope === "mes") {
    conditions.push(
      or(
        eq(dossiersTable.responsibleId, user.id),
        sql`${dossiersTable.id} in (select ${dossierMembersTable.dossierId} from ${dossierMembersTable} where ${dossierMembersTable.userId} = ${user.id})`,
      ),
    );
  }

  const where = and(dossierVisibility(user), ...conditions);
  const [{ total }] = (await db
    .select({ total: count() })
    .from(dossiersTable)
    .innerJoin(clientsTable, eq(clientsTable.id, dossiersTable.clientId))
    .where(where)) as [{ total: number }];
  const items = await listDossiers(user, { extra: and(...conditions), limit: pageSize, offset });
  res.json({ items, total: Number(total), page, pageSize });
});

/** Liste compacte pour les listes déroulantes. */
router.get("/dossiers/options", async (req, res) => {
  const user = currentUser(req);
  const rows = await db
    .select({ id: dossiersTable.id, reference: dossiersTable.reference, title: dossiersTable.title, status: dossiersTable.status })
    .from(dossiersTable)
    .where(dossierVisibility(user))
    .orderBy(desc(dossiersTable.reference));
  res.json(rows);
});

async function dossierDetail(user: AuthUser, d: Dossier): Promise<DossierDTO> {
  const [base] = await listDossiers(user, { extra: eq(dossiersTable.id, d.id) });
  const refs = await loadUserRefs(user.cabinetId);
  const members = await db.select().from(dossierMembersTable).where(eq(dossierMembersTable.dossierId, d.id));
  const parties = await db
    .select()
    .from(dossierPartiesTable)
    .where(eq(dossierPartiesTable.dossierId, d.id))
    .orderBy(asc(dossierPartiesTable.id));
  const countOf = async (table: typeof documentsTable | typeof piecesTable | typeof bordereauxTable | typeof requetesTable | typeof demarchesTable | typeof eventsTable | typeof tasksTable | typeof invoicesTable) => {
    const [r] = (await db.select({ n: count() }).from(table).where(eq(table.dossierId, d.id))) as [{ n: number }];
    return Number(r.n);
  };
  return {
    ...base!,
    description: d.description,
    roleNumber: d.roleNumber,
    closedAt: d.closedAt,
    createdAt: d.createdAt.toISOString(),
    members: members.map((m) => refStrict(refs, m.userId)),
    parties: parties.map(toPartyDTO),
    counts: {
      documents: can(user, "documents.read") ? await countOf(documentsTable) : 0,
      pieces: can(user, "documents.read") ? await countOf(piecesTable) : 0,
      bordereaux: can(user, "documents.read") ? await countOf(bordereauxTable) : 0,
      requetes: can(user, "documents.read") ? await countOf(requetesTable) : 0,
      demarches: await countOf(demarchesTable),
      events: await countOf(eventsTable),
      tasks: await countOf(tasksTable),
      invoices: can(user, "billing.read") ? await countOf(invoicesTable) : 0,
    },
    canEdit: await canEditDossier(user, d),
  };
}

function toPartyDTO(p: typeof dossierPartiesTable.$inferSelect): PartyDTO {
  return {
    id: p.id,
    clientId: p.clientId,
    name: p.name,
    role: p.role as PartyDTO["role"],
    counsel: p.counsel,
    notes: p.notes,
  };
}

router.get("/dossiers/:id", async (req, res) => {
  const user = currentUser(req);
  const d = await getAccessibleDossier(user, idParam(req));
  res.json(await dossierDetail(user, d));
});

router.get("/dossiers/:id/history", async (req, res) => {
  const user = currentUser(req);
  const d = await getAccessibleDossier(user, idParam(req));
  const refs = await loadUserRefs(user.cabinetId);
  const rows = await db
    .select()
    .from(auditLogTable)
    .where(eq(auditLogTable.dossierId, d.id))
    .orderBy(desc(auditLogTable.createdAt), desc(auditLogTable.id))
    .limit(200);
  const items: AuditEntryDTO[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    dossier: { id: d.id, reference: d.reference },
    user: ref(refs, r.userId),
    createdAt: r.createdAt.toISOString(),
  }));
  res.json(items);
});

/* ------------------------------------------------------------------ */
/* Écriture                                                           */
/* ------------------------------------------------------------------ */

async function nextReference(cabinetId: number, openedAt: string): Promise<string> {
  const year = openedAt.slice(0, 4);
  const [row] = await db
    .select({ max: sql<string | null>`max(${dossiersTable.reference})` })
    .from(dossiersTable)
    .where(and(eq(dossiersTable.cabinetId, cabinetId), ilike(dossiersTable.reference, `DOS-${year}-%`)));
  const last = row?.max ? Number(row.max.split("-")[2]) : 0;
  return `DOS-${year}-${String(last + 1).padStart(3, "0")}`;
}

async function assertClient(cabinetId: number, clientId: number) {
  const [c] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, clientId), eq(clientsTable.cabinetId, cabinetId)));
  if (!c) throw notFound("Client");
  if (c.status === "archive") throw new HttpError(409, "Ce client est archivé : réactivez sa fiche avant d'ouvrir un dossier.");
  return c;
}

async function setMembers(dossierId: number, responsibleId: number, memberIds: number[]) {
  await db.delete(dossierMembersTable).where(eq(dossierMembersTable.dossierId, dossierId));
  const unique = [...new Set(memberIds)].filter((id) => id !== responsibleId);
  if (unique.length) await db.insert(dossierMembersTable).values(unique.map((userId) => ({ dossierId, userId })));
}

router.post("/dossiers", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "dossiers.create");
  const input = parseBody(dossierSchema, req);
  const client = await assertClient(user.cabinetId, input.clientId);
  await assertCabinetUser(user.cabinetId, input.responsibleId, "L'avocat responsable");
  for (const m of input.memberIds) await assertCabinetUser(user.cabinetId, m, "Le collaborateur");
  // Sans droit d'affectation, on ne peut ouvrir un dossier qu'à son nom.
  if (!can(user, "dossiers.assign") && input.responsibleId !== user.id) {
    throw forbidden("Seul un associé peut confier un nouveau dossier à un autre avocat.");
  }

  const reference = await nextReference(user.cabinetId, input.openedAt);
  const [d] = await db
    .insert(dossiersTable)
    .values({
      cabinetId: user.cabinetId,
      reference,
      title: input.title,
      clientId: input.clientId,
      category: input.category,
      procedureType: input.procedureType,
      jurisdiction: input.jurisdiction ?? null,
      responsibleId: input.responsibleId,
      status: input.status,
      confidentiality: input.confidentiality,
      openedAt: input.openedAt,
      roleNumber: input.roleNumber ?? null,
      description: input.description ?? null,
    })
    .returning();
  await setMembers(d!.id, input.responsibleId, input.memberIds);
  // Le client principal est automatiquement partie au dossier.
  await db.insert(dossierPartiesTable).values({
    dossierId: d!.id,
    clientId: client.id,
    name: clientDisplayName(client),
    role: "demandeur",
  });
  await audit(req, {
    action: "dossier.create",
    entityType: "dossier",
    entityId: d!.id,
    dossierId: d!.id,
    clientId: client.id,
    summary: `Ouverture du dossier ${reference} — ${input.title} (${DOSSIER_CATEGORY_LABELS[input.category]})`,
  });
  res.status(201).json(await dossierDetail(user, d!));
});

router.patch("/dossiers/:id", async (req, res) => {
  const user = currentUser(req);
  const d = await getAccessibleDossier(user, idParam(req));
  if (!(await canEditDossier(user, d))) throw forbidden("Vous n'êtes pas autorisé à modifier ce dossier.");
  const input = parseBody(dossierSchema, req);
  const reassign = input.responsibleId !== d.responsibleId;
  const currentMembers = (await db.select().from(dossierMembersTable).where(eq(dossierMembersTable.dossierId, d.id)))
    .map((m) => m.userId)
    .sort();
  const membersChanged = JSON.stringify(currentMembers) !== JSON.stringify([...new Set(input.memberIds)].filter((m) => m !== input.responsibleId).sort());
  if ((reassign || membersChanged) && !can(user, "dossiers.assign")) {
    throw forbidden("Seul un associé peut modifier l'avocat responsable ou l'équipe du dossier.");
  }
  if (input.clientId !== d.clientId) await assertClient(user.cabinetId, input.clientId);
  await assertCabinetUser(user.cabinetId, input.responsibleId, "L'avocat responsable");
  for (const m of input.memberIds) await assertCabinetUser(user.cabinetId, m, "Le collaborateur");

  const closing = (input.status === "cloture" || input.status === "archive") && !d.closedAt;
  const [updated] = await db
    .update(dossiersTable)
    .set({
      title: input.title,
      clientId: input.clientId,
      category: input.category,
      procedureType: input.procedureType,
      jurisdiction: input.jurisdiction ?? null,
      responsibleId: input.responsibleId,
      status: input.status,
      confidentiality: input.confidentiality,
      openedAt: input.openedAt,
      roleNumber: input.roleNumber ?? null,
      description: input.description ?? null,
      closedAt: closing ? today() : input.status === "cloture" || input.status === "archive" ? d.closedAt : null,
      updatedAt: new Date(),
    })
    .where(eq(dossiersTable.id, d.id))
    .returning();
  await setMembers(d.id, input.responsibleId, input.memberIds);

  const refs = await loadUserRefs(user.cabinetId);
  const notes: string[] = [];
  if (input.status !== d.status) notes.push(`statut : ${DOSSIER_STATUS_LABELS[input.status]}`);
  if (reassign) notes.push(`affecté à ${refs.get(input.responsibleId)?.fullName}`);
  if (membersChanged) notes.push("équipe modifiée");
  if (input.confidentiality !== d.confidentiality) notes.push(`confidentialité : ${input.confidentiality}`);
  await audit(req, {
    action: reassign ? "dossier.assign" : "dossier.update",
    entityType: "dossier",
    entityId: d.id,
    dossierId: d.id,
    clientId: updated!.clientId,
    summary: `Mise à jour du dossier ${d.reference}${notes.length ? ` (${notes.join(", ")})` : ""}`,
  });
  res.json(await dossierDetail(user, updated!));
});

router.post("/dossiers/:id/status", async (req, res) => {
  const user = currentUser(req);
  const d = await getAccessibleDossier(user, idParam(req));
  if (!(await canEditDossier(user, d))) throw forbidden("Vous n'êtes pas autorisé à modifier ce dossier.");
  const { status, comment } = parseBody(dossierStatusSchema, req);
  const closing = status === "cloture" || status === "archive";
  const [updated] = await db
    .update(dossiersTable)
    .set({ status, closedAt: closing ? (d.closedAt ?? today()) : null, updatedAt: new Date() })
    .where(eq(dossiersTable.id, d.id))
    .returning();
  await audit(req, {
    action: "dossier.status",
    entityType: "dossier",
    entityId: d.id,
    dossierId: d.id,
    summary: `Statut du dossier : ${DOSSIER_STATUS_LABELS[d.status as keyof typeof DOSSIER_STATUS_LABELS]} → ${DOSSIER_STATUS_LABELS[status]}${comment ? ` — ${comment}` : ""}`,
  });
  res.json(await dossierDetail(user, updated!));
});

router.delete("/dossiers/:id", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "dossiers.delete");
  const d = await getAccessibleDossier(user, idParam(req));
  const [inv] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.dossierId, d.id)).limit(1);
  if (inv) throw new HttpError(409, "Ce dossier comporte des factures : archivez-le au lieu de le supprimer.");
  await db.delete(dossiersTable).where(eq(dossiersTable.id, d.id));
  await audit(req, {
    action: "dossier.delete",
    entityType: "dossier",
    entityId: d.id,
    clientId: d.clientId,
    summary: `Suppression du dossier ${d.reference} — ${d.title}`,
  });
  res.status(204).end();
});

/* ------------------------------------------------------------------ */
/* Parties                                                            */
/* ------------------------------------------------------------------ */

async function editableDossier(user: AuthUser, id: number) {
  const d = await getAccessibleDossier(user, id);
  if (!(await canEditDossier(user, d))) throw forbidden("Vous n'êtes pas autorisé à modifier ce dossier.");
  return d;
}

async function partyName(cabinetId: number, input: ReturnType<typeof partySchema.parse>) {
  if (!input.clientId) return input.name!;
  const [c] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, input.clientId), eq(clientsTable.cabinetId, cabinetId)));
  if (!c) throw notFound("Client");
  return clientDisplayName(c);
}

router.post("/dossiers/:id/parties", async (req, res) => {
  const user = currentUser(req);
  const d = await editableDossier(user, idParam(req));
  const input = parseBody(partySchema, req);
  const name = await partyName(user.cabinetId, input);
  const [p] = await db
    .insert(dossierPartiesTable)
    .values({ dossierId: d.id, clientId: input.clientId ?? null, name, role: input.role, counsel: input.counsel ?? null, notes: input.notes ?? null })
    .returning();
  await touchDossier(d.id);
  await audit(req, {
    action: "party.add",
    entityType: "party",
    entityId: p!.id,
    dossierId: d.id,
    clientId: input.clientId ?? null,
    summary: `Ajout de la partie ${name} (${PARTY_ROLE_LABELS[input.role]})`,
  });
  res.status(201).json(toPartyDTO(p!));
});

router.patch("/dossiers/:id/parties/:partyId", async (req, res) => {
  const user = currentUser(req);
  const d = await editableDossier(user, idParam(req));
  const partyId = idParam(req, "partyId");
  const input = parseBody(partySchema, req);
  const name = await partyName(user.cabinetId, input);
  const [p] = await db
    .update(dossierPartiesTable)
    .set({ clientId: input.clientId ?? null, name, role: input.role, counsel: input.counsel ?? null, notes: input.notes ?? null })
    .where(and(eq(dossierPartiesTable.id, partyId), eq(dossierPartiesTable.dossierId, d.id)))
    .returning();
  if (!p) throw notFound("Partie");
  await touchDossier(d.id);
  await audit(req, {
    action: "party.update",
    entityType: "party",
    entityId: p.id,
    dossierId: d.id,
    summary: `Modification de la partie ${name} (${PARTY_ROLE_LABELS[input.role]})`,
  });
  res.json(toPartyDTO(p));
});

router.delete("/dossiers/:id/parties/:partyId", async (req, res) => {
  const user = currentUser(req);
  const d = await editableDossier(user, idParam(req));
  const partyId = idParam(req, "partyId");
  const [p] = await db
    .select()
    .from(dossierPartiesTable)
    .where(and(eq(dossierPartiesTable.id, partyId), eq(dossierPartiesTable.dossierId, d.id)));
  if (!p) throw notFound("Partie");
  if (p.clientId === d.clientId) throw new HttpError(409, "Le client principal ne peut pas être retiré des parties.");
  await db.delete(dossierPartiesTable).where(eq(dossierPartiesTable.id, p.id));
  await touchDossier(d.id);
  await audit(req, {
    action: "party.remove",
    entityType: "party",
    entityId: p.id,
    dossierId: d.id,
    summary: `Retrait de la partie ${p.name}`,
  });
  res.status(204).end();
});

export default router;
