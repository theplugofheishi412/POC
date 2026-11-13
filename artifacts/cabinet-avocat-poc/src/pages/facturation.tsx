import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useFieldArray } from 'react-hook-form';
import { AlertTriangle, Banknote, Eye, HandCoins, Pencil, Plus, Receipt, Trash2, Wallet, XCircle } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  expenseSchema,
  INVOICE_LINE_KINDS,
  INVOICE_LINE_KIND_LABELS,
  INVOICE_STATUS_LABELS,
  invoiceSchema,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  paymentSchema,
  type ExpenseDTO,
  type InvoiceDTO,
  type PaymentDTO,
} from '@workspace/api-zod';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { useApiMutation, useDossierOptions } from '@/hooks/use-data';
import { fcfa, formatShortDate, todayIso } from '@/lib/format';
import { replaceQueryParam } from "@/lib/url";
import { ConfirmDialog, EmptyState, ErrorState, Field, FilterSelect, inputClass, LoadingState, NativeSelect, PageHeader, Panel, StatCard, StatusPill, useConfirm } from '@/components/app/common';
import { PaymentPill } from '@/components/app/badges';
import { applyServerErrors, fieldError, FormDialog, useZodForm } from '@/components/app/form';
import { PdfPreviewDialog } from '@/components/forms/DocumentDialogs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Summary {
  invoiced: number;
  collected: number;
  outstanding: number;
  overdue: number;
  unpaidCount: number;
  expenses: number;
}

const INVALIDATE = [['invoices'], ['invoice'], ['payments'], ['billing'], ['dossier']];

function InvoiceFormDialog({ open, onOpenChange, invoice, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; invoice?: InvoiceDTO | null; onSaved?: (i: InvoiceDTO) => void }) {
  const dossiers = useDossierOptions();
  const form = useZodForm(
    invoiceSchema,
    invoice
      ? {
          dossierId: String(invoice.dossier.id),
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          status: invoice.status,
          notes: invoice.notes ?? '',
          lines: invoice.lines?.map((l) => ({ description: l.description, kind: l.kind, quantity: String(l.quantity), unitPrice: String(l.unitPrice) })) ?? [],
        }
      : { dossierId: '', issueDate: todayIso(), dueDate: todayIso(30), status: 'emise', notes: '', lines: [{ description: 'Honoraires', kind: 'honoraires', quantity: '1', unitPrice: '' }] },
    [open, invoice?.id],
  );
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const watched = (form.watch('lines') as { quantity: string; unitPrice: string }[]) ?? [];
  const total = watched.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const mutation = useApiMutation((v: Record<string, unknown>) => (invoice ? api.patch<InvoiceDTO>(`/invoices/${invoice.id}`, v) : api.post<InvoiceDTO>('/invoices', v)), {
    success: (i) => (invoice ? `Facture ${i.number} mise à jour.` : `Facture ${i.number} créée (${fcfa(i.total)}).`),
    invalidate: INVALIDATE,
    onSuccess: (i) => {
      onOpenChange(false);
      onSaved?.(i);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={invoice ? `Modifier la facture ${invoice.number}` : 'Nouvelle facture'} description="Montants en francs CFA (FCFA), sans décimales." onSubmit={submit} pending={mutation.isPending} wide footerExtra={<span className="tabular text-sm font-semibold text-foreground">Total : {fcfa(total)}</span>}>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Dossier (le client facturé est le client principal)" required error={err('dossierId')} className="sm:col-span-4">
          <NativeSelect {...form.register('dossierId')}>
            <option value="">Sélectionner…</option>
            {dossiers.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.reference} — {d.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date d’émission" required error={err('issueDate')}>
          <input type="date" className={inputClass} {...form.register('issueDate')} />
        </Field>
        <Field label="Échéance" required error={err('dueDate')}>
          <input type="date" className={inputClass} {...form.register('dueDate')} />
        </Field>
        <Field label="Statut" error={err('status')} className="sm:col-span-2">
          <NativeSelect {...form.register('status')}>
            {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="rounded-lg border">
        <div className="grid grid-cols-[1fr_120px_70px_130px_32px] gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground max-sm:hidden">
          <span>Désignation</span>
          <span>Nature</span>
          <span>Qté</span>
          <span>Prix unitaire</span>
          <span />
        </div>
        <div className="space-y-2 p-3">
          {lines.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_120px_70px_130px_32px]">
              <input className={`${inputClass} col-span-2 sm:col-span-1`} placeholder="Désignation" aria-invalid={!!err(`lines.${i}.description`)} {...form.register(`lines.${i}.description`)} />
              <NativeSelect {...form.register(`lines.${i}.kind`)}>
                {INVOICE_LINE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {INVOICE_LINE_KIND_LABELS[k]}
                  </option>
                ))}
              </NativeSelect>
              <input type="number" min={1} className={inputClass} {...form.register(`lines.${i}.quantity`)} />
              <input type="number" min={0} step={1000} className={inputClass} placeholder="FCFA" aria-invalid={!!err(`lines.${i}.unitPrice`)} {...form.register(`lines.${i}.unitPrice`)} />
              <Button type="button" variant="ghost" size="icon" className="size-9 text-red-600" onClick={() => lines.remove(i)} disabled={lines.fields.length === 1} aria-label="Retirer la ligne">
                <Trash2 />
              </Button>
            </div>
          ))}
          {err('lines') && <div className="text-xs text-red-600">{err('lines')}</div>}
          <Button type="button" variant="outline" size="sm" onClick={() => lines.append({ description: '', kind: 'frais', quantity: '1', unitPrice: '' })}>
            <Plus /> Ajouter une ligne
          </Button>
        </div>
      </div>
      <Field label="Notes (mentions sur la facture)" error={err('notes')}>
        <input className={inputClass} {...form.register('notes')} />
      </Field>
    </FormDialog>
  );
}

