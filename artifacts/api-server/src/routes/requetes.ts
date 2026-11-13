import { Router, type IRouter } from "express";
import {
  and,
  asc,
  cabinetsTable,
  db,
  desc,
  dossiersTable,
  eq,
  ilike,
  inArray,
  or,
  requeteVersionsTable,
  requetesTable,
  templatesTable,
  type Requete,
  type Template,
} from "@workspace/db";
import {
  REQUETE_STATUSES,
  REQUETE_STATUS_LABELS,
  requeteCreateSchema,
  requeteDecisionSchema,
  requeteUpdateSchema,
  templateSchema,
  type RequeteDTO,
  type TemplateDTO,
} from "@workspace/api-zod";
import { assertCan, can, currentUser, type AuthUser } from "../lib/auth";
import { audit, dossierForDocuments, loadUserRefs, ref, touchDossier, visibleDossierIds } from "../lib/access";
import { forbidden, HttpError, idParam, likePattern, notFound, parseBody, queryInt, queryString } from "../lib/http";
import { requetePdf } from "../lib/pdf";
import { richTextToHtml, wordDocument } from "../lib/richtext";
import { contentDisposition } from "../lib/storage";
import { AUTO_FIELDS, customFields, dossierContext, fillTemplate } from "../lib/templating";

const router: IRouter = Router();

/* ------------------------------------------------------------------ */
/* Modèles                                                            */
/* ------------------------------------------------------------------ */

async function toTemplateDTO(user: AuthUser, t: Template): Promise<TemplateDTO> {
  const refs = await loadUserRefs(user.cabinetId);
  return {
    id: t.id,
    name: t.name,
    type: t.type as TemplateDTO["type"],
    description: t.description,
    body: t.body,
    isSystem: t.isSystem,
    createdBy: ref(refs, t.createdBy),
    createdAt: t.createdAt.toISOString(),
    customFields: customFields(t.body),
  };
}

router.get("/templates/fields", (_req, res) => {
  res.json(Object.entries(AUTO_FIELDS).map(([key, label]) => ({ key, label })));
});

router.get("/templates", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "documents.read");
  const rows = await db
    .select()
    .from(templatesTable)
    .where(eq(templatesTable.cabinetId, user.cabinetId))
    .orderBy(desc(templatesTable.isSystem), asc(templatesTable.name));
  res.json(await Promise.all(rows.map((t) => toTemplateDTO(user, t))));
});

async function ownTemplate(user: AuthUser, id: number) {
  const [t] = await db
    .select()
    .from(templatesTable)
    .where(and(eq(templatesTable.id, id), eq(templatesTable.cabinetId, user.cabinetId)));
  if (!t) throw notFound("Modèle");
  return t;
}

router.post("/templates", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "templates.write");
  const input = parseBody(templateSchema, req);
  const [t] = await db
    .insert(templatesTable)
    .values({ ...input, description: input.description ?? null, cabinetId: user.cabinetId, createdBy: user.id, isSystem: false })
    .returning();
  await audit(req, { action: "template.create", entityType: "template", entityId: t!.id, summary: `Création du modèle « ${t!.name} »` });
  res.status(201).json(await toTemplateDTO(user, t!));
});

router.patch("/templates/:id", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "templates.write");
  const t = await ownTemplate(user, idParam(req));
  if (t.isSystem) throw forbidden("Les modèles fournis ne sont pas modifiables : dupliquez-les pour les adapter.");
  const input = parseBody(templateSchema, req);
  const [updated] = await db
    .update(templatesTable)
    .set({ ...input, description: input.description ?? null })
    .where(eq(templatesTable.id, t.id))
    .returning();
  await audit(req, { action: "template.update", entityType: "template", entityId: t.id, summary: `Modification du modèle « ${input.name} »` });
  res.json(await toTemplateDTO(user, updated!));
});

router.delete("/templates/:id", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "templates.write");
  const t = await ownTemplate(user, idParam(req));
  if (t.isSystem) throw forbidden("Les modèles fournis ne peuvent pas être supprimés.");
  await db.delete(templatesTable).where(eq(templatesTable.id, t.id));
  await audit(req, { action: "template.delete", entityType: "template", entityId: t.id, summary: `Suppression du modèle « ${t.name} »` });
  res.status(204).end();
});

/* ------------------------------------------------------------------ */
/* Requêtes                                                           */
/* ------------------------------------------------------------------ */

