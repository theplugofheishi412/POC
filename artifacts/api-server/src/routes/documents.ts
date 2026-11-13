import express, { Router, type IRouter } from "express";
import fs from "node:fs";
import {
  and,
  asc,
  bordereauItemsTable,
  bordereauxTable,
  cabinetsTable,
  clientsTable,
  count,
  db,
  demarchesTable,
  desc,
  documentsTable,
  dossierPartiesTable,
  dossiersTable,
  eq,
  ilike,
  inArray,
  piecesTable,
  sql,
  usersTable,
  type Bordereau,
  type DocumentRow,
} from "@workspace/db";
import {
  bordereauSchema,
  bordereauUpdateSchema,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  documentMetaSchema,
  PARTY_ROLE_LABELS,
  pieceSchema,
  reorderSchema,
  type BordereauDTO,
  type DocumentDTO,
  type PartyRole,
  type PieceDTO,
} from "@workspace/api-zod";
import { assertCan, can, currentUser, type AuthUser } from "../lib/auth";
import { audit, dossierForDocuments, loadUserRefs, ref, touchDossier, visibleDossierIds } from "../lib/access";
import { badRequest, forbidden, HttpError, idParam, likePattern, notFound, parseBody, queryInt, queryString } from "../lib/http";
import { clientDisplayName } from "../lib/mappers";
import { bordereauPdf } from "../lib/pdf";
import { contentDisposition, deleteFile, detectFileType, filePath, MAX_UPLOAD_BYTES, sanitizeFileName, saveFile } from "../lib/storage";

const router: IRouter = Router();

/* ------------------------------------------------------------------ */
/* Documents (fichiers)                                               */
/* ------------------------------------------------------------------ */

async function toDocumentDTOs(user: AuthUser, rows: DocumentRow[]): Promise<DocumentDTO[]> {
  const refs = await loadUserRefs(user.cabinetId);
  const dossierIds = [...new Set(rows.map((r) => r.dossierId))];
  const dossiers = dossierIds.length
    ? await db.select({ id: dossiersTable.id, reference: dossiersTable.reference }).from(dossiersTable).where(inArray(dossiersTable.id, dossierIds))
    : [];
  const refOf = new Map(dossiers.map((d) => [d.id, d.reference]));
  return rows.map((r) => ({
    id: r.id,
    dossierId: r.dossierId,
    dossierReference: refOf.get(r.dossierId) ?? "",
    demarcheId: r.demarcheId,
    name: r.name,
    category: r.category as DocumentDTO["category"],
    description: r.description,
    originalName: r.originalName,
    mimeType: r.mimeType,
    size: r.size,
    uploadedBy: ref(refs, r.uploadedBy),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Charge un document après contrôle des droits sur son dossier. */
async function accessibleDocument(user: AuthUser, id: number, write: boolean) {
  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, id));
  if (!doc) throw notFound("Document");
  const dossier = await dossierForDocuments(user, doc.dossierId, write);
  return { doc, dossier };
}

router.get("/documents", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "documents.read");
  const ids = await visibleDossierIds(user);
  if (ids.length === 0) {
    res.json([]);
    return;
  }
  const search = queryString(req, "search");
  const category = queryString(req, "category");
  const dossierId = queryInt(req, "dossierId");
  const rows = await db
    .select()
    .from(documentsTable)
    .where(
      and(
        inArray(documentsTable.dossierId, ids),
        dossierId ? eq(documentsTable.dossierId, dossierId) : undefined,
        category && (DOCUMENT_CATEGORIES as readonly string[]).includes(category) ? eq(documentsTable.category, category) : undefined,
        search ? ilike(documentsTable.name, likePattern(search)) : undefined,
      ),
    )
    .orderBy(desc(documentsTable.createdAt))
    .limit(300);
  res.json(await toDocumentDTOs(user, rows));
});

router.get("/dossiers/:id/documents", async (req, res) => {
  const user = currentUser(req);
  const dossier = await dossierForDocuments(user, idParam(req), false);
  const rows = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.dossierId, dossier.id))
    .orderBy(desc(documentsTable.createdAt));
  res.json(await toDocumentDTOs(user, rows));
});

