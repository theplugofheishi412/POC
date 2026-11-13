import { Router, type IRouter } from "express";
import {
  and,
  asc,
  auditLogTable,
  clientsTable,
  count,
  db,
  desc,
  dossierPartiesTable,
  dossiersTable,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "@workspace/db";
import {
  ACTIVE_DOSSIER_STATUSES,
  CLIENT_STATUSES,
  CLIENT_TYPES,
  clientSchema,
  type AuditEntryDTO,
  type ClientStatus,
  type ClientType,
  type DossierStatus,
} from "@workspace/api-zod";
import { assertCan, currentUser, type AuthUser } from "../lib/auth";
import { audit, dossierVisibility, loadUserRefs, ref } from "../lib/access";
import { HttpError, idParam, likePattern, notFound, pagination, parseBody, queryString } from "../lib/http";
import { clientDisplayName, toClientDTO } from "../lib/mappers";
import { listDossiers } from "./dossiers";

const router: IRouter = Router();

async function dossierCounts(user: AuthUser, clientIds: number[]) {
  const map = new Map<number, { total: number; active: number }>();
  if (clientIds.length === 0) return map;
  const rows = await db
    .select({ clientId: dossiersTable.clientId, status: dossiersTable.status, n: count() })
    .from(dossiersTable)
    .where(and(inArray(dossiersTable.clientId, clientIds), dossierVisibility(user)))
    .groupBy(dossiersTable.clientId, dossiersTable.status);
  for (const r of rows) {
    const entry = map.get(r.clientId) ?? { total: 0, active: 0 };
    entry.total += Number(r.n);
    if (ACTIVE_DOSSIER_STATUSES.includes(r.status as DossierStatus)) entry.active += Number(r.n);
    map.set(r.clientId, entry);
  }
  return map;
}

async function getClient(user: AuthUser, id: number) {
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.cabinetId, user.cabinetId)));
  if (!client) throw notFound("Client");
  return client;
}

router.get("/clients", async (req, res) => {
  const user = currentUser(req);
  const { page, pageSize, offset } = pagination(req);
  const search = queryString(req, "search");
  const type = queryString(req, "type");
  const status = queryString(req, "status") ?? "actif";

  const conditions = [eq(clientsTable.cabinetId, user.cabinetId)];
  if (type && (CLIENT_TYPES as readonly string[]).includes(type)) conditions.push(eq(clientsTable.type, type as ClientType));
  if (status !== "tous" && (CLIENT_STATUSES as readonly string[]).includes(status)) {
    conditions.push(eq(clientsTable.status, status as ClientStatus));
  }
  if (search) {
    const p = likePattern(search);
    conditions.push(
      or(
        ilike(clientsTable.firstName, p),
        ilike(clientsTable.lastName, p),
        ilike(clientsTable.companyName, p),
        ilike(clientsTable.email, p),
        ilike(clientsTable.phone, p),
        ilike(clientsTable.city, p),
        ilike(clientsTable.idNumber, p),
        ilike(clientsTable.registrationNumber, p),
      )!,
    );
  }
  const where = and(...conditions);
  const [{ total }] = (await db.select({ total: count() }).from(clientsTable).where(where)) as [{ total: number }];
  const rows = await db
    .select()
    .from(clientsTable)
    .where(where)
    .orderBy(sql`coalesce(${clientsTable.companyName}, ${clientsTable.lastName})`, asc(clientsTable.firstName))
    .limit(pageSize)
    .offset(offset);
  const counts = await dossierCounts(user, rows.map((r) => r.id));
  res.json({ items: rows.map((c) => toClientDTO(c, counts.get(c.id))), total: Number(total), page, pageSize });
});

router.get("/clients/:id", async (req, res) => {
  const user = currentUser(req);
  const client = await getClient(user, idParam(req));
  const counts = await dossierCounts(user, [client.id]);
  res.json(toClientDTO(client, counts.get(client.id)));
});

/** Dossiers où le client est client principal ou partie. */
router.get("/clients/:id/dossiers", async (req, res) => {
  const user = currentUser(req);
  const client = await getClient(user, idParam(req));
  const asParty = await db
    .select({ dossierId: dossierPartiesTable.dossierId, role: dossierPartiesTable.role })
    .from(dossierPartiesTable)
    .where(eq(dossierPartiesTable.clientId, client.id));
  const ids = new Set(asParty.map((p) => p.dossierId));
  const items = await listDossiers(user, {
    extra: or(eq(dossiersTable.clientId, client.id), ids.size ? inArray(dossiersTable.id, [...ids]) : undefined),
  });
  const roles = new Map(asParty.map((p) => [p.dossierId, p.role]));
  res.json(items.map((d) => ({ ...d, partyRole: roles.get(d.id) ?? null, isMainClient: d.client.id === client.id })));
});

