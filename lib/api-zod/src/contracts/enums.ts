/**
 * Référentiels métier partagés entre l'API et le frontend.
 * Chaque énumération expose les valeurs techniques (stockées en base) et
 * leurs libellés français (affichés à l'utilisateur).
 */

function labels<T extends string>(map: Record<T, string>) {
  return map;
}

export const ROLES = [
  "admin",
  "associe",
  "collaborateur",
  "juriste",
  "stagiaire",
  "assistant",
  "comptable",
] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS = labels<Role>({
  admin: "Administrateur du cabinet",
  associe: "Avocat associé",
  collaborateur: "Avocat collaborateur",
  juriste: "Juriste",
  stagiaire: "Avocat stagiaire",
  assistant: "Assistant juridique",
  comptable: "Comptable",
});

export const CLIENT_TYPES = ["physique", "morale"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];
export const CLIENT_TYPE_LABELS = labels<ClientType>({
  physique: "Personne physique",
  morale: "Personne morale",
});

export const CLIENT_STATUSES = ["actif", "archive"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const CLIENT_STATUS_LABELS = labels<ClientStatus>({
  actif: "Actif",
  archive: "Archivé",
});

export const DOSSIER_CATEGORIES = [
  "commercial",
  "civil",
  "travail",
  "famille",
  "penal",
  "immobilier",
  "administratif",
  "recouvrement",
] as const;
export type DossierCategory = (typeof DOSSIER_CATEGORIES)[number];
export const DOSSIER_CATEGORY_LABELS = labels<DossierCategory>({
  commercial: "Droit commercial",
  civil: "Droit civil",
  travail: "Droit du travail",
  famille: "Droit de la famille",
  penal: "Droit pénal",
  immobilier: "Droit immobilier",
  administratif: "Droit administratif",
  recouvrement: "Recouvrement de créances",
});

export const DOSSIER_STATUSES = [
  "nouveau",
  "preparation",
  "en_cours",
  "en_attente",
  "audience_programmee",
  "decision_rendue",
  "cloture",
  "archive",
] as const;
export type DossierStatus = (typeof DOSSIER_STATUSES)[number];
export const DOSSIER_STATUS_LABELS = labels<DossierStatus>({
  nouveau: "Nouveau",
  preparation: "En préparation",
  en_cours: "En cours",
  en_attente: "En attente",
  audience_programmee: "Audience programmée",
  decision_rendue: "Décision rendue",
  cloture: "Clôturé",
  archive: "Archivé",
});
/** Statuts considérés comme « actifs » pour les indicateurs. */
export const ACTIVE_DOSSIER_STATUSES: DossierStatus[] = [
  "nouveau",
  "preparation",
  "en_cours",
  "en_attente",
  "audience_programmee",
  "decision_rendue",
];

export const CONFIDENTIALITY_LEVELS = ["standard", "restreint", "confidentiel"] as const;
export type Confidentiality = (typeof CONFIDENTIALITY_LEVELS)[number];
export const CONFIDENTIALITY_LABELS = labels<Confidentiality>({
  standard: "Standard",
  restreint: "Restreint",
  confidentiel: "Confidentiel",
});

export const PARTY_ROLES = ["demandeur", "defendeur", "representant", "intervenant", "autre"] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];
export const PARTY_ROLE_LABELS = labels<PartyRole>({
  demandeur: "Demandeur",
  defendeur: "Défendeur",
  representant: "Représentant",
  intervenant: "Intervenant",
  autre: "Autre partie",
});

export const DOCUMENT_CATEGORIES = [
  "piece",
  "acte",
  "correspondance",
  "decision",
  "justificatif",
  "autre",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
export const DOCUMENT_CATEGORY_LABELS = labels<DocumentCategory>({
  piece: "Pièce justificative",
  acte: "Acte de procédure",
  correspondance: "Correspondance",
  decision: "Décision de justice",
  justificatif: "Justificatif de démarche",
  autre: "Autre",
});

export const BORDEREAU_STATUSES = ["brouillon", "finalise"] as const;
export type BordereauStatus = (typeof BORDEREAU_STATUSES)[number];
export const BORDEREAU_STATUS_LABELS = labels<BordereauStatus>({
  brouillon: "Brouillon",
  finalise: "Finalisé",
});

export const TEMPLATE_TYPES = [
  "requete_introductive",
  "refere",
  "renvoi",
  "lettre_juridiction",
  "mise_en_demeure",
  "courrier_administratif",
  "autre",
] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];
export const TEMPLATE_TYPE_LABELS = labels<TemplateType>({
  requete_introductive: "Requête introductive d'instance",
  refere: "Requête en référé",
  renvoi: "Demande de renvoi",
  lettre_juridiction: "Lettre à une juridiction",
  mise_en_demeure: "Mise en demeure",
  courrier_administratif: "Courrier administratif",
  autre: "Autre document",
});