/**
 * Téléversement : le corps de la requête est le fichier brut ; les
 * métadonnées passent en paramètres d'URL. Le type est déterminé par la
 * signature binaire du fichier.
 */
router.post(
  "/dossiers/:id/documents",
  express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
  async (req, res) => {
    const user = currentUser(req);
    const dossier = await dossierForDocuments(user, idParam(req), true);
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer)) throw badRequest("Aucun fichier reçu.");
    const { mime, ext } = detectFileType(buffer);
    const originalName = sanitizeFileName(queryString(req, "filename"), ext);
    const meta = documentMetaSchema.parse({
      name: queryString(req, "name") ?? originalName.replace(/\.[^.]+$/, ""),
      category: queryString(req, "category") ?? "piece",
      description: queryString(req, "description"),
      demarcheId: queryString(req, "demarcheId"),
    });
    if (meta.demarcheId) {
      const [dm] = await db
        .select()
        .from(demarchesTable)
        .where(and(eq(demarchesTable.id, meta.demarcheId), eq(demarchesTable.dossierId, dossier.id)));
      if (!dm) throw notFound("Démarche");
    }
    const { storageKey, sha256 } = saveFile(buffer, ext);
    const [doc] = await db
      .insert(documentsTable)
      .values({
        dossierId: dossier.id,
        demarcheId: meta.demarcheId ?? null,
        name: meta.name,
        category: meta.category,
        description: meta.description ?? null,
        originalName,
        mimeType: mime,
        size: buffer.length,
        storageKey,
        sha256,
        uploadedBy: user.id,
      })
      .returning();
    await touchDossier(dossier.id);
    await audit(req, {
      action: "document.upload",
      entityType: "document",
      entityId: doc!.id,
      dossierId: dossier.id,
      summary: `Ajout du document « ${meta.name} » (${DOCUMENT_CATEGORY_LABELS[meta.category]}, ${Math.ceil(buffer.length / 1024)} Ko)`,
    });
    const [dto] = await toDocumentDTOs(user, [doc!]);
    res.status(201).json(dto);
  },
);

router.get("/documents/:id/file", async (req, res) => {
  const user = currentUser(req);
  const { doc, dossier } = await accessibleDocument(user, idParam(req), false);
  const path = filePath(doc.storageKey);
  if (!fs.existsSync(path)) throw notFound("Fichier");
  const download = req.query.download === "1";
  if (download || dossier.confidentiality !== "standard") {
    await audit(req, {
      action: download ? "document.download" : "document.view",
      entityType: "document",
      entityId: doc.id,
      dossierId: dossier.id,
      summary: `${download ? "Téléchargement" : "Consultation"} du document « ${doc.name} »`,
    });
  }
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", contentDisposition(download ? "attachment" : "inline", doc.originalName));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  fs.createReadStream(path).pipe(res);
});

router.patch("/documents/:id", async (req, res) => {
  const user = currentUser(req);
  const { doc, dossier } = await accessibleDocument(user, idParam(req), true);
  const meta = parseBody(documentMetaSchema, req);
  const [updated] = await db
    .update(documentsTable)
    .set({ name: meta.name, category: meta.category, description: meta.description ?? null, demarcheId: meta.demarcheId ?? doc.demarcheId })
    .where(eq(documentsTable.id, doc.id))
    .returning();
  await audit(req, {
    action: "document.update",
    entityType: "document",
    entityId: doc.id,
    dossierId: dossier.id,
    summary: `Modification du document « ${meta.name} »`,
  });
  const [dto] = await toDocumentDTOs(user, [updated!]);
  res.json(dto);
});

router.delete("/documents/:id", async (req, res) => {
  const user = currentUser(req);
  const { doc, dossier } = await accessibleDocument(user, idParam(req), true);
  await db.delete(documentsTable).where(eq(documentsTable.id, doc.id));
  deleteFile(doc.storageKey);
  await audit(req, {
    action: "document.delete",
    entityType: "document",
    entityId: doc.id,
    dossierId: dossier.id,
    summary: `Suppression du document « ${doc.name} »`,
  });
  res.status(204).end();
});

/* ------------------------------------------------------------------ */
/* Pièces du dossier                                                  */
/* ------------------------------------------------------------------ */