function PaymentFormDialog({ open, onOpenChange, invoice }: { open: boolean; onOpenChange: (o: boolean) => void; invoice: InvoiceDTO }) {
  const form = useZodForm(paymentSchema, { amount: String(invoice.balance), paidAt: todayIso(), method: 'virement', reference: '', notes: '' }, [open, invoice.id]);
  const mutation = useApiMutation((v: Record<string, unknown>) => api.post<InvoiceDTO>(`/invoices/${invoice.id}/payments`, v), {
    success: (i) => (i.paymentState === 'payee' ? `Facture ${i.number} soldée.` : `Paiement partiel enregistré — reste ${fcfa(i.balance)}.`),
    invalidate: INVALIDATE,
    onSuccess: () => onOpenChange(false),
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Encaisser — facture ${invoice.number}`} description={`Reste à payer : ${fcfa(invoice.balance)}. Un montant inférieur enregistre un paiement partiel.`} onSubmit={submit} pending={mutation.isPending}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Montant (FCFA)" required error={err('amount')}>
          <input type="number" min={1} max={invoice.balance} className={inputClass} {...form.register('amount')} />
        </Field>
        <Field label="Date du paiement" required error={err('paidAt')}>
          <input type="date" className={inputClass} {...form.register('paidAt')} />
        </Field>
        <Field label="Mode de paiement" required error={err('method')}>
          <NativeSelect {...form.register('method')}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Référence" error={err('reference')}>
          <input className={inputClass} placeholder="N° de chèque, de virement…" {...form.register('reference')} />
        </Field>
      </div>
    </FormDialog>
  );
}

function ExpenseFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const dossiers = useDossierOptions();
  const form = useZodForm(expenseSchema, { dossierId: '', expenseDate: todayIso(), category: 'greffe', description: '', amount: '', rebillable: true }, [open]);
  const mutation = useApiMutation((v: Record<string, unknown>) => api.post<ExpenseDTO>('/expenses', v), { success: 'Dépense enregistrée.', invalidate: [['expenses'], ['billing']], onSuccess: () => onOpenChange(false) });
  const submit = form.handleSubmit((v) => mutation.mutate(v, { onError: (e) => applyServerErrors(form, e) }));
  const err = (n: string) => fieldError(form, n);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Enregistrer une dépense" onSubmit={submit} pending={mutation.isPending}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Description" required error={err('description')} className="sm:col-span-2">
          <input className={inputClass} placeholder="Ex. : Frais de greffe — enrôlement" {...form.register('description')} />
        </Field>
        <Field label="Catégorie" required error={err('category')}>
          <NativeSelect {...form.register('category')}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Montant (FCFA)" required error={err('amount')}>
          <input type="number" min={1} className={inputClass} {...form.register('amount')} />
        </Field>
        <Field label="Date" required error={err('expenseDate')}>
          <input type="date" className={inputClass} {...form.register('expenseDate')} />
        </Field>
        <Field label="Dossier" error={err('dossierId')}>
          <NativeSelect {...form.register('dossierId')}>
            <option value="">— Frais généraux du cabinet —</option>
            {dossiers.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.reference} — {d.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="size-4 accent-[#14213d]" {...form.register('rebillable')} /> Refacturable au client
        </label>
      </div>
    </FormDialog>
  );
}

function InvoiceDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { can } = useSession();
  const inv = useQuery({ queryKey: ['invoice', id], queryFn: () => api.get<InvoiceDTO>(`/invoices/${id}`) });
  const [pdf, setPdf] = useState(false);
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const delPay = useConfirm<PaymentDTO>();
  const removePayment = useApiMutation((p: PaymentDTO) => api.delete(`/payments/${p.id}`), { success: 'Règlement annulé.', invalidate: INVALIDATE, onSuccess: () => delPay.close() });
  const i = inv.data;
  const write = can('billing.write');
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          {!i ? (
            <LoadingState />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 font-serif text-xl">
                  Facture {i.number} <PaymentPill state={i.paymentState} />
                  {i.status !== 'emise' && <StatusPill tone="gray">{INVOICE_STATUS_LABELS[i.status]}</StatusPill>}
                  {i.overdue && <StatusPill tone="red">En retard</StatusPill>}
                </DialogTitle>
                <DialogDescription>
                  {i.client.displayName} ·{' '}
                  <Link href={`/dossiers/${i.dossier.id}`} className="hover:underline">
                    {i.dossier.reference}
                  </Link>{' '}
                  · émise le {formatShortDate(i.issueDate)} · échéance {formatShortDate(i.dueDate)}
                </DialogDescription>
              </DialogHeader>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">Désignation</th>
                    <th className="py-2 text-right font-medium">Qté</th>
                    <th className="py-2 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {i.lines?.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2">
                        {l.description}
                        <div className="text-xs text-muted-foreground">{INVOICE_LINE_KIND_LABELS[l.kind]}</div>
                      </td>
                      <td className="tabular py-2 text-right">{l.quantity}</td>
                      <td className="tabular py-2 text-right">{fcfa(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-center">
                <div>
                  <div className="text-[11px] text-muted-foreground">Total</div>
                  <div className="tabular font-semibold">{fcfa(i.total)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Réglé</div>
                  <div className="tabular font-semibold text-emerald-700">{fcfa(i.paid)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Reste dû</div>
                  <div className="tabular font-semibold text-red-700">{fcfa(i.balance)}</div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold">Règlements</div>
                {!i.payments?.length ? (
                  <p className="text-xs text-muted-foreground">Aucun règlement enregistré.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {i.payments.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="text-xs text-muted-foreground">{formatShortDate(p.paidAt)}</span>
                        <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
                        {p.reference && <span className="font-mono text-xs text-muted-foreground">{p.reference}</span>}
                        <span className="tabular ml-auto font-medium">{fcfa(p.amount)}</span>
                        {write && (
                          <button onClick={() => delPay.ask(p)} className="rounded p-1 text-red-600 hover:bg-red-50" aria-label="Annuler le règlement">
                            <XCircle className="size-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setPdf(true)}>
                  <Eye /> Aperçu PDF
                </Button>
                {write && (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil /> Modifier
                  </Button>
                )}
                {write && i.status === 'emise' && i.balance > 0 && (
                  <Button onClick={() => setPaying(true)}>
                    <HandCoins /> Enregistrer un paiement
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {i && <PdfPreviewDialog open={pdf} onOpenChange={setPdf} title={`Facture ${i.number}`} path={`/invoices/${i.id}/pdf?p=${i.paid}`} />}
      {i && paying && <PaymentFormDialog open onOpenChange={setPaying} invoice={i} />}
      {i && editing && <InvoiceFormDialog open onOpenChange={setEditing} invoice={i} />}
      <ConfirmDialog
        open={delPay.open}
        onOpenChange={(o) => !o && delPay.close()}
        title="Annuler ce règlement ?"
        description={`Le règlement de ${fcfa(delPay.target?.amount ?? 0)} sera supprimé et le reste dû recalculé.`}
        confirmLabel="Annuler le règlement"
        destructive
        pending={removePayment.isPending}
        onConfirm={() => delPay.target && removePayment.mutate(delPay.target)}
      />
    </>
  );
}

export default function FacturationPage() {
  const { can } = useSession();
  const [state, setState] = useState('tous');
  const [openId, setOpenId] = useState<number | null>(() => Number(readParam('facture')) || null);
  const [creating, setCreating] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const summary = useQuery({ queryKey: ['billing', 'summary'], queryFn: () => api.get<Summary>('/billing/summary') });
  const invoices = useQuery({ queryKey: ['invoices', { state }], queryFn: () => api.get<InvoiceDTO[]>('/invoices', { state }) });
  const payments = useQuery({ queryKey: ['payments'], queryFn: () => api.get<PaymentDTO[]>('/payments') });
  const expenses = useQuery({ queryKey: ['expenses'], queryFn: () => api.get<ExpenseDTO[]>('/expenses') });
  const delExp = useConfirm<ExpenseDTO>();
  const removeExpense = useApiMutation((e: ExpenseDTO) => api.delete(`/expenses/${e.id}`), { success: 'Dépense supprimée.', invalidate: [['expenses'], ['billing']], onSuccess: () => delExp.close() });
  const s = summary.data;
  const open = (id: number | null) => {
    setOpenId(id);
    replaceQueryParam('facture', id ? String(id) : null);
  };

  return (
    <>
      <PageHeader
        title="Facturation"
        description="Honoraires, factures, encaissements (y compris partiels) et dépenses du cabinet. Montants en francs CFA."
        actions={
          can('billing.write') && (
            <>
              <Button variant="outline" onClick={() => setAddingExpense(true)}>
                <Wallet /> Dépense
              </Button>
              <Button onClick={() => setCreating(true)}>
                <Plus /> Nouvelle facture
              </Button>
            </>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Montant facturé" value={s ? fcfa(s.invoiced) : '…'} icon={Receipt} />
        <StatCard label="Encaissé" value={s ? fcfa(s.collected) : '…'} icon={Banknote} tone="green" />
        <StatCard label="Reste à encaisser" value={s ? fcfa(s.outstanding) : '…'} icon={HandCoins} tone="orange" hint={s ? `${s.unpaidCount} facture(s) non soldée(s)` : undefined} onClick={() => setState('ouvertes')} />
        <StatCard label="Impayés échus" value={s ? fcfa(s.overdue) : '…'} icon={AlertTriangle} tone="red" onClick={() => setState('retard')} />
      </div>

      <Tabs defaultValue="factures">
        <TabsList className="mb-4">
          <TabsTrigger value="factures">Factures</TabsTrigger>
          <TabsTrigger value="paiements">Paiements</TabsTrigger>
          <TabsTrigger value="depenses">Dépenses</TabsTrigger>
        </TabsList>
        <TabsContent value="factures">
          <Panel bodyClassName="p-0">
            <div className="flex flex-wrap gap-2 border-b border-border/70 p-4">
              <FilterSelect
                label="Situation"
                value={state}
                onChange={setState}
                options={[
                  { value: 'tous', label: 'Toutes les factures' },
                  { value: 'ouvertes', label: 'Non soldées' },
                  { value: 'impayee', label: 'Impayées' },
                  { value: 'partielle', label: 'Paiement partiel' },
                  { value: 'payee', label: 'Payées' },
                  { value: 'retard', label: 'En retard' },
                ]}
              />
            </div>
            {invoices.isLoading ? (
              <LoadingState />
            ) : invoices.error ? (
              <div className="p-4">
                <ErrorState error={invoices.error} />
              </div>
            ) : !invoices.data?.length ? (
              <div className="p-6">
                <EmptyState title="Aucune facture" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Facture</TableHead>
                    <TableHead className="hidden md:table-cell">Client / dossier</TableHead>
                    <TableHead className="hidden sm:table-cell">Échéance</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">Reste dû</TableHead>
                    <TableHead className="pr-5">Paiement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.data.map((i) => (
                    <TableRow key={i.id} className="cursor-pointer" onClick={() => open(i.id)}>
                      <TableCell className="pl-5">
                        <div className="font-mono text-xs font-medium">{i.number}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatShortDate(i.issueDate)}
                          {i.status !== 'emise' && ` · ${INVOICE_STATUS_LABELS[i.status]}`}
                        </div>
                      </TableCell>
                      <TableCell className="hidden max-w-[300px] md:table-cell">
                        <div className="truncate text-sm">{i.client.displayName}</div>
                        <div className="truncate font-mono text-xs text-[#8a6d2b]">{i.dossier.reference}</div>
                      </TableCell>
                      <TableCell className={`hidden text-sm sm:table-cell ${i.overdue ? 'font-medium text-red-600' : ''}`}>{formatShortDate(i.dueDate)}</TableCell>
                      <TableCell className="tabular text-right text-sm font-medium">{fcfa(i.total)}</TableCell>
                      <TableCell className="tabular hidden text-right text-sm lg:table-cell">{i.balance ? fcfa(i.balance) : '—'}</TableCell>
                      <TableCell className="pr-5">
                        <PaymentPill state={i.paymentState} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="paiements">
          <Panel bodyClassName="p-0">
            {!payments.data?.length ? (
              <div className="p-6">
                <EmptyState title="Aucun paiement" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Date</TableHead>
                    <TableHead>Facture</TableHead>
                    <TableHead className="hidden sm:table-cell">Mode</TableHead>
                    <TableHead className="hidden md:table-cell">Référence</TableHead>
                    <TableHead className="pr-5 text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.data.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => open(p.invoiceId)}>
                      <TableCell className="pl-5 text-sm">{formatShortDate(p.paidAt)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.invoiceNumber}</TableCell>
                      <TableCell className="hidden text-sm sm:table-cell">{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{p.reference ?? '—'}</TableCell>
                      <TableCell className="tabular pr-5 text-right text-sm font-medium">{fcfa(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="depenses">
          <Panel bodyClassName="p-0" title="Dépenses et débours" description={s ? `Total : ${fcfa(s.expenses)}` : undefined}>
            {!expenses.data?.length ? (
              <div className="p-6">
                <EmptyState title="Aucune dépense" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="hidden md:table-cell">Dossier</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="w-12 pr-5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-5 text-sm">{formatShortDate(e.expenseDate)}</TableCell>
                      <TableCell>
                        <div className="text-sm">{e.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {EXPENSE_CATEGORY_LABELS[e.category]}
                          {e.rebillable ? ' · refacturable' : ''}
                        </div>
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">{e.dossier?.reference ?? 'Cabinet'}</TableCell>
                      <TableCell className="tabular text-right text-sm font-medium">{fcfa(e.amount)}</TableCell>
                      <TableCell className="pr-5">
                        {can('billing.write') && (
                          <button onClick={() => delExp.ask(e)} className="rounded p-1 text-red-600 hover:bg-red-50" aria-label="Supprimer">
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      {openId && <InvoiceDetail id={openId} onClose={() => open(null)} />}
      {creating && <InvoiceFormDialog open onOpenChange={setCreating} onSaved={(i) => open(i.id)} />}
      {addingExpense && <ExpenseFormDialog open onOpenChange={setAddingExpense} />}
      <ConfirmDialog
        open={delExp.open}
        onOpenChange={(o) => !o && delExp.close()}
        title="Supprimer cette dépense ?"
        description={delExp.target?.description}
        confirmLabel="Supprimer"
        destructive
        pending={removeExpense.isPending}
        onConfirm={() => delExp.target && removeExpense.mutate(delExp.target)}
      />
    </>
  );
}

/** Lecture ponctuelle du paramètre d'URL à l'initialisation. */
function readParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}
