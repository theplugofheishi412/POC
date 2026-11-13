import fs from "node:fs";
import path from "node:path";
import {
  auditLogTable,
  bordereauItemsTable,
  bordereauxTable,
  cabinetsTable,
  clientsTable,
  count,
  db,
  demarchesTable,
  documentsTable,
  dossierMembersTable,
  dossierPartiesTable,
  dossiersTable,
  eq,
  eventsTable,
  expensesTable,
  invoiceLinesTable,
  invoicesTable,
  paymentsTable,
  piecesTable,
  requeteVersionsTable,
  requetesTable,
  sql,
  tasksTable,
  templatesTable,
  usersTable,
  type Dossier,
} from "@workspace/db";
import type { Role } from "@workspace/api-zod";
import { hashPassword } from "../lib/auth";
import { toIsoDay } from "../lib/http";
import { logger } from "../lib/logger";
import { sampleDocumentPdf } from "../lib/pdf";
import { saveFile, UPLOAD_DIR } from "../lib/storage";
import { dossierContext, fillTemplate } from "../lib/templating";
import { SYSTEM_TEMPLATES } from "./templates";

/**
 * Jeu de données de démonstration — identités, sociétés et affaires
 * entièrement fictives. Les dates sont calculées par rapport au jour du
 * chargement afin que l'agenda et les échéances restent d'actualité.
 */
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo2026!";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toIsoDay(d);
};
const at = (offset: number, hours: number, minutes = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hours, minutes, 0, 0);
  return d;
};
/** Instant passé : jamais dans le futur, même chargé tôt le matin. */
const ago = (days: number, hours = 10) =>
  new Date(Math.min(at(-days, hours, (days * 7) % 60).getTime(), Date.now() - 5 * 60_000));

export async function seedIfEmpty(): Promise<boolean> {
  const [{ n }] = (await db.select({ n: count() }).from(usersTable)) as [{ n: number }];
  if (Number(n) > 0) return false;
  await seed();
  return true;
}

export async function resetDemoData(): Promise<void> {
  await db.execute(
    sql.raw(
      `TRUNCATE TABLE audit_log, payments, invoice_lines, invoices, expenses, tasks, events, requete_versions, requetes, templates, bordereau_items, bordereaux, pieces, documents, demarches, dossier_parties, dossier_members, dossiers, clients, sessions, users, cabinets RESTART IDENTITY CASCADE`,
    ),
  );
  for (const f of fs.readdirSync(UPLOAD_DIR)) fs.rmSync(path.join(UPLOAD_DIR, f), { force: true });
  await seed();
}