async function listPieces(dossierId: number): Promise<PieceDTO[]> {
  const rows = await db
    .select({ p: piecesTable, doc: { id: documentsTable.id, name: documentsTable.name, mimeType: documentsTable.mimeType } })
    .from(piecesTable)
    .leftJoin(documentsTable, eq(documentsTable.id, piecesTable.documentId))
    .where(eq(piecesTable.dossierId, dossierId))
    .orderBy(asc(piecesTable.position));
  return rows.map(({ p, doc }) => ({
    id: p.id,
    dossierId: p.dossierId,
    position: p.position,
    designation: p.designation,
    pages: p.pages,
    pieceDate: p.pieceDate,
    observations: p.observations,
    document: doc?.id ? doc : null,
  }));
}

async function renumber(dossierId: number, orderedIds?: number[]) {
  const ids =
    orderedIds ??
    (await db.select({ id: piecesTable.id }).from(piecesTable).where(eq(piecesTable.dossierId, dossierId)).orderBy(asc(piecesTable.position), asc(piecesTable.id))).map(
      (r) => r.id,
    );
  for (const [i, id] of ids.entries()) {
    await db.update(piecesTable).set({ position: i + 1 }).where(and(eq(piecesTable.id, id), eq(piecesTable.dossierId, dossierId)));
  }
}

async function assertDocumentInDossier(documentId: number | null | undefined, dossierId: number) {
  if (!documentId) return;
  const [doc] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, documentId), eq(documentsTable.dossierId, dossierId)));
  if (!doc) throw badRequest("Le document joint doit appartenir au même dossier.");
}

router.get("/dossiers/:id/pieces", async (req, res) => {
  const user = currentUser(req);
  const dossier = await dossierForDocuments(user, idParam(req), false);
  res.json(await listPieces(dossier.id));
});

router.post("/dossiers/:id/pieces", async (req, res) => {
  const user = currentUser(req);
  const dossier = await dossierForDocuments(user, idParam(req), true);
  const input = parseBody(pieceSchema, req);
  await assertDocumentInDossier(input.documentId, dossier.id);
  const [{ n }] = (await db.select({ n: count() }).from(piecesTable).where(eq(piecesTable.dossierId, dossier.id))) as [{ n: number }];
  const [piece] = await db
    .insert(piecesTable)
    .values({
      dossierId: dossier.id,
      position: Number(n) + 1,
      designation: input.designation,
      pages: input.pages,
      pieceDate: input.pieceDate ?? null,
      observations: input.observations ?? null,
      documentId: input.documentId ?? null,
    })
    .returning();
  await touchDossier(dossier.id);
  await audit(req, {
    action: "piece.create",
    entityType: "piece",
    entityId: piece!.id,
    dossierId: dossier.id,
    summary: `Ajout de la pièce n° ${piece!.position} : ${input.designation}`,
  });
  res.status(201).json((await listPieces(dossier.id)).find((p) => p.id === piece!.id));
});

async function accessiblePiece(user: AuthUser, id: number) {
  const [piece] = await db.select().from(piecesTable).where(eq(piecesTable.id, id));
  if (!piece) throw notFound("Pièce");
  const dossier = await dossierForDocuments(user, piece.dossierId, true);
  return { piece, dossier };
}

router.patch("/pieces/:id", async (req, res) => {
  const user = currentUser(req);
  const { piece, dossier } = await accessiblePiece(user, idParam(req));
  const input = parseBody(pieceSchema, req);
  await assertDocumentInDossier(input.documentId, dossier.id);
  await db
    .update(piecesTable)
    .set({
      designation: input.designation,
      pages: input.pages,
      pieceDate: input.pieceDate ?? null,
      observations: input.observations ?? null,
      documentId: input.documentId ?? null,
    })
    .where(eq(piecesTable.id, piece.id));
  await touchDossier(dossier.id);
  await audit(req, {
    action: "piece.update",
    entityType: "piece",
    entityId: piece.id,
    dossierId: dossier.id,
    summary: `Modification de la pièce n° ${piece.position} : ${input.designation}`,
  });
  res.json((await listPieces(dossier.id)).find((p) => p.id === piece.id));
});

