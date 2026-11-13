import type { Request } from "express";
import {
  and,
  auditLogTable,
  db,
  dossierMembersTable,
  dossiersTable,
  eq,
  inArray,
  or,
  sql,
  usersTable,
  type Dossier,
} from "@workspace/db";
import type { UserRef, Role } from "@workspace/api-zod";
import { can, type AuthUser } from "./auth";
import { forbidden, notFound } from "./http";

/**
 * Règles d'accès aux dossiers (confidentialité) :
 * - administrateur et associés : tous les dossiers du cabinet ;
 * - avocat responsable et membres de l'équipe : leurs dossiers ;
 * - collaborateurs, juristes, assistants, comptable : en plus, les dossiers
 *   de niveau « standard » ;
 * - stagiaires : uniquement les dossiers auxquels ils sont affectés.
 */
const SEES_STANDARD_DOSSIERS: Role[] = ["collaborateur", "juriste", "assistant", "comptable"];

export function dossierVisibility(user: AuthUser) {
  const sameCabinet = eq(dossiersTable.cabinetId, user.cabinetId);
  if (can(user, "dossiers.view_all")) return sameCabinet;
  const assigned = or(
    eq(dossiersTable.responsibleId, user.id),
    sql`${dossiersTable.id} in (select ${dossierMembersTable.dossierId} from ${dossierMembersTable} where ${dossierMembersTable.userId} = ${user.id})`,
  );
  const standard = SEES_STANDARD_DOSSIERS.includes(user.role)
    ? eq(dossiersTable.confidentiality, "standard")
    : undefined;
  return and(sameCabinet, standard ? or(assigned, standard) : assigned);
}

/** Identifiants des dossiers visibles (pour filtrer les entités rattachées). */
export async function visibleDossierIds(user: AuthUser): Promise<number[]> {
  const rows = await db.select({ id: dossiersTable.id }).from(dossiersTable).where(dossierVisibility(user));
  return rows.map((r) => r.id);
}

/**
 * Charge un dossier accessible ou lève 404 (on ne révèle pas l'existence
 * d'un dossier confidentiel à un utilisateur non autorisé).
 */
export async function getAccessibleDossier(user: AuthUser, id: number): Promise<Dossier> {
  const [row] = await db
    .select()
    .from(dossiersTable)
    .where(and(eq(dossiersTable.id, id), dossierVisibility(user)))
    .limit(1);
  if (!row) throw notFound("Dossier");
  return row;
}

export async function isDossierMember(userId: number, dossier: Dossier): Promise<boolean> {
  if (dossier.responsibleId === userId) return true;
  const [m] = await db
    .select()
    .from(dossierMembersTable)
    .where(and(eq(dossierMembersTable.dossierId, dossier.id), eq(dossierMembersTable.userId, userId)))
    .limit(1);
  return !!m;
}

/** Modifier la fiche d'un dossier : permission + affectation (sauf associés). */
export async function canEditDossier(user: AuthUser, dossier: Dossier): Promise<boolean> {
  if (!can(user, "dossiers.edit")) return false;
  if (can(user, "dossiers.view_all")) return true;
  return isDossierMember(user.id, dossier);
}

/** Charge un dossier accessible et exige la lecture des pièces / documents. */
export async function dossierForDocuments(user: AuthUser, dossierId: number, write: boolean): Promise<Dossier> {
  if (!can(user, write ? "documents.write" : "documents.read")) throw forbidden();
  const dossier = await getAccessibleDossier(user, dossierId);
  if (write && (dossier.status === "archive")) {
    throw forbidden("Ce dossier est archivé : il n'est plus modifiable.");
  }
  return dossier;
}

/* ------------------------------------------------------------------ */
/* Références utilisateurs pour les DTO                               */
/* ------------------------------------------------------------------ */

export type UserRefs = Map<number, UserRef>;

export async function loadUserRefs(cabinetId: number): Promise<UserRefs> {
  const rows = await db
    .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.cabinetId, cabinetId));
  return new Map(rows.map((u) => [u.id, { id: u.id, fullName: `${u.firstName} ${u.lastName}`, role: u.role as Role }]));
}

export function ref(refs: UserRefs, id: number | null | undefined): UserRef | null {
  return id == null ? null : (refs.get(id) ?? null);
}

export function refStrict(refs: UserRefs, id: number): UserRef {
  return refs.get(id) ?? { id, fullName: "Utilisateur supprimé", role: "assistant" };
}

/** Vérifie qu'un utilisateur appartient au cabinet et est actif. */
export async function assertCabinetUser(cabinetId: number, userId: number, label = "L'utilisateur"): Promise<void> {
  const [u] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.cabinetId, cabinetId), eq(usersTable.active, true)))
    .limit(1);
  if (!u) throw notFound(label);
}

export async function dossierSummaries(ids: number[]) {
  if (ids.length === 0) return new Map<number, { id: number; reference: string; title: string }>();
  const rows = await db
    .select({ id: dossiersTable.id, reference: dossiersTable.reference, title: dossiersTable.title })
    .from(dossiersTable)
    .where(inArray(dossiersTable.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r]));
}

/* ------------------------------------------------------------------ */
/* Journal d'audit                                                    */
/* ------------------------------------------------------------------ */

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: number | null;
  summary: string;
  dossierId?: number | null;
  clientId?: number | null;
  meta?: Record<string, unknown>;
}

export async function audit(req: Request, entry: AuditInput): Promise<void> {
  const user = req.user;
  if (!user) return;
  await db.insert(auditLogTable).values({
    cabinetId: user.cabinetId,
    userId: user.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    dossierId: entry.dossierId ?? null,
    clientId: entry.clientId ?? null,
    summary: entry.summary,
    meta: entry.meta ?? null,
    ip: req.ip ?? null,
  });
}

/** Marque un dossier comme mis à jour (tri « activité récente »). */
export async function touchDossier(dossierId: number): Promise<void> {
  await db.update(dossiersTable).set({ updatedAt: new Date() }).where(eq(dossiersTable.id, dossierId));
}
