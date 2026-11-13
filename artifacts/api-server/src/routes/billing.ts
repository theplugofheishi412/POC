import { Router, type IRouter } from "express";
import {
  and,
  asc,
  cabinetsTable,
  clientsTable,
  db,
  desc,
  dossiersTable,
  eq,
  expensesTable,
  inArray,
  invoiceLinesTable,
  invoicesTable,
  paymentsTable,
  sql,
  usersTable,
  type Expense,
  type Invoice,
} from "@workspace/db";
import {
  EXPENSE_CATEGORY_LABELS,
  expenseSchema,
  INVOICE_LINE_KIND_LABELS,
  invoiceSchema,
  PAYMENT_METHOD_LABELS,
  paymentSchema,
  type ExpenseDTO,
  type InvoiceDTO,
  type PaymentDTO,
  type PaymentState,
} from "@workspace/api-zod";
import { currentUser, requirePermission, type AuthUser } from "../lib/auth";
import { audit, dossierSummaries, getAccessibleDossier, loadUserRefs, ref, touchDossier, visibleDossierIds } from "../lib/access";
import { badRequest, HttpError, idParam, notFound, parseBody, queryInt, queryString, today } from "../lib/http";
import { fcfa } from "../lib/format";
import { clientDisplayName } from "../lib/mappers";
import { invoicePdf } from "../lib/pdf";
import { contentDisposition } from "../lib/storage";

const router: IRouter = Router();
router.use(["/invoices", "/payments", "/expenses", "/billing"], requirePermission("billing.read"));

/* ------------------------------------------------------------------ */
/* Factures                                                           */
/* ------------------------------------------------------------------ */

export async function toInvoiceDTOs(user: AuthUser, rows: Invoice[], detailed = false): Promise<InvoiceDTO[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const lines = await db.select().from(invoiceLinesTable).where(inArray(invoiceLinesTable.invoiceId, ids)).orderBy(asc(invoiceLinesTable.id));
  const payments = await db.select().from(paymentsTable).where(inArray(paymentsTable.invoiceId, ids)).orderBy(asc(paymentsTable.paidAt));
  const dossiers = await dossierSummaries(rows.map((r) => r.dossierId));
  const clients = await db
    .select()
    .from(clientsTable)
    .where(inArray(clientsTable.id, [...new Set(rows.map((r) => r.clientId))]));
  const cmap = new Map(clients.map((c) => [c.id, clientDisplayName(c)]));
  const refs = await loadUserRefs(user.cabinetId);
  const todayStr = today();

  return rows.map((inv) => {
    const own = lines.filter((l) => l.invoiceId === inv.id);
    const pays = payments.filter((p) => p.invoiceId === inv.id);
    const total = own.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const paid = pays.reduce((s, p) => s + p.amount, 0);
    const paymentState: PaymentState = paid <= 0 ? "impayee" : paid >= total ? "payee" : "partielle";
    return {
      id: inv.id,
      number: inv.number,
      dossier: dossiers.get(inv.dossierId) ?? { id: inv.dossierId, reference: "", title: "" },
      client: { id: inv.clientId, displayName: cmap.get(inv.clientId) ?? "" },
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      status: inv.status as InvoiceDTO["status"],
      paymentState,
      total,
      paid,
      balance: Math.max(0, total - paid),
      overdue: inv.status === "emise" && paymentState !== "payee" && inv.dueDate < todayStr,
      notes: inv.notes,
      createdAt: inv.createdAt.toISOString(),
      lines: detailed
        ? own.map((l) => ({ id: l.id, description: l.description, kind: l.kind as "honoraires" | "frais", quantity: l.quantity, unitPrice: l.unitPrice, total: l.quantity * l.unitPrice }))
        : undefined,
      payments: detailed ? pays.map((p) => toPaymentDTO(p, inv.number, refs)) : undefined,
    };
  });
}

function toPaymentDTO(p: typeof paymentsTable.$inferSelect, invoiceNumber: string, refs: Awaited<ReturnType<typeof loadUserRefs>>): PaymentDTO {
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    invoiceNumber,
    amount: p.amount,
    paidAt: p.paidAt,
    method: p.method as PaymentDTO["method"],
    reference: p.reference,
    notes: p.notes,
    recordedBy: ref(refs, p.recordedBy),
    createdAt: p.createdAt.toISOString(),
  };
}

async function accessibleInvoice(user: AuthUser, id: number) {
  const [inv] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.id, id), eq(invoicesTable.cabinetId, user.cabinetId)));
  if (!inv) throw notFound("Facture");
  await getAccessibleDossier(user, inv.dossierId);
  return inv;
}