router.delete("/pieces/:id", async (req, res) => {
  const user = currentUser(req);
  const { piece, dossier } = await accessiblePiece(user, idParam(req));
  await db.delete(piecesTable).where(eq(piecesTable.id, piece.id));
  await renumber(dossier.id);
  await touchDossier(dossier.id);
  await audit(req, {
    action: "piece.delete",
    entityType: "piece",
    entityId: piece.id,
    dossierId: dossier.id,
    summary: `Suppression de la pièce « ${piece.designation} » (renumérotation automatique)`,
  });
  res.status(204).end();
});

router.post("/dossiers/:id/pieces/reorder", async (req, res) => {
  const user = currentUser(req);
  const dossier = await dossierForDocuments(user, idParam(req), true);
  const { ids } = parseBody(reorderSchema, req);
  const existing = (await db.select({ id: piecesTable.id }).from(piecesTable).where(eq(piecesTable.dossierId, dossier.id))).map((r) => r.id);
  if (existing.length !== ids.length || !ids.every((id) => existing.includes(id))) {
    throw badRequest("La liste des pièces à réordonner est incomplète.");
  }
  await renumber(dossier.id, ids);
  await touchDossier(dossier.id);
  await audit(req, {
    action: "piece.reorder",
    entityType: "piece",
    dossierId: dossier.id,
    summary: `Réorganisation de l'ordre des pièces (${ids.length} pièces)`,
  });
  res.json(await listPieces(dossier.id));
});

/* ------------------------------------------------------------------ */
/* Bordereaux                                                         */
/* ------------------------------------------------------------------ */

async function toBordereauDTOs(user: AuthUser, rows: Bordereau[], withItems = false): Promise<BordereauDTO[]> {
  if (rows.length === 0) return [];
  const refs = await loadUserRefs(user.cabinetId);
  const ids = rows.map((r) => r.id);
  const items = await db
    .select()
    .from(bordereauItemsTable)
    .where(inArray(bordereauItemsTable.bordereauId, ids))
    .orderBy(asc(bordereauItemsTable.position));
  const dossiers = await db
    .select({ id: dossiersTable.id, reference: dossiersTable.reference, title: dossiersTable.title })
    .from(dossiersTable)
    .where(inArray(dossiersTable.id, [...new Set(rows.map((r) => r.dossierId))]));
  const dmap = new Map(dossiers.map((d) => [d.id, d]));
  return rows.map((b) => {
    const own = items.filter((i) => i.bordereauId === b.id);
    return {
      id: b.id,
      dossierId: b.dossierId,
      dossierReference: dmap.get(b.dossierId)?.reference ?? "",
      dossierTitle: dmap.get(b.dossierId)?.title ?? "",
      reference: b.reference,
      title: b.title,
      bordereauDate: b.bordereauDate,
      jurisdiction: b.jurisdiction,
      observations: b.observations,
      status: b.status as BordereauDTO["status"],
      totalPages: own.reduce((s, i) => s + i.pages, 0),
      itemCount: own.length,
      items: withItems
        ? own.map((i) => ({ id: i.id, position: i.position, pieceId: i.pieceId, designation: i.designation, pages: i.pages, observations: i.observations }))
        : undefined,
      createdBy: ref(refs, b.createdBy),
      createdAt: b.createdAt.toISOString(),
    };
  });
}

async function accessibleBordereau(user: AuthUser, id: number, write: boolean) {
  const [b] = await db.select().from(bordereauxTable).where(eq(bordereauxTable.id, id));
  if (!b) throw notFound("Bordereau");
  const dossier = await dossierForDocuments(user, b.dossierId, write);
  return { b, dossier };
}

async function snapshotItems(bordereauId: number, dossierId: number, pieceIds: number[]) {
  const pieces = await db
    .select()
    .from(piecesTable)
    .where(and(eq(piecesTable.dossierId, dossierId), inArray(piecesTable.id, pieceIds)))
    .orderBy(asc(piecesTable.position));
  if (pieces.length !== new Set(pieceIds).size) throw badRequest("Certaines pièces sélectionnées n'appartiennent pas au dossier.");
  await db.delete(bordereauItemsTable).where(eq(bordereauItemsTable.bordereauId, bordereauId));
  await db.insert(bordereauItemsTable).values(
    pieces.map((p, i) => ({
      bordereauId,
      pieceId: p.id,
      position: i + 1,
      designation: p.designation,
      pages: p.pages,
      observations: p.observations,
    })),
  );
  return pieces.length;
}