async function seed(): Promise<void> {
  const started = Date.now();

  /* ---------------------------------------------------------------- */
  /* Cabinet et équipe                                                */
  /* ---------------------------------------------------------------- */
  const [cabinet] = await db
    .insert(cabinetsTable)
    .values({
      name: "Cabinet Ndiaye, Sarr & Associés",
      address: "12, rue des Jurisconsultes (adresse fictive), Plateau",
      city: "Dakar",
      phone: "+221 33 800 00 00",
      email: "contact@cabinet-demo.example",
      barNumber: "Barreau de démonstration",
    })
    .returning();
  const cabinetId = cabinet!.id;
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const team: { key: string; firstName: string; lastName: string; role: Role; title: string; phone: string }[] = [
    { key: "admin", firstName: "Khady", lastName: "Ndour", role: "admin", title: "Administratrice du cabinet", phone: "+221 77 000 00 01" },
    { key: "associe", firstName: "Aïssatou", lastName: "Ndiaye", role: "associe", title: "Avocate associée", phone: "+221 77 000 00 02" },
    { key: "collab", firstName: "Ousmane", lastName: "Sarr", role: "collaborateur", title: "Avocat collaborateur", phone: "+221 77 000 00 03" },
    { key: "collab2", firstName: "Marième", lastName: "Cissé", role: "collaborateur", title: "Avocate collaboratrice", phone: "+221 77 000 00 04" },
    { key: "juriste", firstName: "Mariama", lastName: "Ba", role: "juriste", title: "Juriste", phone: "+221 77 000 00 05" },
    { key: "stagiaire", firstName: "Ibrahima", lastName: "Diallo", role: "stagiaire", title: "Avocat stagiaire", phone: "+221 77 000 00 06" },
    { key: "assistant", firstName: "Fatou", lastName: "Mbengue", role: "assistant", title: "Assistante juridique", phone: "+221 77 000 00 07" },
    { key: "comptable", firstName: "Cheikh", lastName: "Gueye", role: "comptable", title: "Comptable", phone: "+221 77 000 00 08" },
  ];
  const U: Record<string, number> = {};
  for (const m of team) {
    const email = `${m.firstName}.${m.lastName}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    const [u] = await db
      .insert(usersTable)
      .values({
        cabinetId,
        email: `${email}@cabinet-demo.example`,
        passwordHash,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
        title: m.title,
        phone: m.phone,
        createdAt: ago(200),
      })
      .returning();
    U[m.key] = u!.id;
  }

  /* ---------------------------------------------------------------- */
  /* Clients (12)                                                      */
  /* ---------------------------------------------------------------- */
  type ClientSeed = Partial<typeof clientsTable.$inferInsert> & { key: string; type: "physique" | "morale"; daysAgo: number };
  const clientSeeds: ClientSeed[] = [
    { key: "abc", type: "morale", companyName: "SARL ABC Distribution", legalForm: "SARL", registrationNumber: "SN-DKR-2015-B-00001", representativeName: "Moustapha Kane, gérant", phone: "+221 33 811 10 10", email: "direction@abc-distribution.example", address: "Zone industrielle, lot 4 (fictif)", city: "Dakar", notes: "Client historique. Préfère les échanges par email avec copie au gérant.", daysAgo: 160 },
    { key: "ndar", type: "morale", companyName: "Ndar Industrie SA", legalForm: "SA", registrationNumber: "SN-STL-2009-B-00002", representativeName: "Rama Thiam, directrice générale", phone: "+221 33 961 20 20", email: "juridique@ndar-industrie.example", address: "Route de Khor, km 3 (fictif)", city: "Saint-Louis", notes: "Convention d'honoraires annuelle.", daysAgo: 400 },
    { key: "saly", type: "morale", companyName: "Groupe Saly Invest SAS", legalForm: "SAS", registrationNumber: "SN-MBR-2018-B-00003", representativeName: "Alioune Mbaye, président", phone: "+221 33 957 30 30", email: "contact@saly-invest.example", address: "Résidence Les Filaos (fictive)", city: "Mbour", daysAgo: 120 },
    { key: "teranga", type: "morale", companyName: "Teranga Crédit SA", legalForm: "SA", registrationNumber: "SN-DKR-2001-B-00004", representativeName: "Service contentieux", phone: "+221 33 820 40 40", email: "contentieux@teranga-credit.example", address: "Avenue de l'Exemple, 45 (fictif)", city: "Dakar", notes: "Établissement de crédit fictif — dossiers de recouvrement.", daysAgo: 300 },
    { key: "diop", type: "physique", firstName: "Aminata", lastName: "Diop", phone: "+221 77 100 00 01", email: "aminata.diop@mail.example", address: "Cité Fictive, villa 12", city: "Dakar", idNumber: "CNI 1 000 0000 00001", notes: "Héritière ; souhaite un règlement amiable si possible.", daysAgo: 95 },
    { key: "fall", type: "physique", firstName: "Mamadou", lastName: "Fall", phone: "+221 77 100 00 02", email: "mamadou.fall@mail.example", address: "Quartier Escale (fictif)", city: "Thiès", idNumber: "CNI 1 000 0000 00002", daysAgo: 70 },
    { key: "faye", type: "physique", firstName: "Awa", lastName: "Faye", phone: "+221 77 100 00 03", email: "awa.faye@mail.example", address: "Sacré-Cœur (adresse fictive)", city: "Dakar", idNumber: "CNI 1 000 0000 00003", notes: "Dossier sensible : ne pas laisser de message vocal.", daysAgo: 60 },
    { key: "sy", type: "physique", firstName: "Pape", lastName: "Sy", phone: "+221 77 100 00 04", address: "Pikine (adresse fictive)", city: "Pikine", daysAgo: 30 },
    { key: "jokkoo", type: "morale", companyName: "Coopérative agricole Jokkoo", legalForm: "Société coopérative", registrationNumber: "COOP-KL-2012-0005", representativeName: "Ndèye Sow, présidente", phone: "+221 33 941 50 50", email: "jokkoo@coop.example", address: "Route nationale (fictive)", city: "Kaolack", daysAgo: 12 },
    { key: "diouf", type: "physique", firstName: "Lamine", lastName: "Diouf", phone: "+221 77 100 00 06", email: "lamine.diouf@mail.example", address: "Médina, rue 6 (fictive)", city: "Dakar", idNumber: "CNI 1 000 0000 00006", daysAgo: 45 },
    { key: "palmiers", type: "morale", companyName: "Clinique Les Palmiers SARL", legalForm: "SARL", registrationNumber: "SN-DKR-2016-B-00007", representativeName: "Dr Seynabou Ly, gérante", phone: "+221 33 860 70 70", email: "administration@palmiers.example", address: "Boulevard Fictif, 3", city: "Dakar", daysAgo: 250 },
    { key: "seck", type: "physique", firstName: "Rokhaya", lastName: "Seck", phone: "+221 77 100 00 08", email: "rokhaya.seck@mail.example", address: "Grand Yoff (adresse fictive)", city: "Dakar", idNumber: "Passeport A0000008", daysAgo: 20 },
  ];
  const C: Record<string, { id: number; name: string }> = {};
  for (const { key, daysAgo, ...c } of clientSeeds) {
    const [row] = await db
      .insert(clientsTable)
      .values({ ...c, cabinetId, createdBy: U.assistant, createdAt: ago(daysAgo), updatedAt: ago(Math.max(1, daysAgo - 5)) })
      .returning();
    C[key] = { id: row!.id, name: c.type === "morale" ? c.companyName! : `${c.firstName} ${c.lastName!.toUpperCase()}` };
  }

  /* ---------------------------------------------------------------- */
  /* Dossiers (15) avec parties et équipes                            */
  /* ---------------------------------------------------------------- */
  const TC = "Tribunal de commerce hors classe de Dakar";
  const TGI = "Tribunal de grande instance hors classe de Dakar";
  const TI = "Tribunal d'instance hors classe de Dakar";
  const TT = "Tribunal du travail hors classe de Dakar";

  type DossierSeed = {
    key: string;
    ref: string;
    title: string;
    client: string;
    clientRole?: "demandeur" | "defendeur";
    category: string;
    procedure: string;
    jurisdiction: string;
    responsible: string;
    members: string[];
    status: string;
    confidentiality?: "standard" | "restreint" | "confidentiel";
    openedDaysAgo: number;
    roleNumber?: string;
    description: string;
    opposing: { name: string; counsel?: string; role?: "defendeur" | "demandeur" | "intervenant" | "representant" | "autre" }[];
  };
  const dossierSeeds: DossierSeed[] = [
    { key: "abc", ref: "DOS-2026-001", title: "ABC Distribution c. XYZ Logistique — rupture de contrat", client: "abc", category: "commercial", procedure: "Action en responsabilité contractuelle", jurisdiction: TC, responsible: "associe", members: ["stagiaire", "juriste"], status: "en_cours", openedDaysAgo: 58, description: "Rupture brutale du contrat de prestation logistique par XYZ Logistique. Demande de dommages-intérêts pour le préjudice commercial subi (pertes de marchandises et de clientèle).", opposing: [{ name: "XYZ Logistique SA", counsel: "Me Babacar Thiam (fictif)" }] },
    { key: "ndar", ref: "DOS-2026-002", title: "Ndar Industrie c. Ets Ba & Fils — factures impayées", client: "ndar", category: "recouvrement", procedure: "Injonction de payer", jurisdiction: TC, responsible: "collab", members: ["stagiaire"], status: "audience_programmee", roleNumber: "RG 1234/2026", openedDaysAgo: 75, description: "Recouvrement de 18 factures de fournitures restées impayées (montant principal fictif : 24 500 000 FCFA). Opposition formée par le débiteur.", opposing: [{ name: "Établissements Ba & Fils", counsel: "Me Coumba Diagne (fictif)" }] },
    { key: "succession", ref: "DOS-2026-003", title: "Succession Diop", client: "diop", category: "famille", procedure: "Partage successoral", jurisdiction: TGI, responsible: "associe", members: ["juriste"], status: "preparation", confidentiality: "confidentiel", openedDaysAgo: 90, description: "Liquidation et partage de la succession de feu M. Diop (fictif). Désaccord entre cohéritiers sur l'évaluation d'un immeuble.", opposing: [{ name: "Moussa Diop (cohéritier)", role: "defendeur" }, { name: "Office notarial de démonstration", role: "intervenant" }] },
    { key: "fall", ref: "DOS-2026-004", title: "Fall c. Atlantique Services — licenciement abusif", client: "fall", category: "travail", procedure: "Contestation de licenciement", jurisdiction: TT, responsible: "collab2", members: ["assistant"], status: "en_cours", roleNumber: "TT 567/2026", openedDaysAgo: 65, description: "Licenciement pour faute grave contesté. Demande d'indemnités de rupture et de dommages-intérêts.", opposing: [{ name: "Société Atlantique Services SARL", counsel: "Me Adama Ndao (fictif)" }] },
    { key: "bail", ref: "DOS-2026-005", title: "Saly Invest — renouvellement de bail commercial", client: "saly", category: "immobilier", procedure: "Négociation et rédaction de bail", jurisdiction: "Tribunal de grande instance de Thiès", responsible: "collab2", members: [], status: "en_attente", openedDaysAgo: 110, description: "Accompagnement du client dans le renouvellement du bail de son local commercial. En attente du retour du bailleur sur la proposition de loyer.", opposing: [{ name: "SCI Les Cocotiers (bailleur)", role: "autre" }] },
    { key: "faye", ref: "DOS-2026-006", title: "Faye — divorce et résidence des enfants", client: "faye", category: "famille", procedure: "Divorce contentieux", jurisdiction: TI, responsible: "associe", members: [], status: "audience_programmee", confidentiality: "confidentiel", roleNumber: "TI 890/2026", openedDaysAgo: 55, description: "Demande en divorce, fixation de la résidence habituelle des enfants et contribution à leur entretien.", opposing: [{ name: "Modou Faye (époux)", counsel: "Me Yacine Gaye (fictif)" }] },
    { key: "penal", ref: "DOS-2026-007", title: "Ministère public c. Sy — défense pénale", client: "sy", clientRole: "defendeur", category: "penal", procedure: "Défense devant le tribunal correctionnel", jurisdiction: `${TGI} — chambre correctionnelle`, responsible: "collab", members: [], status: "en_cours", confidentiality: "confidentiel", openedDaysAgo: 28, description: "Défense du prévenu poursuivi pour abus de confiance (faits fictifs). Préparation de la plaidoirie et des témoins de moralité.", opposing: [{ name: "Ministère public", role: "demandeur" }, { name: "Société Delta Commerce (partie civile)", role: "intervenant", counsel: "Me Oumar Ka (fictif)" }] },
    { key: "jokkoo", ref: "DOS-2026-008", title: "Coopérative Jokkoo — recours contre un arrêté de retrait d'agrément", client: "jokkoo", category: "administratif", procedure: "Recours pour excès de pouvoir", jurisdiction: "Cour suprême", responsible: "associe", members: ["collab"], status: "nouveau", openedDaysAgo: 10, description: "Contestation d'un arrêté (fictif) retirant l'agrément de la coopérative. Recours gracieux préalable à préparer.", opposing: [{ name: "Ministère de l'Agriculture (fictif)", role: "defendeur" }] },
    { key: "teranga", ref: "DOS-2026-009", title: "Teranga Crédit c. Diagne — remboursement de prêt", client: "teranga", category: "recouvrement", procedure: "Action en paiement", jurisdiction: "Tribunal de grande instance de Thiès", responsible: "collab", members: ["assistant"], status: "decision_rendue", roleNumber: "TGI-T 321/2026", openedDaysAgo: 140, description: "Prêt personnel impayé. Jugement de condamnation rendu ; exécution à engager (signification par huissier).", opposing: [{ name: "Samba Diagne", role: "defendeur" }] },
    { key: "diouf", ref: "DOS-2026-010", title: "Diouf c. Kébé — résiliation de bail et expulsion", client: "diouf", category: "immobilier", procedure: "Expulsion d'occupant", jurisdiction: TI, responsible: "collab2", members: ["stagiaire"], status: "en_cours", roleNumber: "TI 1102/2026", openedDaysAgo: 40, description: "Loyers impayés depuis 7 mois. Commandement de payer resté sans effet ; demande de résiliation du bail et d'expulsion.", opposing: [{ name: "Ibou Kébé (locataire)", role: "defendeur" }] },
    { key: "seck", ref: "DOS-2026-011", title: "Seck c. Transports Rapides — accident de la circulation", client: "seck", category: "civil", procedure: "Indemnisation du préjudice corporel", jurisdiction: TGI, responsible: "collab", members: ["stagiaire"], status: "preparation", openedDaysAgo: 18, description: "Préjudice corporel consécutif à un accident impliquant un véhicule de transport en commun. Expertise médicale en cours.", opposing: [{ name: "Transports Rapides SA", role: "defendeur" }, { name: "Assurances Horizon (assureur, fictif)", role: "intervenant" }] },
    { key: "palmiers", ref: "DOS-2026-012", title: "Clinique Les Palmiers — audit des contrats de travail", client: "palmiers", category: "travail", procedure: "Consultation et conseil", jurisdiction: "—", responsible: "associe", members: ["juriste"], status: "cloture", openedDaysAgo: 210, description: "Revue des contrats de travail et du règlement intérieur. Mission achevée, rapport remis.", opposing: [] },
    { key: "archive", ref: "DOS-2025-014", title: "Ndar Industrie c. Sénégal Transit — avaries de marchandises", client: "ndar", category: "commercial", procedure: "Action en responsabilité du transporteur", jurisdiction: TC, responsible: "collab", members: [], status: "archive", openedDaysAgo: 380, description: "Dossier clos par transaction. Archivé.", opposing: [{ name: "Sénégal Transit SARL (fictif)", role: "defendeur" }] },
    { key: "batir", ref: "DOS-2026-013", title: "Teranga Crédit c. SARL Bâtir Plus — réalisation de garantie", client: "teranga", category: "recouvrement", procedure: "Saisie immobilière", jurisdiction: TGI, responsible: "associe", members: ["collab"], status: "en_cours", confidentiality: "restreint", roleNumber: "SI 045/2026", openedDaysAgo: 85, description: "Réalisation d'une hypothèque consentie en garantie d'un crédit d'investissement (montants fictifs).", opposing: [{ name: "SARL Bâtir Plus", role: "defendeur", counsel: "Me Awa Ndoye (fictif)" }] },
    { key: "btp", ref: "DOS-2026-014", title: "Saly Invest c. BTP Sahel — malfaçons", client: "saly", category: "civil", procedure: "Responsabilité des constructeurs", jurisdiction: "Tribunal de grande instance de Thiès", responsible: "collab2", members: ["juriste", "stagiaire"], status: "en_cours", openedDaysAgo: 33, description: "Désordres affectant la toiture et l'étanchéité d'une résidence livrée en 2025. Expertise amiable contradictoire.", opposing: [{ name: "Entreprise BTP Sahel SA", role: "defendeur" }] },
  ];

  const D: Record<string, Dossier> = {};
  for (const s of dossierSeeds) {
    const status = s.status;
    const [d] = await db
      .insert(dossiersTable)
      .values({
        cabinetId,
        reference: s.ref,
        title: s.title,
        clientId: C[s.client]!.id,
        category: s.category,
        procedureType: s.procedure,
        jurisdiction: s.jurisdiction === "—" ? null : s.jurisdiction,
        responsibleId: U[s.responsible]!,
        status,
        confidentiality: s.confidentiality ?? "standard",
        openedAt: day(-s.openedDaysAgo),
        closedAt: status === "cloture" || status === "archive" ? day(-Math.floor(s.openedDaysAgo / 3)) : null,
        roleNumber: s.roleNumber ?? null,
        description: s.description,
        createdAt: ago(s.openedDaysAgo),
        updatedAt: ago(Math.max(0, Math.floor(s.openedDaysAgo / 6))),
      })
      .returning();
    D[s.key] = d!;
    if (s.members.length) {
      await db.insert(dossierMembersTable).values(s.members.map((m) => ({ dossierId: d!.id, userId: U[m]! })));
    }
    await db.insert(dossierPartiesTable).values([
      { dossierId: d!.id, clientId: C[s.client]!.id, name: C[s.client]!.name, role: s.clientRole ?? "demandeur" },
      ...s.opposing.map((o) => ({ dossierId: d!.id, name: o.name, role: o.role ?? "defendeur", counsel: o.counsel ?? null })),
    ]);
  }
  // Représentant légal intervenant comme partie (gestion multi-parties).
  await db.insert(dossierPartiesTable).values({
    dossierId: D.abc!.id,
    name: "Moustapha Kane (gérant de la SARL ABC Distribution)",
    role: "representant",
    notes: "Représentant légal du demandeur",
  });

  /* ---------------------------------------------------------------- */
  /* Historique (journal) : ouverture des dossiers                    */
  /* ---------------------------------------------------------------- */
  const history: (typeof auditLogTable.$inferInsert)[] = [];
  const log = (userKey: string, action: string, entityType: string, summary: string, dossier: Dossier | null, when: Date, entityId?: number) =>
    history.push({ cabinetId, userId: U[userKey]!, action, entityType, entityId: entityId ?? null, dossierId: dossier?.id ?? null, clientId: dossier?.clientId ?? null, summary, createdAt: when });
  for (const s of dossierSeeds) {
    log(s.responsible, "dossier.create", "dossier", `Ouverture du dossier ${s.ref} — ${s.title}`, D[s.key]!, ago(s.openedDaysAgo, 9), D[s.key]!.id);
  }
  for (const c of clientSeeds) {
    history.push({ cabinetId, userId: U.assistant!, action: "client.create", entityType: "client", entityId: C[c.key]!.id, clientId: C[c.key]!.id, summary: `Enregistrement du client ${C[c.key]!.name}`, createdAt: ago(c.daysAgo, 8) });
  }

  /* ---------------------------------------------------------------- */
  /* Documents (20) — PDF factices générés                            */
  /* ---------------------------------------------------------------- */
  const docKeys: Record<string, number> = {};
  const addDocument = async (key: string, dossierKey: string, name: string, category: string, userKey: string, daysAgo: number, lines: string[], demarcheId?: number) => {
    const buffer = await sampleDocumentPdf(cabinet!, name, lines);
    const { storageKey, sha256 } = saveFile(buffer, "pdf");
    const [doc] = await db
      .insert(documentsTable)
      .values({
        dossierId: D[dossierKey]!.id,
        demarcheId: demarcheId ?? null,
        name,
        category,
        originalName: `${name.replace(/[^\p{L}\p{N} -]+/gu, "").replace(/\s+/g, "-")}.pdf`,
        mimeType: "application/pdf",
        size: buffer.length,
        storageKey,
        sha256,
        uploadedBy: U[userKey]!,
        createdAt: ago(daysAgo),
      })
      .returning();
    docKeys[key] = doc!.id;
    log(userKey, "document.upload", "document", `Ajout du document « ${name} »`, D[dossierKey]!, ago(daysAgo), doc!.id);
    return doc!.id;
  };
  const filler = (subject: string) => [
    `Le présent document est une pièce fictive établie pour les besoins de la démonstration du logiciel de gestion de cabinet. Il se rapporte à : ${subject}.`,
    "Toute ressemblance avec des personnes, sociétés ou faits réels serait purement fortuite. Les montants, dates et références sont inventés.",
    "Contenu de démonstration : ce texte remplace le contenu réel qu'aurait la pièce (contrat, courrier, justificatif, décision).",
  ];
  await addDocument("abc_cni", "abc", "Copie de la pièce d'identité du gérant", "piece", "stagiaire", 50, filler("l'identité du représentant légal de la SARL ABC Distribution"));
  await addDocument("abc_contrat", "abc", "Contrat de prestation logistique", "piece", "associe", 56, filler("le contrat de prestation conclu entre ABC Distribution et XYZ Logistique"));
  await addDocument("abc_med", "abc", "Mise en demeure adressée à XYZ Logistique", "correspondance", "associe", 40, filler("la mise en demeure de reprendre l'exécution du contrat"));
  await addDocument("abc_paiement", "abc", "Justificatif de paiement des prestations", "piece", "stagiaire", 38, filler("le paiement des factures de prestations"));
  await addDocument("abc_rccm", "abc", "Extrait du registre du commerce", "piece", "juriste", 35, filler("l'immatriculation de la société demanderesse"));
  await addDocument("ndar_factures", "ndar", "Relevé des factures impayées", "piece", "collab", 70, filler("les factures émises par Ndar Industrie et restées impayées"));
  await addDocument("ndar_ordonnance", "ndar", "Ordonnance d'injonction de payer", "decision", "collab", 45, filler("l'ordonnance rendue sur requête"));
  await addDocument("ndar_opposition", "ndar", "Acte d'opposition du débiteur", "acte", "collab", 25, filler("l'opposition formée par les Établissements Ba & Fils"));
  await addDocument("succ_acte", "succession", "Acte de notoriété", "piece", "juriste", 80, filler("la dévolution successorale"));
  await addDocument("succ_eval", "succession", "Rapport d'évaluation de l'immeuble", "piece", "associe", 60, filler("l'évaluation de l'immeuble successoral"));
  await addDocument("fall_contrat", "fall", "Contrat de travail de M. Fall", "piece", "assistant", 62, filler("le contrat de travail à durée indéterminée"));
  await addDocument("fall_lettre", "fall", "Lettre de licenciement", "piece", "assistant", 62, filler("la notification du licenciement"));
  await addDocument("fall_bulletins", "fall", "Bulletins de salaire (12 derniers mois)", "piece", "assistant", 61, filler("la rémunération perçue"));
  await addDocument("faye_actes", "faye", "Actes de naissance des enfants", "piece", "associe", 50, filler("l'état civil des enfants du couple"));
  await addDocument("teranga_jugement", "teranga", "Jugement de condamnation", "decision", "collab", 15, filler("la décision condamnant le débiteur au paiement"));
  await addDocument("teranga_contrat", "teranga", "Contrat de prêt et tableau d'amortissement", "piece", "assistant", 130, filler("le prêt consenti"));
  await addDocument("diouf_bail", "diouf", "Contrat de bail d'habitation", "piece", "stagiaire", 38, filler("le bail conclu avec M. Kébé"));
  await addDocument("diouf_commandement", "diouf", "Commandement de payer les loyers", "acte", "collab2", 30, filler("le commandement délivré par huissier"));
  await addDocument("seck_certificat", "seck", "Certificat médical initial", "piece", "stagiaire", 15, filler("les blessures constatées"));
  await addDocument("btp_constat", "btp", "Procès-verbal de constat des désordres", "piece", "juriste", 25, filler("les désordres de toiture et d'étanchéité"));

  /* ---------------------------------------------------------------- */
  /* Pièces numérotées                                                */
  /* ---------------------------------------------------------------- */
  const P: Record<string, number[]> = {};
  const addPieces = async (dossierKey: string, items: [string, number, string | null, string | null][]) => {
    P[dossierKey] = [];
    for (const [i, [designation, pages, docKey, observations]] of items.entries()) {
      const [p] = await db
        .insert(piecesTable)
        .values({ dossierId: D[dossierKey]!.id, position: i + 1, designation, pages, observations, documentId: docKey ? docKeys[docKey]! : null })
        .returning();
      P[dossierKey]!.push(p!.id);
    }
  };
  await addPieces("abc", [
    ["Copie de la pièce d'identité", 2, "abc_cni", null],
    ["Contrat de prestation", 5, "abc_contrat", "Original disponible au cabinet"],
    ["Mise en demeure", 2, "abc_med", "Avec accusé de réception"],
    ["Justificatif de paiement", 1, "abc_paiement", null],
    ["Extrait du registre du commerce", 1, "abc_rccm", null],
    ["Bons de livraison non honorés (lot)", 14, null, "Copies certifiées conformes"],
  ]);
  await addPieces("ndar", [
    ["Relevé des factures impayées", 3, "ndar_factures", null],
    ["Factures n° F-001 à F-018", 18, null, null],
    ["Ordonnance d'injonction de payer", 2, "ndar_ordonnance", null],
    ["Acte d'opposition", 4, "ndar_opposition", "Signifié par le débiteur"],
    ["Correspondances de relance", 6, null, null],
  ]);
  await addPieces("succession", [
    ["Acte de notoriété", 3, "succ_acte", null],
    ["Titre foncier de l'immeuble", 4, null, "Copie"],
    ["Rapport d'évaluation", 12, "succ_eval", null],
    ["Inventaire des biens mobiliers", 5, null, null],
  ]);
  await addPieces("fall", [
    ["Contrat de travail", 4, "fall_contrat", null],
    ["Lettre de licenciement", 2, "fall_lettre", null],
    ["Bulletins de salaire", 12, "fall_bulletins", "12 derniers mois"],
    ["Attestations de collègues", 3, null, null],
    ["Procès-verbal de non-conciliation", 2, null, "Inspection du travail"],
  ]);
  await addPieces("faye", [
    ["Acte de mariage", 1, null, null],
    ["Actes de naissance des enfants", 3, "faye_actes", null],
    ["Justificatifs de revenus", 6, null, null],
  ]);
  await addPieces("teranga", [
    ["Contrat de prêt", 8, "teranga_contrat", null],
    ["Tableau d'amortissement", 2, null, null],
    ["Mise en demeure", 1, null, null],
    ["Jugement de condamnation", 5, "teranga_jugement", null],
  ]);
  await addPieces("diouf", [
    ["Contrat de bail", 4, "diouf_bail", null],
    ["Quittances de loyer", 6, null, null],
    ["Commandement de payer", 3, "diouf_commandement", null],
  ]);
  await addPieces("seck", [
    ["Procès-verbal de police", 5, null, null],
    ["Certificat médical initial", 2, "seck_certificat", null],
  ]);
  await addPieces("btp", [
    ["Contrat de construction", 22, null, null],
    ["Procès-verbal de réception", 3, null, "Avec réserves"],
    ["Constat des désordres", 9, "btp_constat", null],
  ]);
  log("stagiaire", "piece.create", "piece", "Ajout de 6 pièces au dossier (constitution du dossier de pièces)", D.abc!, ago(34, 15));

  /* ---------------------------------------------------------------- */
  /* Bordereaux (8)                                                   */
  /* ---------------------------------------------------------------- */
  const addBordereau = async (dossierKey: string, n: number, title: string, daysAgo: number, status: string, userKey: string, count?: number, observations?: string) => {
    const d = D[dossierKey]!;
    const reference = `${d.reference.replace(/^DOS/, "BP")}-${String(n).padStart(2, "0")}`;
    const [b] = await db
      .insert(bordereauxTable)
      .values({ dossierId: d.id, reference, title, bordereauDate: day(-daysAgo), jurisdiction: d.jurisdiction, observations: observations ?? null, status, createdBy: U[userKey]!, createdAt: ago(daysAgo) })
      .returning();
    const pieces = await db.select().from(piecesTable).where(eq(piecesTable.dossierId, d.id));
    const selected = pieces.sort((a, b2) => a.position - b2.position).slice(0, count ?? pieces.length);
    await db.insert(bordereauItemsTable).values(
      selected.map((p, i) => ({ bordereauId: b!.id, pieceId: p.id, position: i + 1, designation: p.designation, pages: p.pages, observations: p.observations })),
    );
    log(userKey, "bordereau.create", "bordereau", `Génération du bordereau ${reference} (${selected.length} pièces)`, d, ago(daysAgo, 16), b!.id);
  };
  await addBordereau("abc", 1, "Pièces communiquées à l'appui de la requête introductive", 4, "finalise", "associe", 4, "Pièces communiquées en copie ; originaux tenus à la disposition du Tribunal.");
  await addBordereau("abc", 2, "Communication complémentaire de pièces", 0, "brouillon", "stagiaire");
  await addBordereau("ndar", 1, "Pièces au soutien de la requête en injonction de payer", 50, "finalise", "collab", 3);
  await addBordereau("succession", 1, "Pièces remises au notaire liquidateur", 20, "brouillon", "juriste");
  await addBordereau("fall", 1, "Pièces communiquées à l'audience de conciliation", 30, "finalise", "collab2");
  await addBordereau("faye", 1, "Pièces au soutien de la demande en divorce", 25, "finalise", "associe");
  await addBordereau("teranga", 1, "Pièces au soutien de l'action en paiement", 100, "finalise", "collab", 3);
  await addBordereau("diouf", 1, "Pièces à l'appui de la demande d'expulsion", 6, "brouillon", "stagiaire");

  /* ---------------------------------------------------------------- */
  /* Modèles et requêtes (10)                                         */
  /* ---------------------------------------------------------------- */
  const T: Record<string, number> = {};
  for (const t of SYSTEM_TEMPLATES) {
    const [row] = await db.insert(templatesTable).values({ ...t, cabinetId, isSystem: true, createdAt: ago(200) }).returning();
    T[t.type] = row!.id;
  }
  const [customTpl] = await db
    .insert(templatesTable)
    .values({
      cabinetId,
      name: "Lettre de transmission au client (modèle du cabinet)",
      type: "autre",
      description: "Modèle personnalisé créé par le cabinet pour transmettre une décision ou une pièce au client.",
      body: `> {{cabinet.ville}}, le {{date.jour}}\n\n> {{client.nom}}\n> {{client.adresse}}\n\n^ Objet : {{dossier.intitule}} — transmission\n\nChère Madame, cher Monsieur,\n\nVeuillez trouver ci-joint {{document_transmis}}.\n\n{{commentaire}}\n\nJe reste à votre entière disposition.\n\n> {{avocat.nom}}`,
      isSystem: false,
      createdBy: U.associe!,
      createdAt: ago(40),
    })
    .returning();
  log("associe", "template.create", "template", `Création du modèle « ${customTpl!.name} »`, null, ago(40));

  type RequeteSeed = { dossier: string; type: keyof typeof T | "custom"; title: string; status: string; author: string; validator?: string; daysAgo: number; fields: Record<string, string>; versions?: number };
  const requeteSeeds: RequeteSeed[] = [
    { dossier: "abc", type: "requete_introductive", title: "Requête introductive — ABC c. XYZ Logistique", status: "deposee", author: "stagiaire", validator: "associe", daysAgo: 6, versions: 3, fields: { objet: "Rupture brutale du contrat de prestation logistique et réparation du préjudice subi.", faits: "Par contrat du 2 janvier 2025, la société XYZ Logistique s'est engagée à assurer le transport et le stockage des marchandises de la requérante. Sans préavis, elle a cessé toute prestation le 15 juillet 2026, laissant des marchandises périssables en souffrance.", moyens: "La rupture unilatérale, sans préavis ni motif légitime, engage la responsabilité contractuelle du prestataire.", demandes: "Condamner XYZ Logistique SA à payer à la requérante la somme de 35 000 000 FCFA à titre de dommages-intérêts ;" } },
    { dossier: "abc", type: "renvoi", title: "Demande de renvoi — audience de mise en état", status: "a_valider", author: "stagiaire", daysAgo: 1, fields: { date_audience: "prochaine audience de mise en état", motif_renvoi: "communication tardive des conclusions adverses, reçues l'avant-veille de l'audience, nécessitant un délai de réponse." } },
    { dossier: "ndar", type: "lettre_juridiction", title: "Lettre au greffe — communication de pièces", status: "validee", author: "collab", validator: "collab", daysAgo: 12, fields: { objet: "Communication de pièces complémentaires", corps_du_courrier: "J'ai l'honneur de vous transmettre, en annexe, le bordereau de pièces complémentaires dans l'affaire citée en référence, en vue de l'audience prochaine." } },
    { dossier: "ndar", type: "mise_en_demeure", title: "Mise en demeure — Ets Ba & Fils", status: "deposee", author: "collab", validator: "collab", daysAgo: 72, fields: { rappel_des_faits: "Malgré plusieurs relances, dix-huit factures de fournitures émises par ma cliente demeurent impayées à ce jour.", obligation: "régler la somme de 24 500 000 FCFA", delai: "huit jours" } },
    { dossier: "fall", type: "requete_introductive", title: "Requête introductive — Fall c. Atlantique Services", status: "validee", author: "collab2", validator: "collab2", daysAgo: 20, versions: 2, fields: { objet: "Contestation du licenciement pour faute grave et paiement des indemnités.", faits: "M. Fall, salarié depuis 2017, a été licencié pour faute grave sans entretien préalable régulier.", moyens: "La procédure de licenciement est irrégulière et la faute grave n'est pas caractérisée.", demandes: "Dire le licenciement abusif et condamner l'employeur au paiement des indemnités légales et de dommages-intérêts ;" } },
    { dossier: "faye", type: "requete_introductive", title: "Requête en divorce — Mme Faye", status: "brouillon", author: "associe", daysAgo: 3, fields: { objet: "Demande en divorce et mesures relatives aux enfants." } },
    { dossier: "diouf", type: "refere", title: "Requête en référé expulsion — Diouf c. Kébé", status: "a_valider", author: "stagiaire", daysAgo: 2, fields: { urgence: "Le locataire ne règle plus aucun loyer depuis sept mois et le commandement de payer est resté sans effet.", moyens: "L'obligation de payer les loyers n'est pas sérieusement contestable.", mesure_demandee: "l'expulsion de M. Ibou Kébé ainsi que de tous occupants de son chef" } },
    { dossier: "jokkoo", type: "courrier_administratif", title: "Recours gracieux — retrait d'agrément", status: "brouillon", author: "collab", daysAgo: 4, fields: { destinataire: "Monsieur le Ministre de l'Agriculture (destinataire fictif)", objet: "Recours gracieux contre l'arrêté de retrait d'agrément", demande: "solliciter le retrait de l'arrêté susvisé, intervenu sans que la coopérative ait été mise à même de présenter ses observations." } },
    { dossier: "teranga", type: "custom", title: "Transmission du jugement au client", status: "validee", author: "assistant", validator: "collab", daysAgo: 13, fields: { document_transmis: "la copie du jugement rendu dans l'affaire citée en objet", commentaire: "Nous allons procéder à sa signification par voie d'huissier." } },
    { dossier: "seck", type: "mise_en_demeure", title: "Mise en demeure — assureur Horizon", status: "brouillon", author: "stagiaire", daysAgo: 5, fields: { rappel_des_faits: "Ma cliente a été victime d'un accident impliquant un véhicule assuré par votre compagnie.", obligation: "formuler une offre d'indemnisation provisionnelle", delai: "quinze jours" } },
  ];
  let firstPendingRequete = 0;
  for (const r of requeteSeeds) {
    const d = D[r.dossier]!;
    const templateId = r.type === "custom" ? customTpl!.id : T[r.type]!;
    const tpl = r.type === "custom" ? customTpl!.body : SYSTEM_TEMPLATES.find((t) => t.type === r.type)!.body;
    const content = fillTemplate(tpl, { ...(await dossierContext(d)), ...r.fields });
    const versions = r.versions ?? 1;
    const validated = r.status === "validee" || r.status === "deposee";
    const [row] = await db
      .insert(requetesTable)
      .values({
        dossierId: d.id,
        templateId,
        type: r.type === "custom" ? "autre" : r.type,
        title: r.title,
        content,
        status: r.status,
        currentVersion: versions,
        createdBy: U[r.author]!,
        validatedBy: validated ? U[r.validator ?? "associe"]! : null,
        validatedAt: validated ? ago(Math.max(0, r.daysAgo - 1), 17) : null,
        createdAt: ago(r.daysAgo + versions - 1),
        updatedAt: ago(r.daysAgo),
      })
      .returning();
    if (r.status === "a_valider" && !firstPendingRequete) firstPendingRequete = row!.id;
    for (let v = 1; v <= versions; v++) {
      const draft = v < versions ? content.replace(/\n\n\^ PAR CES MOTIFS[\s\S]*$/, "\n\n[Dispositif à rédiger]") : content;
      await db.insert(requeteVersionsTable).values({
        requeteId: row!.id,
        version: v,
        title: r.title,
        content: draft,
        comment: v === 1 ? "Créée à partir du modèle" : v === versions ? "Version finale après relecture" : "Ajout de l'exposé des faits",
        createdBy: U[v === versions && r.validator ? r.validator : r.author]!,
        createdAt: ago(r.daysAgo + versions - v),
      });
    }
    log(r.author, "requete.create", "requete", `Préparation de « ${r.title} »`, d, ago(r.daysAgo + versions - 1, 11), row!.id);
    if (r.status === "a_valider") log(r.author, "requete.submit", "requete", `Soumission pour validation : « ${r.title} »`, d, ago(r.daysAgo, 18), row!.id);
    if (validated) log(r.validator ?? "associe", "requete.validate", "requete", `Validation par l'avocat : « ${r.title} »`, d, ago(Math.max(0, r.daysAgo - 1), 17), row!.id);
  }

  /* ---------------------------------------------------------------- */
  /* Démarches au palais (12)                                         */
  /* ---------------------------------------------------------------- */
  type DemarcheSeed = { dossier: string; type: string; jurisdiction?: string; assignee: string; planned: number; executed?: number; status: string; observations?: string; result?: string; justificatif?: string };
  const demarcheSeeds: DemarcheSeed[] = [
    { dossier: "abc", type: "consultation_dossier", assignee: "stagiaire", planned: -20, executed: -20, status: "effectuee", observations: "Vérification au greffe de l'absence de procédure antérieure entre les parties.", result: "Aucune procédure enregistrée." },
    { dossier: "abc", type: "depot_requete", assignee: "stagiaire", planned: -3, executed: -3, status: "effectuee", observations: "Requête déposée, en attente du numéro de rôle.", result: "Récépissé de dépôt délivré par le greffe.", justificatif: "Récépissé de dépôt de la requête" },
    { dossier: "abc", type: "suivi_procedure", assignee: "stagiaire", planned: 3, status: "a_effectuer", observations: "Récupérer le numéro de rôle et la date de la première audience." },
    { dossier: "ndar", type: "depot_pieces", assignee: "stagiaire", planned: -11, executed: -11, status: "effectuee", observations: "Dépôt du bordereau de pièces complémentaires au greffe.", result: "Visa du greffe apposé." },
    { dossier: "ndar", type: "renseignements", assignee: "collab", planned: -1, status: "en_attente", observations: "Demande de renseignements sur la composition de la chambre pour l'audience.", result: "Le greffe doit rappeler." },
    { dossier: "fall", type: "depot_requete", jurisdiction: TT, assignee: "assistant", planned: -18, executed: -17, status: "effectuee", observations: "Dépôt de la requête au greffe du tribunal du travail.", result: "Enrôlée sous le n° TT 567/2026.", justificatif: "Accusé de dépôt — tribunal du travail" },
    { dossier: "faye", type: "retrait_documents", assignee: "associe", planned: 1, status: "a_effectuer", observations: "Retirer la convocation des parties pour l'audience de conciliation." },
    { dossier: "teranga", type: "retrait_documents", assignee: "assistant", planned: -10, executed: -9, status: "effectuee", observations: "Retrait de la grosse du jugement au greffe.", result: "Grosse retirée, transmise à l'huissier." },
    { dossier: "diouf", type: "depot_pieces", assignee: "stagiaire", planned: 0, status: "en_cours", observations: "Dépôt du bordereau de pièces et de la requête en référé (sous réserve de validation de la requête)." },
    { dossier: "seck", type: "consultation_dossier", jurisdiction: "Commissariat central (fictif)", assignee: "stagiaire", planned: -2, status: "reportee", observations: "Consultation du procès-verbal d'accident : service fermé ce jour, reportée.", result: "Nouvelle date à fixer." },
    { dossier: "batir", type: "suivi_procedure", assignee: "collab", planned: 5, status: "a_effectuer", observations: "Suivi du dépôt du cahier des charges et de la date d'adjudication." },
    { dossier: "btp", type: "autre", jurisdiction: "Chantier — Résidence Les Filaos (fictif)", assignee: "juriste", planned: -6, executed: -6, status: "effectuee", observations: "Assistance à la réunion d'expertise amiable sur site.", result: "Compte rendu rédigé et versé au dossier." },
  ];
  for (const s of demarcheSeeds) {
    const d = D[s.dossier]!;
    const [row] = await db
      .insert(demarchesTable)
      .values({
        cabinetId,
        dossierId: d.id,
        type: s.type,
        jurisdiction: s.jurisdiction ?? d.jurisdiction ?? "Greffe",
        assigneeId: U[s.assignee]!,
        plannedDate: day(s.planned),
        executedDate: s.executed !== undefined ? day(s.executed) : null,
        status: s.status,
        observations: s.observations ?? null,
        result: s.result ?? null,
        createdBy: U[d.responsibleId === U.associe ? "associe" : "collab"]!,
        createdAt: ago(Math.max(1, -s.planned + 4)),
        updatedAt: ago(Math.max(0, -(s.executed ?? s.planned))),
      })
      .returning();
    if (s.justificatif) {
      await addDocument(`dm_${row!.id}`, s.dossier, s.justificatif, "justificatif", s.assignee, Math.max(0, -(s.executed ?? 0)), filler(`la démarche effectuée au ${s.jurisdiction ?? d.jurisdiction}`), row!.id);
    }
    log(s.assignee, "demarche.create", "demarche", `Démarche enregistrée : ${s.observations ?? s.type}`, d, ago(Math.max(0, -s.planned + 2), 12), row!.id);
    if (s.status === "effectuee") log(s.assignee, "demarche.update", "demarche", `Démarche effectuée — ${s.result ?? ""}`, d, ago(Math.max(0, -(s.executed ?? 0)), 16), row!.id);
  }

  /* ---------------------------------------------------------------- */
  /* Agenda : audiences, rendez-vous, échéances (14)                  */
  /* ---------------------------------------------------------------- */
  type EventSeed = { type: string; title: string; dossier?: string; day: number; h: number; m?: number; duration?: number; location?: string; assignee?: string; description?: string; status?: string };
  const eventSeeds: EventSeed[] = [
    { type: "audience", title: "Audience de mise en état — Ndar c. Ba & Fils", dossier: "ndar", day: 2, h: 9, duration: 120, location: TC, assignee: "collab", description: "Opposition à injonction de payer. Conclusions en réponse à déposer." },
    { type: "audience", title: "Audience de conciliation — Faye", dossier: "faye", day: 6, h: 10, duration: 90, location: TI, assignee: "associe" },
    { type: "audience", title: "Audience de jugement — Fall c. Atlantique Services", dossier: "fall", day: 9, h: 8, m: 30, duration: 180, location: TT, assignee: "collab2" },
    { type: "audience", title: "Audience correctionnelle — Ministère public c. Sy", dossier: "penal", day: 13, h: 9, duration: 240, location: `${TGI} — salle 3`, assignee: "collab" },
    { type: "audience", title: "Audience des référés — Diouf c. Kébé", dossier: "diouf", day: 16, h: 11, duration: 60, location: TI, assignee: "collab2" },
    { type: "rendez_vous", title: "Rendez-vous client — Aminata Diop", dossier: "succession", day: 0, h: 15, duration: 60, location: "Cabinet — salle de réunion", assignee: "associe", description: "Point sur l'évaluation de l'immeuble et la proposition de partage." },
    { type: "rendez_vous", title: "Premier rendez-vous — Coopérative Jokkoo", dossier: "jokkoo", day: 1, h: 10, m: 30, duration: 90, location: "Cabinet", assignee: "associe" },
    { type: "depot_requete", title: "Dépôt de la requête en référé — Diouf", dossier: "diouf", day: 0, h: 11, duration: 60, location: TI, assignee: "stagiaire" },
    { type: "deplacement", title: "Déplacement au palais — retrait de convocations", dossier: "faye", day: 1, h: 8, m: 30, duration: 120, location: TI, assignee: "associe" },
    { type: "echeance", title: "Échéance : conclusions en réponse — Ndar", dossier: "ndar", day: 1, h: 17, duration: 30, assignee: "collab", description: "Délai de communication des conclusions avant l'audience de mise en état." },
    { type: "echeance", title: "Échéance : délai d'appel — Teranga c. Diagne", dossier: "teranga", day: 4, h: 18, duration: 30, assignee: "collab", description: "Vérifier l'absence d'appel du débiteur avant exécution." },
    { type: "reunion", title: "Réunion hebdomadaire des dossiers", day: 3, h: 8, duration: 60, location: "Cabinet — salle de réunion" },
    { type: "audience", title: "Audience de plaidoirie — Ndar c. Sénégal Transit", dossier: "archive", day: -120, h: 9, duration: 120, location: TC, assignee: "collab", status: "termine" },
    { type: "rendez_vous", title: "Rendez-vous client — Rokhaya Seck", dossier: "seck", day: -4, h: 16, duration: 60, location: "Cabinet", assignee: "collab", status: "termine" },
  ];
  for (const e of eventSeeds) {
    const start = at(e.day, e.h, e.m ?? 0);
    const end = new Date(start.getTime() + (e.duration ?? 60) * 60_000);
    const d = e.dossier ? D[e.dossier]! : null;
    const [row] = await db
      .insert(eventsTable)
      .values({
        cabinetId,
        dossierId: d?.id ?? null,
        type: e.type,
        title: e.title,
        startAt: start,
        endAt: end,
        location: e.location ?? null,
        assigneeId: e.assignee ? U[e.assignee]! : null,
        description: e.description ?? null,
        reminderMinutes: e.type === "audience" ? 2880 : 1440,
        status: e.status ?? "prevu",
        createdBy: U.assistant!,
        createdAt: ago(Math.max(1, 10 - e.day)),
      })
      .returning();
    if (d && e.type === "audience") log("assistant", "event.create", "event", `Audience programmée : ${e.title}`, d, ago(Math.max(1, 10 - e.day), 14), row!.id);
  }

  /* ---------------------------------------------------------------- */
  /* Tâches (15)                                                      */
  /* ---------------------------------------------------------------- */
  type TaskSeed = { title: string; description?: string; dossier?: string; assignee: string; by: string; due?: number; priority: string; status: string; daysAgo: number };
  const taskSeeds: TaskSeed[] = [
    { title: "Préparer le bordereau de pièces complémentaires", dossier: "abc", assignee: "stagiaire", by: "associe", due: 1, priority: "haute", status: "en_cours", daysAgo: 2, description: "Ajouter les bons de livraison et vérifier la numérotation." },
    { title: "Corriger la demande de renvoi selon mes annotations", dossier: "abc", assignee: "stagiaire", by: "associe", due: 2, priority: "normale", status: "a_faire", daysAgo: 1 },
    { title: "Rédiger les conclusions en réponse", dossier: "ndar", assignee: "collab", by: "associe", due: 1, priority: "urgente", status: "en_cours", daysAgo: 6 },
    { title: "Effectuer les photocopies des factures (3 jeux)", dossier: "ndar", assignee: "assistant", by: "collab", due: -1, priority: "normale", status: "a_faire", daysAgo: 4 },
    { title: "Contacter la cliente pour le rendez-vous de suivi", dossier: "succession", assignee: "assistant", by: "associe", due: 0, priority: "normale", status: "terminee", daysAgo: 3 },
    { title: "Analyser le rapport d'évaluation de l'immeuble", dossier: "succession", assignee: "juriste", by: "associe", due: 5, priority: "haute", status: "en_cours", daysAgo: 8 },
    { title: "Préparer le dossier de plaidoirie", dossier: "fall", assignee: "collab2", by: "collab2", due: 7, priority: "haute", status: "a_faire", daysAgo: 5 },
    { title: "Déposer la requête en référé au palais", dossier: "diouf", assignee: "stagiaire", by: "collab2", due: 0, priority: "urgente", status: "en_attente", daysAgo: 2, description: "En attente de la validation de la requête par Me Cissé." },
    { title: "Préparer l'audience de conciliation", dossier: "faye", assignee: "associe", by: "associe", due: 5, priority: "haute", status: "a_faire", daysAgo: 7 },
    { title: "Faire signifier le jugement par huissier", dossier: "teranga", assignee: "assistant", by: "collab", due: 3, priority: "normale", status: "en_cours", daysAgo: 9 },
    { title: "Rechercher la jurisprudence sur le retrait d'agrément", dossier: "jokkoo", assignee: "juriste", by: "associe", due: 6, priority: "normale", status: "a_faire", daysAgo: 2 },
    { title: "Obtenir le procès-verbal de police", dossier: "seck", assignee: "stagiaire", by: "collab", due: -2, priority: "haute", status: "en_attente", daysAgo: 6, description: "Démarche reportée : service fermé." },
    { title: "Relancer le bailleur sur la proposition de loyer", dossier: "bail", assignee: "collab2", by: "collab2", due: -3, priority: "basse", status: "a_faire", daysAgo: 15 },
    { title: "Classer et archiver le dossier Sénégal Transit", dossier: "archive", assignee: "assistant", by: "collab", due: -30, priority: "basse", status: "terminee", daysAgo: 40 },
    { title: "Mettre à jour le tableau de suivi des provisions", assignee: "comptable", by: "admin", due: 4, priority: "normale", status: "a_faire", daysAgo: 3 },
  ];
  for (const t of taskSeeds) {
    const d = t.dossier ? D[t.dossier]! : null;
    const [row] = await db
      .insert(tasksTable)
      .values({
        cabinetId,
        dossierId: d?.id ?? null,
        title: t.title,
        description: t.description ?? null,
        assigneeId: U[t.assignee]!,
        createdBy: U[t.by]!,
        dueDate: t.due !== undefined ? day(t.due) : null,
        priority: t.priority,
        status: t.status,
        completedAt: t.status === "terminee" ? ago(Math.max(0, t.daysAgo - 2)) : null,
        createdAt: ago(t.daysAgo),
      })
      .returning();
    log(t.by, "task.create", "task", `Tâche « ${t.title} » attribuée`, d, ago(t.daysAgo, 9), row!.id);
  }

  /* ---------------------------------------------------------------- */
  /* Facturation : factures, règlements, dépenses                     */
  /* ---------------------------------------------------------------- */
  type InvoiceSeed = { n: number; dossier: string; issued: number; due: number; lines: [string, string, number, number][]; payments: [number, number, string, string | null][]; status?: string };
  const invoiceSeeds: InvoiceSeed[] = [
    { n: 1, dossier: "palmiers", issued: -90, due: -60, lines: [["Audit des contrats de travail — forfait", "honoraires", 1, 1_500_000], ["Rédaction du règlement intérieur", "honoraires", 1, 600_000]], payments: [[-70, 2_100_000, "virement", "VIR-0001"]] },
    { n: 2, dossier: "ndar", issued: -70, due: -40, lines: [["Provision sur honoraires — procédure d'injonction de payer", "honoraires", 1, 750_000], ["Frais de greffe et de signification", "frais", 1, 85_000]], payments: [[-50, 835_000, "cheque", "CHQ-1103"]] },
    { n: 3, dossier: "abc", issued: -45, due: -15, lines: [["Provision sur honoraires — action au fond", "honoraires", 1, 1_200_000], ["Consultation préalable", "honoraires", 2, 100_000]], payments: [[-30, 700_000, "virement", "VIR-0002"]] },
    { n: 4, dossier: "fall", issued: -40, due: -10, lines: [["Honoraires — procédure prud'homale (forfait)", "honoraires", 1, 450_000]], payments: [] },
    { n: 5, dossier: "teranga", issued: -12, due: 18, lines: [["Honoraires de résultat — jugement obtenu", "honoraires", 1, 900_000], ["Frais d'huissier (avance)", "frais", 1, 120_000]], payments: [[-5, 300_000, "mobile_money", "OM-58421"]] },
    { n: 6, dossier: "succession", issued: -8, due: 22, lines: [["Provision sur honoraires — partage successoral", "honoraires", 1, 800_000]], payments: [] },
    { n: 7, dossier: "diouf", issued: 0, due: 30, lines: [["Provision — procédure d'expulsion", "honoraires", 1, 350_000]], payments: [], status: "brouillon" },
  ];
  for (const inv of invoiceSeeds) {
    const d = D[inv.dossier]!;
    const issueDate = day(inv.issued);
    const number = `FAC-${issueDate.slice(0, 4)}-${String(inv.n).padStart(3, "0")}`;
    const [row] = await db
      .insert(invoicesTable)
      .values({ cabinetId, number, dossierId: d.id, clientId: d.clientId, issueDate, dueDate: day(inv.due), status: inv.status ?? "emise", createdBy: U.comptable!, createdAt: ago(-inv.issued) })
      .returning();
    await db.insert(invoiceLinesTable).values(inv.lines.map(([description, kind, quantity, unitPrice]) => ({ invoiceId: row!.id, description, kind, quantity, unitPrice })));
    log("comptable", "invoice.create", "invoice", `Facture ${number} émise`, d, ago(-inv.issued, 11), row!.id);
    for (const [when, amount, method, reference] of inv.payments) {
      await db.insert(paymentsTable).values({ invoiceId: row!.id, amount, paidAt: day(when), method, reference, recordedBy: U.comptable!, createdAt: ago(-when) });
      log("comptable", "payment.create", "payment", `Règlement de ${amount.toLocaleString("fr-FR").replace(/ /g, " ")} FCFA sur la facture ${number}`, d, ago(-when, 15));
    }
  }
  const expenseSeeds: [string | null, number, string, string, number, boolean][] = [
    ["ndar", -48, "greffe", "Frais de greffe — enrôlement de l'opposition", 25_000, true],
    ["abc", -3, "timbres", "Timbres fiscaux — dépôt de la requête", 10_000, true],
    ["abc", -3, "deplacement", "Taxi — dépôt au tribunal de commerce", 6_000, true],
    ["teranga", -9, "huissier", "Signification du jugement", 60_000, true],
    ["fall", -20, "reprographie", "Copies des pièces (3 jeux)", 7_500, true],
    [null, -15, "autre", "Abonnement revue juridique (fictive)", 45_000, false],
  ];
  for (const [dk, when, category, description, amount, rebillable] of expenseSeeds) {
    await db.insert(expensesTable).values({ cabinetId, dossierId: dk ? D[dk]!.id : null, expenseDate: day(when), category, description, amount, rebillable, recordedBy: U.comptable!, createdAt: ago(-when) });
  }

  await db.insert(auditLogTable).values(history);
  logger.info({ ms: Date.now() - started, firstPendingRequete }, "Données de démonstration chargées");
}
