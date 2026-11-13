/**
 * Formes des réponses de l'API (JSON). Les dates sont sérialisées en
 * chaînes : AAAA-MM-JJ pour les dates calendaires, ISO 8601 pour les
 * horodatages.
 */
import type {
  BordereauStatus,
  ClientStatus,
  ClientType,
  Confidentiality,
  DemarcheStatus,
  DemarcheType,
  DocumentCategory,
  DossierCategory,
  DossierStatus,
  EventStatus,
  EventType,
  ExpenseCategory,
  InvoiceLineKind,
  InvoiceStatus,
  PartyRole,
  PaymentMethod,
  PaymentState,
  RequeteStatus,
  Role,
  TaskPriority,
  TaskStatus,
  TemplateType,
} from "./enums";
import type { Permission } from "./permissions";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserRef {
  id: number;
  fullName: string;
  role: Role;
}

export interface UserDTO extends UserRef {
  firstName: string;
  lastName: string;
  email: string;
  title: string | null;
  phone: string | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SessionDTO {
  user: UserDTO;
  permissions: Permission[];
  cabinet: { id: number; name: string; city: string | null };
}

export interface DemoAccountDTO {
  id: number;
  fullName: string;
  role: Role;
  title: string | null;
  email: string;
}

export interface ClientDTO {
  id: number;
  type: ClientType;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  legalForm: string | null;
  registrationNumber: string | null;
  representativeName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  idNumber: string | null;
  notes: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
  dossierCount: number;
  activeDossierCount: number;
}

export interface DossierListItemDTO {
  id: number;
  reference: string;
  title: string;
  category: DossierCategory;
  procedureType: string;
  jurisdiction: string | null;
  status: DossierStatus;
  confidentiality: Confidentiality;
  openedAt: string;
  client: { id: number; displayName: string };
  responsible: UserRef;
  nextHearing: string | null;
  updatedAt: string;
}

export interface PartyDTO {
  id: number;
  clientId: number | null;
  name: string;
  role: PartyRole;
  counsel: string | null;
  notes: string | null;
}

export interface DossierDTO extends DossierListItemDTO {
  description: string | null;
  roleNumber: string | null;
  closedAt: string | null;
  members: UserRef[];
  parties: PartyDTO[];
  createdAt: string;
  counts: {
    documents: number;
    pieces: number;
    bordereaux: number;
    requetes: number;
    demarches: number;
    events: number;
    tasks: number;
    invoices: number;
  };
  canEdit: boolean;
}

export interface DocumentDTO {
  id: number;
  dossierId: number;
  dossierReference: string;
  demarcheId: number | null;
  name: string;
  category: DocumentCategory;
  description: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: UserRef | null;
  createdAt: string;
}

export interface PieceDTO {
  id: number;
  dossierId: number;
  position: number;
  designation: string;
  pages: number;
  pieceDate: string | null;
  observations: string | null;
  document: { id: number; name: string; mimeType: string } | null;
}

export interface BordereauItemDTO {
  id: number;
  position: number;
  pieceId: number | null;
  designation: string;
  pages: number;
  observations: string | null;
}

export interface BordereauDTO {
  id: number;
  dossierId: number;
  dossierReference: string;
  dossierTitle: string;
  reference: string;
  title: string;
  bordereauDate: string;
  jurisdiction: string | null;
  observations: string | null;
  status: BordereauStatus;
  totalPages: number;
  itemCount: number;
  items?: BordereauItemDTO[];
  createdBy: UserRef | null;
  createdAt: string;
}

export interface TemplateDTO {
  id: number;
  name: string;
  type: TemplateType;
  description: string | null;
  body: string;
  isSystem: boolean;
  createdBy: UserRef | null;
  createdAt: string;
  /** Champs `{{...}}` utilisés par le modèle et non remplis automatiquement. */
  customFields: string[];
}

export interface RequeteVersionDTO {
  id: number;
  version: number;
  title: string;
  content: string;
  comment: string | null;
  createdBy: UserRef | null;
  createdAt: string;
}

export interface RequeteDTO {
  id: number;
  dossierId: number;
  dossierReference: string;
  dossierTitle: string;
  templateId: number | null;
  templateName: string | null;
  type: TemplateType;
  title: string;
  content: string;
  status: RequeteStatus;
  currentVersion: number;
  createdBy: UserRef | null;
  validatedBy: UserRef | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: RequeteVersionDTO[];
}

export interface DemarcheDTO {
  id: number;
  dossierId: number;
  dossierReference: string;
  dossierTitle: string;
  type: DemarcheType;
  jurisdiction: string;
  assignee: UserRef;
  plannedDate: string;
  executedDate: string | null;
  status: DemarcheStatus;
  observations: string | null;
  result: string | null;
  documents: { id: number; name: string; mimeType: string }[];
  createdBy: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventDTO {
  id: number;
  type: EventType;
  title: string;
  dossier: { id: number; reference: string; title: string } | null;
  startAt: string;
  endAt: string;
  location: string | null;
  assignee: UserRef | null;
  description: string | null;
  reminderMinutes: number;
  status: EventStatus;
  createdBy: UserRef | null;
}

export interface TaskDTO {
  id: number;
  title: string;
  description: string | null;
  dossier: { id: number; reference: string; title: string } | null;
  assignee: UserRef;
  createdBy: UserRef | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
}

export interface InvoiceLineDTO {
  id: number;
  description: string;
  kind: InvoiceLineKind;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PaymentDTO {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  recordedBy: UserRef | null;
  createdAt: string;
}

export interface InvoiceDTO {
  id: number;
  number: string;
  dossier: { id: number; reference: string; title: string };
  client: { id: number; displayName: string };
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paymentState: PaymentState;
  total: number;
  paid: number;
  balance: number;
  overdue: boolean;
  notes: string | null;
  lines?: InvoiceLineDTO[];
  payments?: PaymentDTO[];
  createdAt: string;
}

export interface ExpenseDTO {
  id: number;
  dossier: { id: number; reference: string; title: string } | null;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  rebillable: boolean;
  recordedBy: UserRef | null;
  createdAt: string;
}

export interface AuditEntryDTO {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  dossier: { id: number; reference: string } | null;
  user: UserRef | null;
  createdAt: string;
}

export interface DashboardDTO {
  stats: {
    clients: number;
    activeDossiers: number;
    closedDossiers: number;
    upcomingHearings: number;
    pendingDemarches: number;
    openTasks: number;
    unpaidInvoices: number;
    unpaidAmount: number;
  };
  byCategory: { category: DossierCategory; count: number }[];
  byStatus: { status: DossierStatus; count: number }[];
  upcomingEvents: EventDTO[];
  urgent: UrgentItemDTO[];
  recentActivity: AuditEntryDTO[];
  myTasks: TaskDTO[];
}

export interface UrgentItemDTO {
  kind: "tache" | "evenement" | "demarche" | "facture";
  id: number;
  title: string;
  subtitle: string;
  date: string;
  overdue: boolean;
  href: string;
}

export interface NotificationDTO {
  id: string;
  kind: "rappel" | "retard" | "validation" | "assignation";
  title: string;
  body: string;
  date: string;
  href: string;
}

export interface SearchResultDTO {
  clients: { id: number; displayName: string; type: ClientType; city: string | null }[];
  dossiers: { id: number; reference: string; title: string; status: DossierStatus }[];
  documents: { id: number; name: string; dossierId: number; dossierReference: string }[];
}
