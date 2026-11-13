/**
 * Schéma de la base de données du cabinet.
 *
 * Toutes les entités de premier niveau portent un `cabinetId` afin de
 * permettre l'hébergement de plusieurs cabinets sur une même instance :
 * chaque requête de l'API filtre systématiquement sur le cabinet de
 * l'utilisateur connecté.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const day = (name: string) => date(name, { mode: "string" });

export const cabinetsTable = pgTable("cabinets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  barNumber: text("bar_number"),
  createdAt: createdAt(),
});

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    cabinetId: integer("cabinet_id").notNull().references(() => cabinetsTable.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    role: text("role").notNull(),
    title: text("title"),
    phone: text("phone"),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessionsTable = pgTable("sessions", {
  /** Empreinte SHA-256 du jeton : le jeton brut n'est jamais stocké. */
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: createdAt(),
});

export const clientsTable = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    cabinetId: integer("cabinet_id").notNull().references(() => cabinetsTable.id),
    type: text("type").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    companyName: text("company_name"),
    legalForm: text("legal_form"),
    registrationNumber: text("registration_number"),
    representativeName: text("representative_name"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    idNumber: text("id_number"),
    notes: text("notes"),
    status: text("status").notNull().default("actif"),
    createdBy: integer("created_by").references(() => usersTable.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("clients_cabinet_idx").on(t.cabinetId)],
);

export const dossiersTable = pgTable(
  "dossiers",
  {
    id: serial("id").primaryKey(),
    cabinetId: integer("cabinet_id").notNull().references(() => cabinetsTable.id),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clientsTable.id),
    category: text("category").notNull(),
    procedureType: text("procedure_type").notNull(),
    jurisdiction: text("jurisdiction"),
    responsibleId: integer("responsible_id")
      .notNull()
      .references(() => usersTable.id),
    status: text("status").notNull().default("nouveau"),
    confidentiality: text("confidentiality").notNull().default("standard"),
    openedAt: day("opened_at").notNull(),
    closedAt: day("closed_at"),
    roleNumber: text("role_number"),
    description: text("description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("dossiers_reference_idx").on(t.cabinetId, t.reference),
    index("dossiers_client_idx").on(t.clientId),
  ],
);

export const dossierMembersTable = pgTable(
  "dossier_members",
  {
    dossierId: integer("dossier_id")
      .notNull()
      .references(() => dossiersTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.dossierId, t.userId] })],
);