router.get("/invoices", async (req, res) => {
  const user = currentUser(req);
  const ids = await visibleDossierIds(user);
  const dossierId = queryInt(req, "dossierId");
  const clientId = queryInt(req, "clientId");
  const state = queryString(req, "state"); // impayee | partielle | payee | retard | ouvertes
  const rows = ids.length
    ? await db
        .select()
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.cabinetId, user.cabinetId),
            inArray(invoicesTable.dossierId, ids),
            dossierId ? eq(invoicesTable.dossierId, dossierId) : undefined,
            clientId ? eq(invoicesTable.clientId, clientId) : undefined,
          ),
        )
        .orderBy(desc(invoicesTable.issueDate), desc(invoicesTable.id))
    : [];
  let items = await toInvoiceDTOs(user, rows);
  if (state === "retard") items = items.filter((i) => i.overdue);
  else if (state === "ouvertes") items = items.filter((i) => i.status === "emise" && i.paymentState !== "payee");
  else if (state) items = items.filter((i) => i.paymentState === state && i.status !== "annulee");
  res.json(items);
});

router.get("/invoices/:id", async (req, res) => {
  const user = currentUser(req);
  const inv = await accessibleInvoice(user, idParam(req));
  const [dto] = await toInvoiceDTOs(user, [inv], true);
  res.json(dto);
});

async function nextInvoiceNumber(cabinetId: number, issueDate: string) {
  const year = issueDate.slice(0, 4);
  const [row] = await db
    .select({ max: sql<string | null>`max(${invoicesTable.number})` })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.cabinetId, cabinetId), sql`${invoicesTable.number} like ${`FAC-${year}-%`}`));
  const last = row?.max ? Number(row.max.split("-")[2]) : 0;
  return `FAC-${year}-${String(last + 1).padStart(3, "0")}`;
}

router.post("/invoices", requirePermission("billing.write"), async (req, res) => {
  const user = currentUser(req);
  const input = parseBody(invoiceSchema, req);
  if (input.dueDate < input.issueDate) throw badRequest("L'échéance doit être postérieure à la date d'émission.");
  const dossier = await getAccessibleDossier(user, input.dossierId);
  const number = await nextInvoiceNumber(user.cabinetId, input.issueDate);
  const [inv] = await db
    .insert(invoicesTable)
    .values({
      cabinetId: user.cabinetId,
      number,
      dossierId: dossier.id,
      clientId: dossier.clientId,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: input.status,
      notes: input.notes ?? null,
      createdBy: user.id,
    })
    .returning();
  await db.insert(invoiceLinesTable).values(input.lines.map((l) => ({ ...l, invoiceId: inv!.id })));
  const total = input.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  await touchDossier(dossier.id);
  await audit(req, {
    action: "invoice.create",
    entityType: "invoice",
    entityId: inv!.id,
    dossierId: dossier.id,
    clientId: dossier.clientId,
    summary: `Facture ${number} de ${fcfa(total)} ${input.status === "brouillon" ? "préparée (brouillon)" : "émise"}`,
  });
  const [dto] = await toInvoiceDTOs(user, [inv!], true);
  res.status(201).json(dto);
});