router.get("/bordereaux", async (req, res) => {
  const user = currentUser(req);
  assertCan(user, "documents.read");
  const ids = await visibleDossierIds(user);
  const rows = ids.length
    ? await db.select().from(bordereauxTable).where(inArray(bordereauxTable.dossierId, ids)).orderBy(desc(bordereauxTable.bordereauDate), desc(bordereauxTable.id))
    : [];
  res.json(await toBordereauDTOs(user, rows));
});

router.get("/dossiers/:id/bordereaux", async (req, res) => {
  const user = currentUser(req);
  const dossier = await dossierForDocuments(user, idParam(req), false);
  const rows = await db
    .select()
    .from(bordereauxTable)
    .where(eq(bordereauxTable.dossierId, dossier.id))
    .orderBy(desc(bordereauxTable.bordereauDate), desc(bordereauxTable.id));
  res.json(await toBordereauDTOs(user, rows));
});

router.get("/bordereaux/:id", async (req, res) => {
  const user = currentUser(req);
  const { b } = await accessibleBordereau(user, idParam(req), false);
  const [dto] = await toBordereauDTOs(user, [b], true);
  res.json(dto);
});

router.post("/dossiers/:id/bordereaux", async (req, res) => {
  const user = currentUser(req);
  const dossier = await dossierForDocuments(user, idParam(req), true);
  const input = parseBody(bordereauSchema, req);
  const [{ n }] = (await db.select({ n: count() }).from(bordereauxTable).where(eq(bordereauxTable.dossierId, dossier.id))) as [{ n: number }];
  const reference = `${dossier.reference.replace(/^DOS/, "BP")}-${String(Number(n) + 1).padStart(2, "0")}`;
  const [b] = await db
    .insert(bordereauxTable)
    .values({
      dossierId: dossier.id,
      reference,
      title: input.title,
      bordereauDate: input.bordereauDate,
      jurisdiction: input.jurisdiction ?? dossier.jurisdiction,
      observations: input.observations ?? null,
      status: "brouillon",
      createdBy: user.id,
    })
    .returning();
  const itemCount = await snapshotItems(b!.id, dossier.id, input.pieceIds);
  await touchDossier(dossier.id);
  await audit(req, {
    action: "bordereau.create",
    entityType: "bordereau",
    entityId: b!.id,
    dossierId: dossier.id,
    summary: `Génération du bordereau ${reference} (${itemCount} pièces)`,
  });
  const [dto] = await toBordereauDTOs(user, [b!], true);
  res.status(201).json(dto);
});

router.patch("/bordereaux/:id", async (req, res) => {
  const user = currentUser(req);
  const { b, dossier } = await accessibleBordereau(user, idParam(req), true);
  const input = parseBody(bordereauUpdateSchema, req);
  if (b.status === "finalise" && input.status !== "brouillon") {
    throw new HttpError(409, "Ce bordereau est finalisé : repassez-le en brouillon pour le modifier.");
  }
  if (input.status && input.status !== b.status && !can(user, "requetes.validate")) {
    throw forbidden("La finalisation d'un bordereau doit être faite par un avocat.");
  }
  const [updated] = await db
    .update(bordereauxTable)
    .set({
      title: input.title ?? b.title,
      bordereauDate: input.bordereauDate ?? b.bordereauDate,
      jurisdiction: input.jurisdiction === undefined ? b.jurisdiction : input.jurisdiction,
      observations: input.observations === undefined ? b.observations : input.observations,
      status: input.status ?? b.status,
    })
    .where(eq(bordereauxTable.id, b.id))
    .returning();
  await audit(req, {
    action: input.status === "finalise" ? "bordereau.finalize" : "bordereau.update",
    entityType: "bordereau",
    entityId: b.id,
    dossierId: dossier.id,
    summary:
      input.status === "finalise"
        ? `Finalisation du bordereau ${b.reference}`
        : input.status === "brouillon" && b.status === "finalise"
          ? `Retour en brouillon du bordereau ${b.reference}`
          : `Modification du bordereau ${b.reference}`,
  });
  const [dto] = await toBordereauDTOs(user, [updated!], true);
  res.json(dto);
});

