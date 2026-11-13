import PDFDocument from "pdfkit";
import { fcfa, longDate, pdfSafe, shortDate, amountInWords } from "./format";
import { parseRichText } from "./richtext";

/**
 * Génération des documents PDF du cabinet (bordereaux, requêtes, factures).
 * Polices standard PDF (Times / Helvetica) : aucun fichier de police à
 * embarquer, rendu identique sur tous les postes.
 */

const NAVY = "#14213d";
const GOLD = "#b08d3c";
const GREY = "#5b6472";
const LIGHT = "#f2f4f7";
const LINE = "#d5d9e0";

const MARGIN = 56;

export interface CabinetInfo {
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  barNumber: string | null;
}

type Doc = PDFKit.PDFDocument;

function createDoc(title: string): Doc {
  return new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN + 18, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: { Title: pdfSafe(title), Author: "TechSolution — POC Cabinet", Creator: "POC Cabinet d'avocats" },
  });
}

function toBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

const contentWidth = (doc: Doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const bottomLimit = (doc: Doc) => doc.page.height - doc.page.margins.bottom;

function text(doc: Doc, value: string, options?: PDFKit.Mixins.TextOptions) {
  return doc.text(pdfSafe(value), options);
}

/** En-tête du cabinet (papier à en-tête). */
function letterhead(doc: Doc, cabinet: CabinetInfo) {
  const x = doc.page.margins.left;
  doc.fillColor(NAVY).font("Times-Bold").fontSize(17);
  text(doc, cabinet.name, { width: contentWidth(doc) });
  doc.font("Helvetica").fontSize(8.5).fillColor(GREY);
  text(doc, "AVOCATS À LA COUR", { characterSpacing: 1.6 });
  const contact = [cabinet.address, cabinet.city].filter(Boolean).join(" — ");
  if (contact) text(doc, contact);
  const reach = [cabinet.phone && `Tél. ${cabinet.phone}`, cabinet.email].filter(Boolean).join("  ·  ");
  if (reach) text(doc, reach);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.moveTo(x, y).lineTo(x + contentWidth(doc), y).lineWidth(1.2).strokeColor(GOLD).stroke();
  doc.moveTo(x, y + 2.5).lineTo(x + contentWidth(doc), y + 2.5).lineWidth(0.4).strokeColor(GOLD).stroke();
  doc.y = y + 14;
  doc.fillColor("black");
}

/** Pied de page + numérotation, appliqué à toutes les pages. */
function footers(doc: Doc, left: string, notice: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - doc.page.margins.bottom;
    const x = doc.page.margins.left;
    const w = contentWidth(doc);
    // Écrire sous la marge basse sans déclencher de saut de page.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.moveTo(x, bottom + 4).lineTo(x + w, bottom + 4).lineWidth(0.4).strokeColor(LINE).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(GREY);
    doc.text(pdfSafe(left), x, bottom + 9, { width: w * 0.7, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} / ${range.count}`, x, bottom + 9, { width: w, align: "right", lineBreak: false });
    doc.fontSize(6.8).fillColor("#8a6d2b");
    doc.text(pdfSafe(notice), x, bottom + 20, { width: w, align: "center", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }
}

/** Filigrane diagonal pour les projets non validés. */
function watermark(doc: Doc, label: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.font("Helvetica-Bold").fontSize(70).fillColor("#c62828").fillOpacity(0.07);
    doc.text(label, 0, doc.page.height / 2 - 40, { width: doc.page.width, align: "center", lineBreak: false });
    doc.restore();
    doc.fillOpacity(1);
  }
}

function labelValue(doc: Doc, label: string, value: string, labelWidth = 120) {
  const x = doc.page.margins.left;
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(GREY);
  doc.text(pdfSafe(label), x, y, { width: labelWidth });
  doc.font("Helvetica").fontSize(9.5).fillColor("black");
  doc.text(pdfSafe(value || "—"), x + labelWidth, y, { width: contentWidth(doc) - labelWidth });
  doc.x = x;
  doc.moveDown(0.35);
}

function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > bottomLimit(doc)) doc.addPage();
}

/* ------------------------------------------------------------------ */
/* Tableau générique                                                  */
/* ------------------------------------------------------------------ */

interface Column {
  header: string;
  width: number; // fraction de la largeur utile
  align?: "left" | "right" | "center";
}

function table(doc: Doc, columns: Column[], rows: string[][], options?: { footer?: string[] }) {
  const x0 = doc.page.margins.left;
  const total = contentWidth(doc);
  const widths = columns.map((c) => c.width * total);
  const pad = 5;

  const drawRow = (cells: string[], kind: "head" | "body" | "foot", zebra: boolean) => {
    doc.font(kind === "body" ? "Helvetica" : "Helvetica-Bold").fontSize(kind === "head" ? 8.5 : 9);
    const heights = cells.map((c, i) => doc.heightOfString(pdfSafe(c), { width: widths[i]! - pad * 2 }));
    const h = Math.max(...heights) + pad * 2;
    if (doc.y + h > bottomLimit(doc)) {
      doc.addPage();
      if (kind !== "head") drawRow(columns.map((c) => c.header), "head", false);
    }
    const y = doc.y;
    if (kind === "head") doc.rect(x0, y, total, h).fill(NAVY);
    else if (kind === "foot") doc.rect(x0, y, total, h).fill("#e9e3d3");
    else if (zebra) doc.rect(x0, y, total, h).fill(LIGHT);
    let x = x0;
    cells.forEach((c, i) => {
      doc.fillColor(kind === "head" ? "white" : "black");
      doc.text(pdfSafe(c), x + pad, y + pad, { width: widths[i]! - pad * 2, align: columns[i]!.align ?? "left" });
      x += widths[i]!;
    });
    doc.moveTo(x0, y + h).lineTo(x0 + total, y + h).lineWidth(0.4).strokeColor(LINE).stroke();
    doc.x = x0;
    doc.y = y + h;
  };

  drawRow(columns.map((c) => c.header), "head", false);
  rows.forEach((r, i) => drawRow(r, "body", i % 2 === 1));
  if (options?.footer) drawRow(options.footer, "foot", false);
  doc.fillColor("black");
}

function signature(doc: Doc, city: string | null, date: string, signer: string, role: string) {
  ensureSpace(doc, 110);
  doc.moveDown(1.5);
  const x = doc.page.margins.left + contentWidth(doc) * 0.55;
  const w = contentWidth(doc) * 0.45;
  const y = doc.y;
  doc.font("Helvetica").fontSize(9.5).fillColor("black");
  doc.text(pdfSafe(`Fait à ${city ?? "Dakar"}, le ${longDate(date)}`), x, y, { width: w });
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").text(pdfSafe(signer), x, doc.y, { width: w });
  doc.font("Helvetica").fillColor(GREY).fontSize(8.5).text(pdfSafe(role), x, doc.y, { width: w });
  doc.moveDown(2.5);
  doc.fillColor(GREY).fontSize(8).text("(Signature et cachet)", x, doc.y, { width: w });
  doc.x = doc.page.margins.left;
  doc.fillColor("black");
}

/* ------------------------------------------------------------------ */
/* Bordereau de communication de pièces                               */
/* ------------------------------------------------------------------ */

export interface BordereauPdfInput {
  cabinet: CabinetInfo;
  reference: string;
  title: string;
  date: string;
  jurisdiction: string | null;
  roleNumber: string | null;
  dossierReference: string;
  dossierTitle: string;
  clientName: string;
  clientQuality: string;
  parties: { role: string; name: string; counsel: string | null }[];
  items: { position: number; designation: string; pages: number; observations: string | null }[];
  observations: string | null;
  signer: string;
  signerTitle: string;
  draft: boolean;
}

export async function bordereauPdf(input: BordereauPdfInput): Promise<Buffer> {
  const doc = createDoc(`Bordereau ${input.reference}`);
  letterhead(doc, input.cabinet);

  doc.font("Helvetica").fontSize(9).fillColor(GREY);
  text(doc, `Réf. cabinet : ${input.dossierReference}  ·  Bordereau n° ${input.reference}`, { align: "right" });
  doc.moveDown(1.2);

  doc.font("Times-Bold").fontSize(16).fillColor(NAVY);
  text(doc, "BORDEREAU DE COMMUNICATION DE PIÈCES", { align: "center" });
  doc.font("Times-Italic").fontSize(11).fillColor(GREY);
  text(doc, input.title, { align: "center" });
  doc.moveDown(1.2);

  labelValue(doc, "Juridiction", input.jurisdiction ?? "—");
  if (input.roleNumber) labelValue(doc, "N° de rôle", input.roleNumber);
  labelValue(doc, "Affaire", input.dossierTitle);
  labelValue(doc, "Client", `${input.clientName} (${input.clientQuality})`);
  const byRole = new Map<string, string[]>();
  for (const p of input.parties) {
    const list = byRole.get(p.role) ?? [];
    list.push(p.counsel ? `${p.name} — conseil : ${p.counsel}` : p.name);
    byRole.set(p.role, list);
  }
  for (const [role, names] of byRole) labelValue(doc, role, names.join("\n"));
  labelValue(doc, "Date du bordereau", longDate(input.date));
  doc.moveDown(0.6);

  doc.font("Helvetica").fontSize(9.5).fillColor("black");
  text(
    doc,
    `${input.signer}, ${input.signerTitle}, conseil de ${input.clientName}, déclare communiquer les pièces suivantes :`,
  );
  doc.moveDown(0.7);

  const totalPages = input.items.reduce((s, i) => s + i.pages, 0);
  table(
    doc,
    [
      { header: "N°", width: 0.08, align: "center" },
      { header: "Désignation de la pièce", width: 0.52 },
      { header: "Observations", width: 0.28 },
      { header: "Pages", width: 0.12, align: "right" },
    ],
    input.items.map((i) => [String(i.position), i.designation, i.observations ?? "", String(i.pages)]),
    { footer: ["", `Total : ${input.items.length} pièce${input.items.length > 1 ? "s" : ""}`, "", String(totalPages)] },
  );

  if (input.observations) {
    doc.moveDown(1);
    ensureSpace(doc, 50);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(NAVY);
    text(doc, "Observations");
    doc.font("Helvetica").fontSize(9.5).fillColor("black");
    text(doc, input.observations);
  }

  signature(doc, input.cabinet.city, input.date, input.signer, input.signerTitle);

  if (input.draft) watermark(doc, "BROUILLON");
  footers(
    doc,
    `${input.cabinet.name} — Bordereau ${input.reference}`,
    "Document généré par le POC TechSolution — données fictives de démonstration.",
  );
  return toBuffer(doc);
}

/* ------------------------------------------------------------------ */
/* Requêtes et actes                                                  */
/* ------------------------------------------------------------------ */

export interface RequetePdfInput {
  cabinet: CabinetInfo;
  title: string;
  content: string;
  dossierReference: string;
  version: number;
  status: "brouillon" | "a_valider" | "validee" | "deposee";
  validatedBy: string | null;
  validatedAt: Date | null;
}

export async function requetePdf(input: RequetePdfInput): Promise<Buffer> {
  const doc = createDoc(input.title);
  letterhead(doc, input.cabinet);
  doc.font("Helvetica").fontSize(8.5).fillColor(GREY);
  text(doc, `Réf. ${input.dossierReference} — version ${input.version}`, { align: "right" });
  doc.moveDown(0.8);

  for (const block of parseRichText(input.content)) {
    switch (block.kind) {
      case "title":
        ensureSpace(doc, 50);
        doc.moveDown(0.4);
        doc.font("Times-Bold").fontSize(15).fillColor(NAVY);
        text(doc, block.text.toUpperCase(), { align: "center" });
        doc.moveDown(0.6);
        break;
      case "heading":
        ensureSpace(doc, 40);
        doc.moveDown(0.5);
        doc.font("Times-Bold").fontSize(11.5).fillColor(NAVY);
        text(doc, block.text);
        doc.moveDown(0.25);
        break;
      case "right":
        doc.font("Times-Roman").fontSize(11).fillColor("black");
        text(doc, block.text, { align: "right" });
        doc.moveDown(0.4);
        break;
      case "center":
        doc.font("Times-Bold").fontSize(11).fillColor("black");
        text(doc, block.text, { align: "center" });
        doc.moveDown(0.4);
        break;
      case "bullet":
        doc.font("Times-Roman").fontSize(11).fillColor("black");
        text(doc, `•  ${block.text}`, { indent: 14, align: "justify" });
        doc.moveDown(0.2);
        break;
      case "paragraph":
        doc.font("Times-Roman").fontSize(11).fillColor("black");
        text(doc, block.text, { align: "justify", lineGap: 1.5 });
        doc.moveDown(0.55);
        break;
    }
  }

  const validated = input.status === "validee" || input.status === "deposee";
  if (!validated) watermark(doc, "PROJET");
  const notice = validated
    ? `Contenu validé par ${input.validatedBy ?? "un avocat"} le ${shortDate(input.validatedAt)} — modèle issu du POC TechSolution.`
    : "PROJET À VALIDER PAR UN AVOCAT — modèle de démonstration, sans valeur juridique en l'état.";
  footers(doc, `${input.cabinet.name} — ${input.title}`, notice);
  return toBuffer(doc);
}

/* ------------------------------------------------------------------ */
/* Factures                                                           */
/* ------------------------------------------------------------------ */

export interface InvoicePdfInput {
  cabinet: CabinetInfo;
  number: string;
  issueDate: string;
  dueDate: string;
  client: { name: string; address: string | null; city: string | null };
  dossier: { reference: string; title: string };
  lines: { description: string; kind: string; quantity: number; unitPrice: number }[];
  payments: { paidAt: string; method: string; amount: number; reference: string | null }[];
  notes: string | null;
  responsible: string;
  cancelled: boolean;
}

export async function invoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const doc = createDoc(`Facture ${input.number}`);
  letterhead(doc, input.cabinet);

  const x = doc.page.margins.left;
  const w = contentWidth(doc);
  const top = doc.y;
  doc.font("Times-Bold").fontSize(20).fillColor(NAVY).text("NOTE D'HONORAIRES", x, top, { width: w / 2 });
  doc.font("Helvetica").fontSize(9.5).fillColor("black");
  doc.text(pdfSafe(`N° ${input.number}`), x, doc.y + 2, { width: w / 2 });
  doc.text(pdfSafe(`Date d'émission : ${longDate(input.issueDate)}`), { width: w / 2 });
  doc.text(pdfSafe(`Échéance : ${longDate(input.dueDate)}`), { width: w / 2 });
  const leftBottom = doc.y;

  // Bloc destinataire
  const bx = x + w * 0.55;
  doc.rect(bx, top, w * 0.45, 78).lineWidth(0.6).strokeColor(LINE).stroke();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(GREY).text("DESTINATAIRE", bx + 10, top + 9);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor("black").text(pdfSafe(input.client.name), bx + 10, doc.y + 2, {
    width: w * 0.45 - 20,
  });
  doc.font("Helvetica").fontSize(9);
  if (input.client.address) doc.text(pdfSafe(input.client.address), { width: w * 0.45 - 20 });
  if (input.client.city) doc.text(pdfSafe(input.client.city), { width: w * 0.45 - 20 });
  doc.x = x;
  doc.y = Math.max(leftBottom, top + 78) + 18;

  labelValue(doc, "Dossier", `${input.dossier.reference} — ${input.dossier.title}`, 80);
  labelValue(doc, "Avocat en charge", input.responsible, 80);
  doc.moveDown(0.8);

  const total = input.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const paid = input.payments.reduce((s, p) => s + p.amount, 0);
  table(
    doc,
    [
      { header: "Désignation", width: 0.46 },
      { header: "Nature", width: 0.14 },
      { header: "Qté", width: 0.08, align: "right" },
      { header: "Prix unitaire", width: 0.16, align: "right" },
      { header: "Montant", width: 0.16, align: "right" },
    ],
    input.lines.map((l) => [l.description, l.kind, String(l.quantity), fcfa(l.unitPrice), fcfa(l.quantity * l.unitPrice)]),
    { footer: ["Total TTC", "", "", "", fcfa(total)] },
  );

  doc.moveDown(0.6);
  doc.font("Helvetica-Oblique").fontSize(9).fillColor(GREY);
  text(doc, `Arrêtée la présente note à la somme de ${amountInWords(total)} francs CFA (${fcfa(total)}).`);

  if (input.payments.length > 0) {
    doc.moveDown(1);
    ensureSpace(doc, 80);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY);
    text(doc, "Règlements reçus");
    doc.moveDown(0.3);
    table(
      doc,
      [
        { header: "Date", width: 0.2 },
        { header: "Mode", width: 0.3 },
        { header: "Référence", width: 0.3 },
        { header: "Montant", width: 0.2, align: "right" },
      ],
      input.payments.map((p) => [shortDate(p.paidAt), p.method, p.reference ?? "—", fcfa(p.amount)]),
      { footer: ["Reste à payer", "", "", fcfa(Math.max(0, total - paid))] },
    );
  } else {
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY);
    text(doc, `Net à payer : ${fcfa(total)}`, { align: "right" });
  }

  if (input.notes) {
    doc.moveDown(1);
    doc.font("Helvetica").fontSize(9).fillColor("black");
    text(doc, input.notes);
  }
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(8.5).fillColor(GREY);
  text(doc, "Règlement par virement, chèque à l'ordre du cabinet, espèces ou mobile money, en rappelant le numéro de la note.");

  if (input.cancelled) watermark(doc, "ANNULÉE");
  footers(doc, `${input.cabinet.name} — Facture ${input.number}`, "Document généré par le POC TechSolution — données fictives de démonstration.");
  return toBuffer(doc);
}

/* ------------------------------------------------------------------ */
/* Documents factices (jeu de démonstration)                          */
/* ------------------------------------------------------------------ */

export async function sampleDocumentPdf(cabinet: CabinetInfo, title: string, lines: string[]): Promise<Buffer> {
  const doc = createDoc(title);
  letterhead(doc, cabinet);
  doc.font("Times-Bold").fontSize(14).fillColor(NAVY);
  text(doc, title, { align: "center" });
  doc.moveDown(1);
  doc.font("Times-Roman").fontSize(11).fillColor("black");
  for (const l of lines) {
    text(doc, l, { align: "justify" });
    doc.moveDown(0.5);
  }
  watermark(doc, "SPÉCIMEN");
  footers(doc, title, "Pièce fictive créée pour la démonstration — aucune donnée réelle.");
  return toBuffer(doc);
}