async function toRequeteDTOs(user: AuthUser, rows: Requete[], withVersions = false): Promise<RequeteDTO[]> {
  if (rows.length === 0) return [];
  const refs = await loadUserRefs(user.cabinetId);
  const dossiers = await db
    .select({ id: dossiersTable.id, reference: dossiersTable.reference, title: dossiersTable.title })
    .from(dossiersTable)
    .where(inArray(dossiersTable.id, [...new Set(rows.map((r) => r.dossierId))]));
  const dmap = new Map(dossiers.map((d) => [d.id, d]));
  const templateIds = [...new Set(rows.map((r) => r.templateId).filter((x): x is number => !!x))];
  const templates = templateIds.length
    ? await db.select({ id: templatesTable.id, name: templatesTable.name }).from(templatesTable).where(inArray(templatesTable.id, templateIds))
    : [];
  const tmap = new Map(templates.map((t) => [t.id, t.name]));
  const versions = withVersions
    ? await db
        .select()
        .from(requeteVersionsTable)
        .where(inArray(requeteVersionsTable.requeteId, rows.map((r) => r.id)))
        .orderBy(desc(requeteVersionsTable.version))
    : [];
  return rows.map((r) => ({
    id: r.id,
    dossierId: r.dossierId,
    dossierReference: dmap.get(r.dossierId)?.reference ?? "",
    dossierTitle: dmap.get(r.dossierId)?.title ?? "",
    templateId: r.templateId,
    templateName: r.templateId ? (tmap.get(r.templateId) ?? null) : null,
    type: r.type as RequeteDTO["type"],
    title: r.title,
    content: r.content,
    status: r.status as RequeteDTO["status"],
    currentVersion: r.currentVersion,
    createdBy: ref(refs, r.createdBy),
    validatedBy: ref(refs, r.validatedBy),
    validatedAt: r.validatedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    versions: withVersions
      ? versions
          .filter((v) => v.requeteId === r.id)
          .map((v) => ({
            id: v.id,
            version: v.version,
            title: v.title,
            content: v.content,
            comment: v.comment,
            createdBy: ref(refs, v.createdBy),
            createdAt: v.createdAt.toISOString(),
          }))
      : undefined,
  }));
}

async function accessibleRequete(user: AuthUser, id: number, write: boolean) {
  const [r] = await db.select().from(requetesTable).where(eq(requetesTable.id, id));
  if (!r) throw notFound("Requête");
  const dossier = await dossierForDocuments(user, r.dossierId, write);
  return { r, dossier };
}

async function single(user: AuthUser, id: number) {
  const [r] = await db.select().from(requetesTable).where(eq(requetesTable.id, id));
  const [dto] = await toRequeteDTOs(user, [r!], true);
  return dto;
}

router.get("/requetes", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "documents.read");
  const ids = await visibleDossierIds(user);
  if (!ids.length) {
    res.json([]);
    return;
  }
  const dossierId = queryInt(req, "dossierId");
  const status = queryString(req, "status");
  const search = queryString(req, "search");
  const rows = await db
    .select()
    .from(requetesTable)
    .where(
      and(
        inArray(requetesTable.dossierId, ids),
        dossierId ? eq(requetesTable.dossierId, dossierId) : undefined,
        status && (REQUETE_STATUSES as readonly string[]).includes(status) ? eq(requetesTable.status, status) : undefined,
        search ? or(ilike(requetesTable.title, likePattern(search)), ilike(requetesTable.content, likePattern(search))) : undefined,
      ),
    )
    .orderBy(desc(requetesTable.updatedAt));
  res.json(await toRequeteDTOs(user, rows));
});

router.get("/requetes/:id", async (req, res) => {
  const user = currentUser(req);
  const { r } = await accessibleRequete(user, idParam(req), false);
  const [dto] = await toRequeteDTOs(user, [r], true);
  res.json(dto);
});

router.post("/requetes", async (req, res) => {
  const user = currentUser(req);
  const input = parseBody(requeteCreateSchema, req);
  const dossier = await dossierForDocuments(user, input.dossierId, true);
  let template: Template | undefined;
  if (input.templateId) template = await ownTemplate(user, input.templateId);
  const context = await dossierContext(dossier);
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.fields)) fields[k.toLowerCase()] = v;
  const content = template
    ? fillTemplate(template.body, { ...context, ...fields })
    : `# ${input.title}\n\n> ${context["cabinet.ville"]}, le ${context["date.jour"]}\n\n`;
  const [r] = await db
    .insert(requetesTable)
    .values({
      dossierId: dossier.id,
      templateId: template?.id ?? null,
      type: template?.type ?? "autre",
      title: input.title,
      content,
      status: "brouillon",
      currentVersion: 1,
      createdBy: user.id,
    })
    .returning();
  await db.insert(requeteVersionsTable).values({
    requeteId: r!.id,
    version: 1,
    title: input.title,
    content,
    comment: template ? `Créée à partir du modèle « ${template.name} »` : "Document vierge",
    createdBy: user.id,
  });
  await touchDossier(dossier.id);
  await audit(req, {
    action: "requete.create",
    entityType: "requete",
    entityId: r!.id,
    dossierId: dossier.id,
    summary: `Préparation de « ${input.title} »${template ? ` (modèle : ${template.name})` : ""}`,
  });
  res.status(201).json(await single(user, r!.id));
});