/** Remplace les lignes du bordereau par la sélection actuelle des pièces. */
router.post("/bordereaux/:id/items", async (req, res) => {
  const user = currentUser(req);
  const { b, dossier } = await accessibleBordereau(user, idParam(req), true);
  if (b.status === "finalise") throw new HttpError(409, "Ce bordereau est finalisé.");
  const { ids } = parseBody(reorderSchema, req);
  const n = await snapshotItems(b.id, dossier.id, ids);
  await audit(req, {
    action: "bordereau.update",
    entityType: "bordereau",
    entityId: b.id,
    dossierId: dossier.id,
    summary: `Mise à jour des pièces du bordereau ${b.reference} (${n} pièces)`,
  });
  const [dto] = await toBordereauDTOs(user, [b], true);
  res.json(dto);
});

router.delete("/bordereaux/:id", async (req, res) => {
  const user = currentUser(req);
  const { b, dossier } = await accessibleBordereau(user, idParam(req), true);
  if (b.status === "finalise" && !can(user, "requetes.validate")) {
    throw forbidden("Seul un avocat peut supprimer un bordereau finalisé.");
  }
  await db.delete(bordereauxTable).where(eq(bordereauxTable.id, b.id));
  await audit(req, {
    action: "bordereau.delete",
    entityType: "bordereau",
    entityId: b.id,
    dossierId: dossier.id,
    summary: `Suppression du bordereau ${b.reference}`,
  });
  res.status(204).end();
});

router.get("/bordereaux/:id/pdf", async (req, res) => {
  const user = currentUser(req);
  const { b, dossier } = await accessibleBordereau(user, idParam(req), false);
  const items = await db
    .select()
    .from(bordereauItemsTable)
    .where(eq(bordereauItemsTable.bordereauId, b.id))
    .orderBy(asc(bordereauItemsTable.position));
  const [cabinet] = await db.select().from(cabinetsTable).where(eq(cabinetsTable.id, dossier.cabinetId));
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, dossier.clientId));
  const [lawyer] = await db.select().from(usersTable).where(eq(usersTable.id, dossier.responsibleId));
  const parties = await db
    .select()
    .from(dossierPartiesTable)
    .where(eq(dossierPartiesTable.dossierId, dossier.id))
    .orderBy(asc(dossierPartiesTable.id));
  const clientParty = parties.find((p) => p.clientId === client!.id);

  const pdf = await bordereauPdf({
    cabinet: cabinet!,
    reference: b.reference,
    title: b.title,
    date: b.bordereauDate,
    jurisdiction: b.jurisdiction ?? dossier.jurisdiction,
    roleNumber: dossier.roleNumber,
    dossierReference: dossier.reference,
    dossierTitle: dossier.title,
    clientName: clientDisplayName(client!),
    clientQuality: PARTY_ROLE_LABELS[(clientParty?.role ?? "demandeur") as PartyRole].toLowerCase(),
    parties: parties.map((p) => ({ role: PARTY_ROLE_LABELS[p.role as PartyRole], name: p.name, counsel: p.counsel })),
    items,
    observations: b.observations,
    signer: `Maître ${lawyer!.firstName} ${lawyer!.lastName}`,
    signerTitle: lawyer!.title ?? "Avocat à la Cour",
    draft: b.status !== "finalise",
  });
  const download = req.query.download === "1";
  await audit(req, {
    action: "bordereau.export",
    entityType: "bordereau",
    entityId: b.id,
    dossierId: dossier.id,
    summary: `${download ? "Export PDF" : "Aperçu"} du bordereau ${b.reference}`,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", contentDisposition(download ? "attachment" : "inline", `Bordereau-${b.reference}.pdf`));
  res.setHeader("Cache-Control", "private, no-store");
  res.send(pdf);
});

export { toDocumentDTOs };
export default router;
