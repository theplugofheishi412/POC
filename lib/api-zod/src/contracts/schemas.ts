import { z } from "zod";
import {
  BORDEREAU_STATUSES,
  CLIENT_TYPES,
  CONFIDENTIALITY_LEVELS,
  DEMARCHE_STATUSES,
  DEMARCHE_TYPES,
  DOCUMENT_CATEGORIES,
  DOSSIER_CATEGORIES,
  DOSSIER_STATUSES,
  EVENT_STATUSES,
  EVENT_TYPES,
  EXPENSE_CATEGORIES,
  INVOICE_LINE_KINDS,
  INVOICE_STATUSES,
  PARTY_ROLES,
  PAYMENT_METHODS,
  ROLES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TEMPLATE_TYPES,
} from "./enums";

/* ------------------------------------------------------------------ */
/* Briques communes                                                    */
/* ------------------------------------------------------------------ */

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/** Texte facultatif : une chaîne vide devient `null`. */
export const optionalText = (max = 2000) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const requiredText = (label: string, max = 300) =>
  z
    .string({ required_error: `${label} est obligatoire` })
    .trim()
    .min(1, `${label} est obligatoire`)
    .max(max, `${label} : ${max} caractères maximum`);

/** Date calendaire au format AAAA-MM-JJ. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)");
export const optionalIsoDate = z.preprocess(emptyToNull, isoDate.nullable().optional());

/** Date et heure ISO 8601. */
export const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Date et heure invalides");

const optionalId = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.number().int().positive().nullable().optional(),
);
const requiredId = (label: string) =>
  z.coerce.number({ invalid_type_error: `${label} est obligatoire` }).int().positive(`${label} est obligatoire`);

const phone = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(30)
    .regex(/^[+0-9 ().-]{6,30}$/, "Numéro de téléphone invalide")
    .nullable()
    .optional(),
);
const email = z.preprocess(
  emptyToNull,
  z.string().trim().toLowerCase().email("Adresse email invalide").max(200).nullable().optional(),
);