router.patch("/requetes/:id", async (req, res) => {
  const user = currentUser(req);
  const { r, dossier } = await accessibleRequete(user, idParam(req), true);
  if (r.status === "deposee") throw new HttpError(409, "Cette requête a été déposée : elle n'est plus modifiable.");
  const input = parseBody(requeteUpdateSchema, req);
  const title = input.title ?? r.title;
  const content = input.content ?? r.content;
  if (title === r.title && content === r.content) {
    res.json(await single(user, r.id));
    return;
  }
  const version = r.currentVersion + 1;
  // Toute modification d'un acte validé invalide l'approbation de l'avocat.
  const resetValidation = r.status === "validee";
  await db
    .update(requetesTable)
    .set({
      title,
      content,
      currentVersion: version,
      updatedAt: new Date(),
      ...(resetValidation ? { status: "brouillon", validatedBy: null, validatedAt: null } : {}),
    })
    .where(eq(requetesTable.id, r.id));
  await db.insert(requeteVersionsTable).values({ requeteId: r.id, version, title, content, comment: input.comment ?? null, createdBy: user.id });
  await touchDossier(dossier.id);
  await audit(req, {
    action: "requete.update",
    entityType: "requete",
    entityId: r.id,
    dossierId: dossier.id,
    summary: `Nouvelle version (v${version}) de « ${title} »${resetValidation ? " — validation à renouveler" : ""}`,
  });
  res.json(await single(user, r.id));
});

router.post("/requetes/:id/restore/:versionId", async (req, res) => {
  const user = currentUser(req);
  const { r, dossier } = await accessibleRequete(user, idParam(req), true);
  if (r.status === "deposee") throw new HttpError(409, "Cette requête a été déposée : elle n'est plus modifiable.");
  const [v] = await db
    .select()
    .from(requeteVersionsTable)
    .where(and(eq(requeteVersionsTable.id, idParam(req, "versionId")), eq(requeteVersionsTable.requeteId, r.id)));
  if (!v) throw notFound("Version");
  const version = r.currentVersion + 1;
  await db
    .update(requetesTable)
    .set({ title: v.title, content: v.content, currentVersion: version, status: "brouillon", validatedBy: null, validatedAt: null, updatedAt: new Date() })
    .where(eq(requetesTable.id, r.id));
  await db.insert(requeteVersionsTable).values({
    requeteId: r.id,
    version,
    title: v.title,
    content: v.content,
    comment: `Restauration de la version ${v.version}`,
    createdBy: user.id,
  });
  await audit(req, {
    action: "requete.restore",
    entityType: "requete",
    entityId: r.id,
    dossierId: dossier.id,
    summary: `Restauration de la version ${v.version} de « ${v.title} »`,
  });
  res.json(await single(user, r.id));
});

/** Transitions du circuit de validation. */
type Transition = { from: string[]; to: string; permission: "documents.write" | "requetes.validate"; action: string; label: string };
const TRANSITIONS: Record<string, Transition> = {
  submit: { from: ["brouillon"], to: "a_valider", permission: "documents.write", action: "requete.submit", label: "Soumission pour validation" },
  validate: { from: ["brouillon", "a_valider"], to: "validee", permission: "requetes.validate", action: "requete.validate", label: "Validation par l'avocat" },
  reject: { from: ["a_valider", "validee"], to: "brouillon", permission: "requetes.validate", action: "requete.reject", label: "Renvoi en correction" },
  deposit: { from: ["validee"], to: "deposee", permission: "documents.write", action: "requete.deposit", label: "Marquée comme déposée" },
};