export const REQUETE_STATUSES = ["brouillon", "a_valider", "validee", "deposee"] as const;
export type RequeteStatus = (typeof REQUETE_STATUSES)[number];
export const REQUETE_STATUS_LABELS = labels<RequeteStatus>({
  brouillon: "Brouillon",
  a_valider: "À valider par un avocat",
  validee: "Validée par un avocat",
  deposee: "Déposée",
});

export const DEMARCHE_TYPES = [
  "depot_requete",
  "depot_pieces",
  "retrait_documents",
  "renseignements",
  "suivi_procedure",
  "consultation_dossier",
  "autre",
] as const;
export type DemarcheType = (typeof DEMARCHE_TYPES)[number];
export const DEMARCHE_TYPE_LABELS = labels<DemarcheType>({
  depot_requete: "Dépôt d'une requête",
  depot_pieces: "Dépôt de pièces",
  retrait_documents: "Retrait de documents",
  renseignements: "Demande de renseignements",
  suivi_procedure: "Suivi d'une procédure",
  consultation_dossier: "Consultation d'un dossier",
  autre: "Autre démarche",
});

export const DEMARCHE_STATUSES = ["a_effectuer", "en_cours", "effectuee", "en_attente", "reportee"] as const;
export type DemarcheStatus = (typeof DEMARCHE_STATUSES)[number];
export const DEMARCHE_STATUS_LABELS = labels<DemarcheStatus>({
  a_effectuer: "À effectuer",
  en_cours: "En cours",
  effectuee: "Effectuée",
  en_attente: "En attente",
  reportee: "Reportée",
});

export const EVENT_TYPES = [
  "audience",
  "rendez_vous",
  "depot_requete",
  "deplacement",
  "echeance",
  "reunion",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_TYPE_LABELS = labels<EventType>({
  audience: "Audience",
  rendez_vous: "Rendez-vous client",
  depot_requete: "Dépôt de requête",
  deplacement: "Déplacement au tribunal",
  echeance: "Échéance de procédure",
  reunion: "Réunion interne",
});

export const EVENT_STATUSES = ["prevu", "termine", "annule"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
export const EVENT_STATUS_LABELS = labels<EventStatus>({
  prevu: "Prévu",
  termine: "Terminé",
  annule: "Annulé",
});

export const TASK_STATUSES = ["a_faire", "en_cours", "en_attente", "terminee"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS = labels<TaskStatus>({
  a_faire: "À faire",
  en_cours: "En cours",
  en_attente: "En attente",
  terminee: "Terminée",
});

export const TASK_PRIORITIES = ["basse", "normale", "haute", "urgente"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABELS = labels<TaskPriority>({
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
  urgente: "Urgente",
});

export const INVOICE_STATUSES = ["brouillon", "emise", "annulee"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_LABELS = labels<InvoiceStatus>({
  brouillon: "Brouillon",
  emise: "Émise",
  annulee: "Annulée",
});

/** Statut de paiement calculé à partir des règlements enregistrés. */
export const PAYMENT_STATES = ["impayee", "partielle", "payee"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];
export const PAYMENT_STATE_LABELS = labels<PaymentState>({
  impayee: "Impayée",
  partielle: "Paiement partiel",
  payee: "Payée",
});

export const INVOICE_LINE_KINDS = ["honoraires", "frais"] as const;
export type InvoiceLineKind = (typeof INVOICE_LINE_KINDS)[number];
export const INVOICE_LINE_KIND_LABELS = labels<InvoiceLineKind>({
  honoraires: "Honoraires",
  frais: "Frais et débours",
});

export const PAYMENT_METHODS = ["especes", "cheque", "virement", "mobile_money"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS = labels<PaymentMethod>({
  especes: "Espèces",
  cheque: "Chèque",
  virement: "Virement bancaire",
  mobile_money: "Mobile money",
});

export const EXPENSE_CATEGORIES = ["greffe", "huissier", "deplacement", "reprographie", "timbres", "autre"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABELS = labels<ExpenseCategory>({
  greffe: "Frais de greffe",
  huissier: "Frais d'huissier",
  deplacement: "Déplacement",
  reprographie: "Photocopies / reprographie",
  timbres: "Timbres fiscaux",
  autre: "Autre dépense",
});

/** Juridictions proposées par défaut (saisie libre également possible). */
export const JURISDICTIONS = [
  "Tribunal de commerce hors classe de Dakar",
  "Tribunal de grande instance hors classe de Dakar",
  "Tribunal d'instance hors classe de Dakar",
  "Tribunal du travail hors classe de Dakar",
  "Tribunal de grande instance de Thiès",
  "Tribunal de grande instance de Saint-Louis",
  "Cour d'appel de Dakar",
  "Cour suprême",
  "Tribunal administratif",
] as const;