/** Montant en FCFA (entier, pas de centimes). */
const amount = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} invalide` })
    .int(`${label} : montant entier en FCFA`)
    .min(0, `${label} doit être positif`)
    .max(10_000_000_000);

/* ------------------------------------------------------------------ */
/* Authentification et utilisateurs                                   */
/* ------------------------------------------------------------------ */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe obligatoire"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const demoLoginSchema = z.object({ userId: z.coerce.number().int().positive() });

export const userCreateSchema = z.object({
  firstName: requiredText("Le prénom", 100),
  lastName: requiredText("Le nom", 100),
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  role: z.enum(ROLES),
  title: optionalText(120),
  phone,
  password: z.string().min(8, "8 caractères minimum"),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = userCreateSchema
  .omit({ password: true })
  .partial()
  .extend({
    active: z.boolean().optional(),
    password: z.preprocess(emptyToNull, z.string().min(8, "8 caractères minimum").nullable().optional()),
  });
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/* ------------------------------------------------------------------ */
/* Clients et justiciables                                            */
/* ------------------------------------------------------------------ */

export const clientSchema = z
  .object({
    type: z.enum(CLIENT_TYPES),
    firstName: optionalText(100),
    lastName: optionalText(100),
    companyName: optionalText(200),
    legalForm: optionalText(60),
    registrationNumber: optionalText(80),
    representativeName: optionalText(160),
    phone,
    email,
    address: optionalText(300),
    city: optionalText(100),
    idNumber: optionalText(60),
    notes: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    if (v.type === "physique") {
      if (!v.lastName) ctx.addIssue({ code: "custom", path: ["lastName"], message: "Le nom est obligatoire" });
      if (!v.firstName) ctx.addIssue({ code: "custom", path: ["firstName"], message: "Le prénom est obligatoire" });
    } else if (!v.companyName) {
      ctx.addIssue({ code: "custom", path: ["companyName"], message: "La raison sociale est obligatoire" });
    }
    if (!v.phone && !v.email) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Indiquez au moins un téléphone ou un email" });
    }
  });
export type ClientInput = z.infer<typeof clientSchema>;

/* ------------------------------------------------------------------ */
/* Dossiers                                                           */
/* ------------------------------------------------------------------ */

export const dossierSchema = z.object({
  title: requiredText("L'intitulé", 250),
  clientId: requiredId("Le client principal"),
  category: z.enum(DOSSIER_CATEGORIES),
  procedureType: requiredText("Le type de procédure", 150),
  jurisdiction: optionalText(200),
  responsibleId: requiredId("L'avocat responsable"),
  status: z.enum(DOSSIER_STATUSES).default("nouveau"),
  confidentiality: z.enum(CONFIDENTIALITY_LEVELS).default("standard"),
  openedAt: isoDate,
  roleNumber: optionalText(80),
  description: optionalText(6000),
  memberIds: z.array(z.coerce.number().int().positive()).default([]),
});
export type DossierInput = z.infer<typeof dossierSchema>;

export const dossierStatusSchema = z.object({
  status: z.enum(DOSSIER_STATUSES),
  comment: optionalText(500),
});

export const partySchema = z
  .object({
    clientId: optionalId,
    name: optionalText(200),
    role: z.enum(PARTY_ROLES),
    counsel: optionalText(200),
    notes: optionalText(1000),
  })
  .refine((v) => v.clientId || v.name, { path: ["name"], message: "Sélectionnez un client ou saisissez un nom" });
export type PartyInput = z.infer<typeof partySchema>;

/* ------------------------------------------------------------------ */
/* Pièces, bordereaux, documents                                      */
/* ------------------------------------------------------------------ */

export const pieceSchema = z.object({
  designation: requiredText("La désignation", 300),
  pages: z.coerce.number().int().min(1, "Au moins 1 page").max(5000),
  pieceDate: optionalIsoDate,
  observations: optionalText(1000),
  documentId: optionalId,
});
export type PieceInput = z.infer<typeof pieceSchema>;

export const reorderSchema = z.object({ ids: z.array(z.number().int().positive()).min(1) });

export const bordereauSchema = z.object({
  title: requiredText("L'intitulé", 250),
  bordereauDate: isoDate,
  jurisdiction: optionalText(200),
  observations: optionalText(2000),
  pieceIds: z.array(z.number().int().positive()).min(1, "Sélectionnez au moins une pièce"),
});
export type BordereauInput = z.infer<typeof bordereauSchema>;

export const bordereauUpdateSchema = bordereauSchema
  .omit({ pieceIds: true })
  .partial()
  .extend({ status: z.enum(BORDEREAU_STATUSES).optional() });

export const documentMetaSchema = z.object({
  name: requiredText("Le nom du document", 250),
  category: z.enum(DOCUMENT_CATEGORIES).default("piece"),
  description: optionalText(1000),
  demarcheId: optionalId,
});
export type DocumentMetaInput = z.infer<typeof documentMetaSchema>;

/* ------------------------------------------------------------------ */
/* Modèles et requêtes                                                */
/* ------------------------------------------------------------------ */

export const templateSchema = z.object({
  name: requiredText("Le nom du modèle", 200),
  type: z.enum(TEMPLATE_TYPES),
  description: optionalText(500),
  body: requiredText("Le contenu du modèle", 50_000),
});
export type TemplateInput = z.infer<typeof templateSchema>;

export const requeteCreateSchema = z.object({
  dossierId: requiredId("Le dossier"),
  templateId: optionalId,
  title: requiredText("L'intitulé", 250),
  /** Champs complémentaires saisis par l'utilisateur pour remplir le modèle. */
  fields: z.record(z.string().max(5000)).default({}),
});
export type RequeteCreateInput = z.infer<typeof requeteCreateSchema>;

export const requeteUpdateSchema = z.object({
  title: requiredText("L'intitulé", 250).optional(),
  content: z.string().max(100_000).optional(),
  comment: optionalText(300),
});
export type RequeteUpdateInput = z.infer<typeof requeteUpdateSchema>;

export const requeteDecisionSchema = z.object({ comment: optionalText(500) });

/* ------------------------------------------------------------------ */
/* Démarches au palais                                                */
/* ------------------------------------------------------------------ */

export const demarcheSchema = z
  .object({
    dossierId: requiredId("Le dossier"),
    type: z.enum(DEMARCHE_TYPES),
    jurisdiction: requiredText("La juridiction", 200),
    assigneeId: requiredId("La personne chargée"),
    plannedDate: isoDate,
    executedDate: optionalIsoDate,
    status: z.enum(DEMARCHE_STATUSES).default("a_effectuer"),
    observations: optionalText(2000),
    result: optionalText(500),
  })
  .refine((v) => v.status !== "effectuee" || !!v.executedDate, {
    path: ["executedDate"],
    message: "La date d'exécution est obligatoire pour une démarche effectuée",
  });
export type DemarcheInput = z.infer<typeof demarcheSchema>;

/* ------------------------------------------------------------------ */
/* Agenda                                                             */
/* ------------------------------------------------------------------ */

export const eventSchema = z
  .object({
    type: z.enum(EVENT_TYPES),
    title: requiredText("L'intitulé", 200),
    dossierId: optionalId,
    startAt: isoDateTime,
    endAt: isoDateTime,
    location: optionalText(200),
    assigneeId: optionalId,
    description: optionalText(2000),
    reminderMinutes: z.coerce.number().int().min(0).max(10080).default(1440),
    status: z.enum(EVENT_STATUSES).default("prevu"),
  })
  .refine((v) => Date.parse(v.endAt) >= Date.parse(v.startAt), {
    path: ["endAt"],
    message: "La fin doit être postérieure au début",
  });
export type EventInput = z.infer<typeof eventSchema>;

/* ------------------------------------------------------------------ */
/* Tâches                                                             */
/* ------------------------------------------------------------------ */

export const taskSchema = z.object({
  title: requiredText("Le titre", 200),
  description: optionalText(3000),
  dossierId: optionalId,
  assigneeId: requiredId("Le responsable"),
  dueDate: optionalIsoDate,
  priority: z.enum(TASK_PRIORITIES).default("normale"),
  status: z.enum(TASK_STATUSES).default("a_faire"),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const taskStatusSchema = z.object({ status: z.enum(TASK_STATUSES) });

/* ------------------------------------------------------------------ */
/* Facturation                                                        */
/* ------------------------------------------------------------------ */

export const invoiceLineSchema = z.object({
  description: requiredText("La désignation", 300),
  kind: z.enum(INVOICE_LINE_KINDS).default("honoraires"),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitPrice: amount("Le prix unitaire"),
});

export const invoiceSchema = z.object({
  dossierId: requiredId("Le dossier"),
  issueDate: isoDate,
  dueDate: isoDate,
  status: z.enum(INVOICE_STATUSES).default("emise"),
  notes: optionalText(1000),
  lines: z.array(invoiceLineSchema).min(1, "Ajoutez au moins une ligne"),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const paymentSchema = z.object({
  amount: amount("Le montant").refine((v) => v > 0, "Le montant doit être supérieur à 0"),
  paidAt: isoDate,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(80),
  notes: optionalText(500),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const expenseSchema = z.object({
  dossierId: optionalId,
  expenseDate: isoDate,
  category: z.enum(EXPENSE_CATEGORIES),
  description: requiredText("La description", 300),
  amount: amount("Le montant").refine((v) => v > 0, "Le montant doit être supérieur à 0"),
  rebillable: z.boolean().default(true),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;