router.patch("/invoices/:id", requirePermission("billing.write"), async (req, res) => {
  const user = currentUser(req);
  const inv = await accessibleInvoice(user, idParam(req));
  const input = parseBody(invoiceSchema, req);
  const [{ paid }] = (await db
    .select({ paid: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)` })
    .from(paymentsTable)
    .where(eq(paymentsTable.invoiceId, inv.id))) as [{ paid: number }];
  if (Number(paid) > 0 && input.dossierId !== inv.dossierId) throw new HttpError(409, "Une facture réglée ne peut pas changer de dossier.");
  const total = input.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  if (total < Number(paid)) throw new HttpError(409, `Le total ne peut pas être inférieur aux règlements déjà reçus (${fcfa(Number(paid))}).`);
  const dossier = await getAccessibleDossier(user, input.dossierId);
  await db
    .update(invoicesTable)
    .set({ dossierId: dossier.id, clientId: dossier.clientId, issueDate: input.issueDate, dueDate: input.dueDate, status: input.status, notes: input.notes ?? null })
    .where(eq(invoicesTable.id, inv.id));
  await db.delete(invoiceLinesTable).where(eq(invoiceLinesTable.invoiceId, inv.id));
  await db.insert(invoiceLinesTable).values(input.lines.map((l) => ({ ...l, invoiceId: inv.id })));
  await audit(req, {
    action: input.status === "annulee" ? "invoice.cancel" : "invoice.update",
    entityType: "invoice",
    entityId: inv.id,
    dossierId: dossier.id,
    summary: input.status === "annulee" ? `Annulation de la facture ${inv.number}` : `Modification de la facture ${inv.number} (${fcfa(total)})`,
  });
  const [updated] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, inv.id));
  const [dto] = await toInvoiceDTOs(user, [updated!], true);
  res.json(dto);
});

router.post("/invoices/:id/payments", requirePermission("billing.write"), async (req, res) => {
  const user = currentUser(req);
  const inv = await accessibleInvoice(user, idParam(req));
  if (inv.status !== "emise") throw new HttpError(409, "Seule une facture émise peut recevoir un règlement.");
  const input = parseBody(paymentSchema, req);
  const [dto] = await toInvoiceDTOs(user, [inv]);
  if (input.amount > dto!.balance) {
    throw badRequest(`Le montant dépasse le reste à payer (${fcfa(dto!.balance)}).`);
  }
  const [p] = await db
    .insert(paymentsTable)
    .values({ invoiceId: inv.id, amount: input.amount, paidAt: input.paidAt, method: input.method, reference: input.reference ?? null, notes: input.notes ?? null, recordedBy: user.id })
    .returning();
  const remaining = dto!.balance - input.amount;
  await audit(req, {
    action: "payment.create",
    entityType: "payment",
    entityId: p!.id,
    dossierId: inv.dossierId,
    clientId: inv.clientId,
    summary: `Règlement de ${fcfa(input.amount)} (${PAYMENT_METHOD_LABELS[input.method]}) sur la facture ${inv.number}${remaining > 0 ? ` — reste ${fcfa(remaining)}` : " — facture soldée"}`,
  });
  const [updated] = await toInvoiceDTOs(user, [inv], true);
  res.status(201).json(updated);
});

router.delete("/payments/:id", requirePermission("billing.write"), async (req, res) => {
  const user = currentUser(req);
  const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, idParam(req)));
  if (!p) throw notFound("Règlement");
  const inv = await accessibleInvoice(user, p.invoiceId);
  await db.delete(paymentsTable).where(eq(paymentsTable.id, p.id));
  await audit(req, {
    action: "payment.delete",
    entityType: "payment",
    entityId: p.id,
    dossierId: inv.dossierId,
    summary: `Annulation du règlement de ${fcfa(p.amount)} sur la facture ${inv.number}`,
  });
  res.status(204).end();
});

router.get("/payments", async (req, res) => {
  const user = currentUser(req);
  const ids = await visibleDossierIds(user);
  if (!ids.length) {
    res.json([]);
    return;
  }
  const rows = await db
    .select({ p: paymentsTable, number: invoicesTable.number })
    .from(paymentsTable)
    .innerJoin(invoicesTable, eq(invoicesTable.id, paymentsTable.invoiceId))
    .where(and(eq(invoicesTable.cabinetId, user.cabinetId), inArray(invoicesTable.dossierId, ids)))
    .orderBy(desc(paymentsTable.paidAt), desc(paymentsTable.id));
  const refs = await loadUserRefs(user.cabinetId);
  res.json(rows.map((r) => toPaymentDTO(r.p, r.number, refs)));
});

router.get("/invoices/:id/pdf", async (req, res) => {
  const user = currentUser(req);
  const inv = await accessibleInvoice(user, idParam(req));
  const [dto] = await toInvoiceDTOs(user, [inv], true);
  const [cabinet] = await db.select().from(cabinetsTable).where(eq(cabinetsTable.id, user.cabinetId));
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, inv.clientId));
  const [dossier] = await db.select().from(dossiersTable).where(eq(dossiersTable.id, inv.dossierId));
  const [lawyer] = await db.select().from(usersTable).where(eq(usersTable.id, dossier!.responsibleId));
  const pdf = await invoicePdf({
    cabinet: cabinet!,
    number: inv.number,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    client: { name: clientDisplayName(client!), address: client!.address, city: client!.city },
    dossier: { reference: dossier!.reference, title: dossier!.title },
    lines: dto!.lines!.map((l) => ({ ...l, kind: INVOICE_LINE_KIND_LABELS[l.kind] })),
    payments: dto!.payments!.map((p) => ({ ...p, method: PAYMENT_METHOD_LABELS[p.method] })),
    notes: inv.notes,
    responsible: `Maître ${lawyer!.firstName} ${lawyer!.lastName}`,
    cancelled: inv.status === "annulee",
  });
  const download = req.query.download === "1";
  await audit(req, {
    action: "invoice.export",
    entityType: "invoice",
    entityId: inv.id,
    dossierId: inv.dossierId,
    summary: `${download ? "Export PDF" : "Aperçu"} de la facture ${inv.number}`,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", contentDisposition(download ? "attachment" : "inline", `Facture-${inv.number}.pdf`));
  res.setHeader("Cache-Control", "private, no-store");
  res.send(pdf);
});

/* ------------------------------------------------------------------ */
/* Dépenses                                                           */
/* ------------------------------------------------------------------ */

async function toExpenseDTOs(user: AuthUser, rows: Expense[]): Promise<ExpenseDTO[]> {
  const refs = await loadUserRefs(user.cabinetId);
  const dossiers = await dossierSummaries(rows.map((r) => r.dossierId).filter((x): x is number => !!x));
  return rows.map((e) => ({
    id: e.id,
    dossier: e.dossierId ? (dossiers.get(e.dossierId) ?? null) : null,
    expenseDate: e.expenseDate,
    category: e.category as ExpenseDTO["category"],
    description: e.description,
    amount: e.amount,
    rebillable: e.rebillable,
    recordedBy: ref(refs, e.recordedBy),
    createdAt: e.createdAt.toISOString(),
  }));
}

router.get("/expenses", async (req, res) => {
  const user = currentUser(req);
  const dossierId = queryInt(req, "dossierId");
  const rows = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.cabinetId, user.cabinetId), dossierId ? eq(expensesTable.dossierId, dossierId) : undefined))
    .orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id));
  res.json(await toExpenseDTOs(user, rows));
});

router.post("/expenses", requirePermission("billing.write"), async (req, res) => {
  const user = currentUser(req);
  const input = parseBody(expenseSchema, req);
  if (input.dossierId) await getAccessibleDossier(user, input.dossierId);
  const [e] = await db
    .insert(expensesTable)
    .values({ ...input, dossierId: input.dossierId ?? null, cabinetId: user.cabinetId, recordedBy: user.id })
    .returning();
  await audit(req, {
    action: "expense.create",
    entityType: "expense",
    entityId: e!.id,
    dossierId: e!.dossierId,
    summary: `Dépense enregistrée : ${input.description} (${EXPENSE_CATEGORY_LABELS[input.category]}, ${fcfa(input.amount)})`,
  });
  const [dto] = await toExpenseDTOs(user, [e!]);
  res.status(201).json(dto);
});

router.delete("/expenses/:id", requirePermission("billing.write"), async (req, res) => {
  const user = currentUser(req);
  const [e] = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.id, idParam(req)), eq(expensesTable.cabinetId, user.cabinetId)));
  if (!e) throw notFound("Dépense");
  await db.delete(expensesTable).where(eq(expensesTable.id, e.id));
  await audit(req, {
    action: "expense.delete",
    entityType: "expense",
    entityId: e.id,
    dossierId: e.dossierId,
    summary: `Suppression de la dépense « ${e.description} » (${fcfa(e.amount)})`,
  });
  res.status(204).end();
});

/** Synthèse financière. */
router.get("/billing/summary", async (req, res) => {
  const user = currentUser(req);
  const ids = await visibleDossierIds(user);
  const rows = ids.length
    ? await db.select().from(invoicesTable).where(and(eq(invoicesTable.cabinetId, user.cabinetId), inArray(invoicesTable.dossierId, ids)))
    : [];
  const invoices = (await toInvoiceDTOs(user, rows)).filter((i) => i.status === "emise");
  const [{ expenses }] = (await db
    .select({ expenses: sql<number>`coalesce(sum(${expensesTable.amount}), 0)` })
    .from(expensesTable)
    .where(eq(expensesTable.cabinetId, user.cabinetId))) as [{ expenses: number }];
  res.json({
    invoiced: invoices.reduce((s, i) => s + i.total, 0),
    collected: invoices.reduce((s, i) => s + i.paid, 0),
    outstanding: invoices.reduce((s, i) => s + i.balance, 0),
    overdue: invoices.filter((i) => i.overdue).reduce((s, i) => s + i.balance, 0),
    unpaidCount: invoices.filter((i) => i.paymentState !== "payee").length,
    expenses: Number(expenses),
  });
});

export default router;
