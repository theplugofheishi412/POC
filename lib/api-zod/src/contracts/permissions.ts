import type { Role } from "./enums";

/**
 * Matrice des permissions par rôle.
 *
 * L'API est la seule source d'autorité : le frontend utilise cette matrice
 * uniquement pour masquer les actions indisponibles. Toute requête est
 * re-vérifiée côté serveur.
 */
export const PERMISSIONS = [
  "dossiers.view_all", // voir tous les dossiers, y compris confidentiels
  "dossiers.create",
  "dossiers.edit",
  "dossiers.assign", // changer l'avocat responsable / l'équipe
  "dossiers.delete",
  "clients.write",
  "clients.delete",
  "documents.read", // pièces, documents, bordereaux, requêtes
  "documents.write",
  "requetes.validate", // approbation d'un acte par un avocat
  "templates.write",
  "demarches.write",
  "events.write",
  "tasks.assign", // attribuer une tâche à un autre membre
  "billing.read",
  "billing.write",
  "users.manage",
  "audit.read",
  "demo.reset",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL,
  associe: ALL.filter((p) => p !== "users.manage" && p !== "demo.reset"),
  collaborateur: [
    "dossiers.create",
    "dossiers.edit",
    "clients.write",
    "documents.read",
    "documents.write",
    "requetes.validate",
    "templates.write",
    "demarches.write",
    "events.write",
    "tasks.assign",
    "billing.read",
  ],
  juriste: [
    "dossiers.edit",
    "clients.write",
    "documents.read",
    "documents.write",
    "templates.write",
    "demarches.write",
    "events.write",
    "tasks.assign",
  ],
  // Le stagiaire prépare, mais ne valide jamais seul un acte.
  stagiaire: ["documents.read", "documents.write", "demarches.write", "events.write"],
  assistant: ["clients.write", "documents.read", "documents.write", "demarches.write", "events.write"],
  comptable: ["billing.read", "billing.write"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Libellés pour l'écran « Utilisateurs et rôles ». */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "dossiers.view_all": "Voir tous les dossiers (y compris confidentiels)",
  "dossiers.create": "Ouvrir un dossier",
  "dossiers.edit": "Modifier les dossiers autorisés",
  "dossiers.assign": "Affecter l'avocat responsable et l'équipe",
  "dossiers.delete": "Supprimer un dossier",
  "clients.write": "Créer et modifier les clients",
  "clients.delete": "Supprimer / archiver un client",
  "documents.read": "Consulter pièces, documents et requêtes",
  "documents.write": "Préparer pièces, bordereaux et requêtes",
  "requetes.validate": "Valider un acte (approbation d'avocat)",
  "templates.write": "Créer des modèles de documents",
  "demarches.write": "Enregistrer des démarches au palais",
  "events.write": "Gérer l'agenda",
  "tasks.assign": "Attribuer des tâches à l'équipe",
  "billing.read": "Consulter la facturation",
  "billing.write": "Émettre factures et encaisser",
  "users.manage": "Gérer les utilisateurs",
  "audit.read": "Consulter le journal d'audit",
  "demo.reset": "Réinitialiser les données de démonstration",
};