/** Historique : opérations sur la fiche + sur les dossiers visibles du client. */
router.get("/clients/:id/history", async (req, res) => {
  const user = currentUser(req);
  const client = await getClient(user, idParam(req));
  const visible = await db
    .select({ id: dossiersTable.id, reference: dossiersTable.reference })
    .from(dossiersTable)
    .where(and(eq(dossiersTable.clientId, client.id), dossierVisibility(user)));
  const refs = await loadUserRefs(user.cabinetId);
  const dossierRefs = new Map(visible.map((d) => [d.id, d.reference]));
  const rows = await db
    .select()
    .from(auditLogTable)
    .where(
      and(
        eq(auditLogTable.cabinetId, user.cabinetId),
        or(
          eq(auditLogTable.clientId, client.id),
          visible.length ? inArray(auditLogTable.dossierId, visible.map((d) => d.id)) : undefined,
        ),
      ),
    )
    .orderBy(desc(auditLogTable.createdAt))
    .limit(100);
  const items: AuditEntryDTO[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    dossier: r.dossierId && dossierRefs.has(r.dossierId) ? { id: r.dossierId, reference: dossierRefs.get(r.dossierId)! } : null,
    user: ref(refs, r.userId),
    createdAt: r.createdAt.toISOString(),
  }));
  res.json(items);
});

router.post("/clients", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "clients.write");
  const input = parseBody(clientSchema, req);
  const values = normalizeClient(input);
  const [client] = await db
    .insert(clientsTable)
    .values({ ...values, cabinetId: user.cabinetId, createdBy: user.id })
    .returning();
  await audit(req, {
    action: "client.create",
    entityType: "client",
    entityId: client!.id,
    clientId: client!.id,
    summary: `Enregistrement du client ${clientDisplayName(client!)}`,
  });
  res.status(201).json(toClientDTO(client!));
});

router.patch("/clients/:id", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "clients.write");
  const existing = await getClient(user, idParam(req));
  const input = parseBody(clientSchema, req);
  const [client] = await db
    .update(clientsTable)
    .set({ ...normalizeClient(input), updatedAt: new Date() })
    .where(eq(clientsTable.id, existing.id))
    .returning();
  await audit(req, {
    action: "client.update",
    entityType: "client",
    entityId: client!.id,
    clientId: client!.id,
    summary: `Mise à jour de la fiche de ${clientDisplayName(client!)}`,
  });
  res.json(toClientDTO(client!));
});

router.post("/clients/:id/archive", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "clients.delete");
  const client = await getClient(user, idParam(req));
  const active = await db
    .select({ id: dossiersTable.id })
    .from(dossiersTable)
    .where(and(eq(dossiersTable.clientId, client.id), inArray(dossiersTable.status, ACTIVE_DOSSIER_STATUSES)))
    .limit(1);
  if (active.length) {
    throw new HttpError(409, "Ce client a encore des dossiers actifs : clôturez-les avant d'archiver la fiche.");
  }
  const [updated] = await db
    .update(clientsTable)
    .set({ status: "archive", updatedAt: new Date() })
    .where(eq(clientsTable.id, client.id))
    .returning();
  await audit(req, {
    action: "client.archive",
    entityType: "client",
    entityId: client.id,
    clientId: client.id,
    summary: `Archivage de la fiche de ${clientDisplayName(client)}`,
  });
  res.json(toClientDTO(updated!));
});

router.post("/clients/:id/restore", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "clients.delete");
  const client = await getClient(user, idParam(req));
  const [updated] = await db
    .update(clientsTable)
    .set({ status: "actif", updatedAt: new Date() })
    .where(eq(clientsTable.id, client.id))
    .returning();
  await audit(req, {
    action: "client.restore",
    entityType: "client",
    entityId: client.id,
    clientId: client.id,
    summary: `Réactivation de la fiche de ${clientDisplayName(client)}`,
  });
  res.json(toClientDTO(updated!));
});

/**
 * Suppression définitive : uniquement pour une fiche sans aucun dossier ni
 * participation (saisie erronée). Sinon, la fiche doit être archivée afin de
 * préserver l'historique des procédures.
 */
router.delete("/clients/:id", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "clients.delete");
  const client = await getClient(user, idParam(req));
  const [linked] = await db.select({ id: dossiersTable.id }).from(dossiersTable).where(eq(dossiersTable.clientId, client.id)).limit(1);
  const [party] = await db
    .select({ id: dossierPartiesTable.id })
    .from(dossierPartiesTable)
    .where(eq(dossierPartiesTable.clientId, client.id))
    .limit(1);
  if (linked || party) {
    throw new HttpError(409, "Ce client est lié à des dossiers : la fiche ne peut pas être supprimée, archivez-la plutôt.");
  }
  await db.delete(clientsTable).where(eq(clientsTable.id, client.id));
  await audit(req, {
    action: "client.delete",
    entityType: "client",
    entityId: client.id,
    summary: `Suppression de la fiche de ${clientDisplayName(client)}`,
  });
  res.status(204).end();
});

function normalizeClient(input: ReturnType<typeof clientSchema.parse>) {
  const isPhysique = input.type === "physique";
  return {
    type: input.type,
    firstName: isPhysique ? (input.firstName ?? null) : null,
    lastName: isPhysique ? (input.lastName ?? null) : null,
    companyName: isPhysique ? null : (input.companyName ?? null),
    legalForm: isPhysique ? null : (input.legalForm ?? null),
    registrationNumber: isPhysique ? null : (input.registrationNumber ?? null),
    representativeName: isPhysique ? null : (input.representativeName ?? null),
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    idNumber: input.idNumber ?? null,
    notes: input.notes ?? null,
  };
}

export default router;
