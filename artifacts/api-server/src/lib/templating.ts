import {
  and,
  cabinetsTable,
  clientsTable,
  db,
  dossierPartiesTable,
  eq,
  usersTable,
  type Dossier,
} from "@workspace/db";
import { PARTY_ROLE_LABELS, type PartyRole } from "@workspace/api-zod";
import { longDate } from "./format";
import { clientDisplayName } from "./mappers";
import { today } from "./http";

/** Variables renseignées automatiquement à partir du dossier. */
export const AUTO_FIELDS: Record<string, string> = {
  "cabinet.nom": "Nom du cabinet",
  "cabinet.adresse": "Adresse du cabinet",
  "cabinet.ville": "Ville du cabinet",
  "date.jour": "Date du jour",
  "dossier.reference": "Référence du dossier",
  "dossier.intitule": "Intitulé du dossier",
  "dossier.procedure": "Type de procédure",
  "dossier.numero_role": "Numéro de rôle",
  juridiction: "Juridiction",
  "client.nom": "Nom du client",
  "client.adresse": "Adresse du client",
  "client.qualite": "Qualité du client (demandeur, défendeur…)",
  "partie_adverse.nom": "Partie adverse",
  "partie_adverse.conseil": "Conseil de la partie adverse",
  "avocat.nom": "Avocat responsable",
  "avocat.titre": "Titre de l'avocat",
};

const PLACEHOLDER = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi;

export function placeholders(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(PLACEHOLDER)) found.add(m[1]!.toLowerCase());
  return [...found];
}

export function customFields(body: string): string[] {
  return placeholders(body).filter((p) => !(p in AUTO_FIELDS));
}

export async function dossierContext(dossier: Dossier): Promise<Record<string, string>> {
  const [cabinet] = await db.select().from(cabinetsTable).where(eq(cabinetsTable.id, dossier.cabinetId));
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, dossier.clientId));
  const [lawyer] = await db.select().from(usersTable).where(eq(usersTable.id, dossier.responsibleId));
  const parties = await db
    .select()
    .from(dossierPartiesTable)
    .where(and(eq(dossierPartiesTable.dossierId, dossier.id)));

  const clientParty = parties.find((p) => p.clientId === dossier.clientId);
  const clientRole = (clientParty?.role ?? "demandeur") as PartyRole;
  const opposingRole: PartyRole = clientRole === "defendeur" ? "demandeur" : "defendeur";
  const opposing = parties.filter((p) => p.role === opposingRole && p.clientId !== dossier.clientId);

  return {
    "cabinet.nom": cabinet?.name ?? "",
    "cabinet.adresse": [cabinet?.address, cabinet?.city].filter(Boolean).join(", "),
    "cabinet.ville": cabinet?.city ?? "Dakar",
    "date.jour": longDate(today()),
    "dossier.reference": dossier.reference,
    "dossier.intitule": dossier.title,
    "dossier.procedure": dossier.procedureType,
    "dossier.numero_role": dossier.roleNumber ?? "[numéro de rôle à compléter]",
    juridiction: dossier.jurisdiction ?? "[juridiction à compléter]",
    "client.nom": client ? clientDisplayName(client) : "",
    "client.adresse": [client?.address, client?.city].filter(Boolean).join(", "),
    "client.qualite": PARTY_ROLE_LABELS[clientRole].toLowerCase(),
    "partie_adverse.nom": opposing.map((p) => p.name).join(", ") || "[partie adverse à compléter]",
    "partie_adverse.conseil": opposing.find((p) => p.counsel)?.counsel ?? "[conseil adverse]",
    "avocat.nom": lawyer ? `Maître ${lawyer.firstName} ${lawyer.lastName}` : "",
    "avocat.titre": lawyer?.title ?? "Avocat à la Cour",
  };
}

/** Remplit le modèle ; les champs manquants restent visibles « à compléter ». */
export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER, (_m, key: string) => {
    const v = values[key.toLowerCase()];
    return v && v.trim() ? v.trim() : `[à compléter : ${key.replace(/_/g, " ")}]`;
  });
}