export const dossierPartiesTable = pgTable("dossier_parties", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossier_id")
    .notNull()
    .references(() => dossiersTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clientsTable.id),
  name: text("name").notNull(),
  role: text("role").notNull(),
  counsel: text("counsel"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const demarchesTable = pgTable(
  "demarches",
  {
    id: serial("id").primaryKey(),
    cabinetId: integer("cabinet_id").notNull().references(() => cabinetsTable.id),
    dossierId: integer("dossier_id")
      .notNull()
      .references(() => dossiersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    assigneeId: integer("assignee_id")
      .notNull()
      .references(() => usersTable.id),
    plannedDate: day("planned_date").notNull(),
    executedDate: day("executed_date"),
    status: text("status").notNull().default("a_effectuer"),
    observations: text("observations"),
    result: text("result"),
    createdBy: integer("created_by").references(() => usersTable.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("demarches_dossier_idx").on(t.dossierId)],
);

export const documentsTable = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    dossierId: integer("dossier_id")
      .notNull()
      .references(() => dossiersTable.id, { onDelete: "cascade" }),
    demarcheId: integer("demarche_id").references(() => demarchesTable.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("piece"),
    description: text("description"),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    /** Nom de fichier aléatoire sur disque (jamais dérivé du nom d'origine). */
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256").notNull(),
    uploadedBy: integer("uploaded_by").references(() => usersTable.id),
    createdAt: createdAt(),
  },
  (t) => [index("documents_dossier_idx").on(t.dossierId)],
);

export const piecesTable = pgTable(
  "pieces",
  {
    id: serial("id").primaryKey(),
    dossierId: integer("dossier_id")
      .notNull()
      .references(() => dossiersTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    designation: text("designation").notNull(),
    pages: integer("pages").notNull().default(1),
    pieceDate: day("piece_date"),
    observations: text("observations"),
    documentId: integer("document_id").references(() => documentsTable.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("pieces_dossier_idx").on(t.dossierId)],
);

export const bordereauxTable = pgTable("bordereaux", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossier_id")
    .notNull()
    .references(() => dossiersTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(),
  title: text("title").notNull(),
  bordereauDate: day("bordereau_date").notNull(),
  jurisdiction: text("jurisdiction"),
  observations: text("observations"),
  status: text("status").notNull().default("brouillon"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: createdAt(),
});

/**
 * Lignes figées d'un bordereau : la liste communiquée ne doit pas changer
 * si les pièces du dossier sont modifiées ultérieurement.
 */
export const bordereauItemsTable = pgTable("bordereau_items", {
  id: serial("id").primaryKey(),
  bordereauId: integer("bordereau_id")
    .notNull()
    .references(() => bordereauxTable.id, { onDelete: "cascade" }),
  pieceId: integer("piece_id").references(() => piecesTable.id, { onDelete: "set null" }),
  position: integer("position").notNull(),
  designation: text("designation").notNull(),
  pages: integer("pages").notNull(),
  observations: text("observations"),
});

export const templatesTable = pgTable("templates", {
  id: serial("id").primaryKey(),
  cabinetId: integer("cabinet_id").notNull().references(() => cabinetsTable.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  body: text("body").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: createdAt(),
});

export const requetesTable = pgTable(
  "requetes",
  {
    id: serial("id").primaryKey(),
    dossierId: integer("dossier_id")
      .notNull()
      .references(() => dossiersTable.id, { onDelete: "cascade" }),
    templateId: integer("template_id").references(() => templatesTable.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    status: text("status").notNull().default("brouillon"),
    currentVersion: integer("current_version").notNull().default(1),
    createdBy: integer("created_by").references(() => usersTable.id),
    validatedBy: integer("validated_by").references(() => usersTable.id),
    validatedAt: timestamp("validated_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("requetes_dossier_idx").on(t.dossierId)],
);

export const requeteVersionsTable = pgTable("requete_versions", {
  id: serial("id").primaryKey(),
  requeteId: integer("requete_id")
    .notNull()
    .references(() => requetesTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  comment: text("comment"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: createdAt(),
});

export const eventsTable = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    cabinetId: integer("cabinet_id").notNull().references(() => cabinetsTable.id),
    dossierId: integer("dossier_id").references(() => dossiersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    startAt: timestamp("start_at", { withTimezone: true, mode: "date" }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true, mode: "date" }).notNull(),
    location: text("location"),
    assigneeId: integer("assignee_id").references(() => usersTable.id),
    description: text("description"),
    reminderMinutes: integer("reminder_minutes").notNull().default(1440),
    status: text("status").notNull().default("prevu"),
    createdBy: integer("created_by").references(() => usersTable.id),
    createdAt: createdAt(),
  },
  (t) => [index("events_start_idx").on(t.cabinetId, t.startAt)],
);

export const tasksTable = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    cabinetId: integer("cabinet_id").notNull().references(() => cabinetsTable.id),
    dossierId: integer("dossier_id").references(() => dossiersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    assigneeId: integer("assignee_id")
      .notNull()
      .references(() => usersTable.id),
    createdBy: integer("created_by").references(() => usersTable.id),
    dueDate: day("due_date"),
    priority: text("priority").notNull().default("normale"),
    status: text("status").notNull().default("a_faire"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_assignee_idx").on(t.assigneeId)],
);

export const invoicesTable = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    cabinetId: integer("cabinet_id").notNull().references(() => cabinetsTable.id),
    number: text("number").notNull(),
    dossierId: integer("dossier_id")
      .notNull()
      .references(() => dossiersTable.id),
    clientId: integer("client_id")
      .notNull()
      .references(() => clientsTable.id),
    issueDate: day("issue_date").notNull(),
    dueDate: day("due_date").notNull(),
    status: text("status").notNull().default("emise"),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => usersTable.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invoices_number_idx").on(t.cabinetId, t.number)],
);

export const invoiceLinesTable = pgTable("invoice_lines", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoicesTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  kind: text("kind").notNull().default("honoraires"),
  quantity: integer("quantity").notNull().default(1),
  /** Montants en FCFA (entiers). */
  unitPrice: integer("unit_price").notNull(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoicesTable.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  paidAt: day("paid_at").notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  recordedBy: integer("recorded_by").references(() => usersTable.id),
  createdAt: createdAt(),
});

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  cabinetId: integer("cabinet_id").notNull().references(() => cabinetsTable.id),
  dossierId: integer("dossier_id").references(() => dossiersTable.id, { onDelete: "set null" }),
  expenseDate: day("expense_date").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  rebillable: boolean("rebillable").notNull().default(true),
  recordedBy: integer("recorded_by").references(() => usersTable.id),
  createdAt: createdAt(),
});

/** Journal des opérations sensibles (et historique des dossiers). */
export const auditLogTable = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    cabinetId: integer("cabinet_id").notNull().references(() => cabinetsTable.id),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    dossierId: integer("dossier_id").references(() => dossiersTable.id, { onDelete: "set null" }),
    clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
    summary: text("summary").notNull(),
    meta: jsonb("meta"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_cabinet_idx").on(t.cabinetId, t.createdAt), index("audit_dossier_idx").on(t.dossierId)],
);

export type User = typeof usersTable.$inferSelect;
export type Client = typeof clientsTable.$inferSelect;
export type Dossier = typeof dossiersTable.$inferSelect;
export type DocumentRow = typeof documentsTable.$inferSelect;
export type Piece = typeof piecesTable.$inferSelect;
export type Bordereau = typeof bordereauxTable.$inferSelect;
export type Template = typeof templatesTable.$inferSelect;
export type Requete = typeof requetesTable.$inferSelect;
export type Demarche = typeof demarchesTable.$inferSelect;
export type EventRow = typeof eventsTable.$inferSelect;
export type Task = typeof tasksTable.$inferSelect;
export type Invoice = typeof invoicesTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type Expense = typeof expensesTable.$inferSelect;