router.post("/requetes/:id/:transition", async (req, res, next) => {
  const t = TRANSITIONS[req.params.transition ?? ""];
  if (!t) {
    next();
    return;
  }
  const user = currentUser(req);
  const { r, dossier } = await accessibleRequete(user, idParam(req), true);
  if (!can(user, t.permission)) {
    throw forbidden(
      t.permission === "requetes.validate"
        ? "Seul un avocat (associé ou collaborateur) peut valider ou renvoyer un acte."
        : undefined,
    );
  }
  if (!t.from.includes(r.status)) {
    throw new HttpError(
      409,
      `Action impossible : la requête est « ${REQUETE_STATUS_LABELS[r.status as keyof typeof REQUETE_STATUS_LABELS]} ».`,
    );
  }
  const { comment } = parseBody(requeteDecisionSchema, req);
  await db
    .update(requetesTable)
    .set({
      status: t.to,
      updatedAt: new Date(),
      ...(t.to === "validee" ? { validatedBy: user.id, validatedAt: new Date() } : {}),
      ...(t.to === "brouillon" ? { validatedBy: null, validatedAt: null } : {}),
    })
    .where(eq(requetesTable.id, r.id));
  await touchDossier(dossier.id);
  await audit(req, {
    action: t.action,
    entityType: "requete",
    entityId: r.id,
    dossierId: dossier.id,
    summary: `${t.label} : « ${r.title} »${comment ? ` — ${comment}` : ""}`,
  });
  res.json(await single(user, r.id));
});

router.delete("/requetes/:id", async (req, res) => {
  const user = currentUser(req);
  const { r, dossier } = await accessibleRequete(user, idParam(req), true);
  if (r.status !== "brouillon" && !can(user, "requetes.validate")) {
    throw forbidden("Seul un avocat peut supprimer une requête soumise ou validée.");
  }
  await db.delete(requetesTable).where(eq(requetesTable.id, r.id));
  await audit(req, {
    action: "requete.delete",
    entityType: "requete",
    entityId: r.id,
    dossierId: dossier.id,
    summary: `Suppression de « ${r.title} »`,
  });
  res.status(204).end();
});

async function exportContext(user: AuthUser, id: number) {
  const { r, dossier } = await accessibleRequete(user, id, false);
  const [cabinet] = await db.select().from(cabinetsTable).where(eq(cabinetsTable.id, dossier.cabinetId));
  const refs = await loadUserRefs(user.cabinetId);
  return { r, dossier, cabinet: cabinet!, validatedBy: ref(refs, r.validatedBy)?.fullName ?? null };
}

const safeName = (s: string) => s.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 80) || "document";

router.get("/requetes/:id/pdf", async (req, res) => {
  const user = currentUser(req);
  const { r, dossier, cabinet, validatedBy } = await exportContext(user, idParam(req));
  const pdf = await requetePdf({
    cabinet,
    title: r.title,
    content: r.content,
    dossierReference: dossier.reference,
    version: r.currentVersion,
    status: r.status as RequeteDTO["status"],
    validatedBy,
    validatedAt: r.validatedAt,
  });
  const download = req.query.download === "1";
  await audit(req, {
    action: "requete.export",
    entityType: "requete",
    entityId: r.id,
    dossierId: dossier.id,
    summary: `${download ? "Export PDF" : "Aperçu PDF"} de « ${r.title} » (v${r.currentVersion})`,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", contentDisposition(download ? "attachment" : "inline", `${safeName(r.title)}-v${r.currentVersion}.pdf`));
  res.setHeader("Cache-Control", "private, no-store");
  res.send(pdf);
});

router.get("/requetes/:id/word", async (req, res) => {
  const user = currentUser(req);
  const { r, dossier, cabinet, validatedBy } = await exportContext(user, idParam(req));
  const validated = r.status === "validee" || r.status === "deposee";
  const html = wordDocument({
    title: r.title,
    cabinetName: cabinet.name,
    body: richTextToHtml(r.content),
    notice: validated
      ? `Contenu validé par ${validatedBy ?? "un avocat"} — modèle issu du POC TechSolution (réf. ${dossier.reference}, v${r.currentVersion}).`
      : `PROJET À VALIDER PAR UN AVOCAT — modèle de démonstration (réf. ${dossier.reference}, v${r.currentVersion}).`,
  });
  await audit(req, {
    action: "requete.export",
    entityType: "requete",
    entityId: r.id,
    dossierId: dossier.id,
    summary: `Export Word de « ${r.title} » (v${r.currentVersion})`,
  });
  res.setHeader("Content-Type", "application/msword; charset=utf-8");
  res.setHeader("Content-Disposition", contentDisposition("attachment", `${safeName(r.title)}-v${r.currentVersion}.doc`));
  res.setHeader("Cache-Control", "private, no-store");
  res.send(`﻿${html}`);
});

export default router;
