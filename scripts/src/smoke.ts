/**
 * Test de fumée de l'API : parcours de démonstration + contrôles de droits.
 *
 *   pnpm --filter @workspace/scripts run smoke            (API sur :8080)
 *   API_URL=http://localhost:8090 pnpm --filter @workspace/scripts run smoke
 */
const API = (process.env.API_URL ?? "http://localhost:8080").replace(/\/$/, "") + "/api";
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo2026!";

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passes++;
    console.log(`  ✔ ${label}`);
  } else {
    failures++;
    console.log(`  ✘ ${label}`, detail ?? "");
  }
}

class Client {
  cookie = "";
  async req(method: string, path: string, body?: unknown, raw?: { data: Uint8Array; type: string }) {
    const headers: Record<string, string> = {};
    if (this.cookie) headers.cookie = this.cookie;
    let payload: string | Uint8Array | undefined;
    if (raw) {
      headers["content-type"] = raw.type;
      payload = raw.data;
    } else if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(API + path, { method, headers, body: payload });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0]!;
    const type = res.headers.get("content-type") ?? "";
    const data = type.includes("json") ? await res.json() : type.includes("pdf") || type.includes("msword") ? new Uint8Array(await res.arrayBuffer()) : await res.text();
    return { status: res.status, data: data as any, type };
  }
  async login(email: string) {
    const r = await this.req("POST", "/auth/login", { email, password: PASSWORD });
    return r;
  }
}

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

async function main() {
  console.log(`API : ${API}\n`);
  const anon = new Client();
  check("healthz", (await anon.req("GET", "/healthz")).data.status === "ok");
  check("route protégée sans session → 401", (await anon.req("GET", "/dossiers")).status === 401);
  check("mauvais mot de passe → 401", (await anon.req("POST", "/auth/login", { email: "aissatou.ndiaye@cabinet-demo.example", password: "x" })).status === 401);

  const accounts = (await anon.req("GET", "/auth/demo-accounts")).data as any[];
  check("7 rôles de démonstration", new Set(accounts.map((a) => a.role)).size === 7, accounts.length);
  const email = (role: string) => accounts.find((a) => a.role === role)!.email as string;

  /* 1. Connexion avocat associé */
  console.log("\nParcours avocat associé");
  const me = new Client();
  const login = await me.login(email("associe"));
  check("connexion associé", login.status === 200 && login.data.user.role === "associe", login.data);

  /* 2. Tableau de bord */
  const dash = (await me.req("GET", "/dashboard")).data;
  check("dashboard : 12 clients", dash.stats.clients === 12, dash.stats);
  check("dashboard : 15 dossiers au total", dash.byStatus.reduce((s: number, x: any) => s + x.count, 0) === 15);
  check("dashboard : audiences à venir", dash.stats.upcomingHearings >= 4);
  check("dashboard : échéances urgentes", dash.urgent.length > 0);

  /* 3. Fiche client */
  const clients = (await me.req("GET", "/clients?search=ABC")).data;
  const abc = clients.items[0];
  check("recherche client « ABC »", abc?.displayName === "SARL ABC Distribution", clients);
  const clientDossiers = (await me.req("GET", `/clients/${abc.id}/dossiers`)).data;
  check("dossiers du client", clientDossiers.length >= 1);
  const created = await me.req("POST", "/clients", { type: "physique", firstName: "Test", lastName: "Fumée", phone: "+221 77 999 99 99" });
  check("création client", created.status === 201, created.data);
  const invalid = await me.req("POST", "/clients", { type: "morale" });
  check("validation Zod client (400 + champs)", invalid.status === 400 && !!invalid.data.fields?.companyName, invalid.data);
  const upd = await me.req("PATCH", `/clients/${created.data.id}`, { type: "physique", firstName: "Test", lastName: "Fumée", email: "test@mail.example", city: "Dakar" });
  check("modification client", upd.status === 200 && upd.data.city === "Dakar");
  check("suppression client sans dossier", (await me.req("DELETE", `/clients/${created.data.id}`)).status === 204);
  check("archivage refusé si dossiers actifs", (await me.req("POST", `/clients/${abc.id}/archive`)).status === 409);

  /* 4. Dossier */
  const dossier = clientDossiers.find((d: any) => d.reference === "DOS-2026-001");
  const detail = (await me.req("GET", `/dossiers/${dossier.id}`)).data;
  check("détail dossier + parties", detail.parties.length >= 3 && detail.canEdit, detail.parties);
  const filtered = (await me.req("GET", "/dossiers?category=recouvrement&pageSize=50")).data;
  check("filtre catégorie recouvrement", filtered.items.every((d: any) => d.category === "recouvrement") && filtered.total === 3, filtered.total);
  const party = await me.req("POST", `/dossiers/${dossier.id}/parties`, { name: "Témoin Test", role: "autre" });
  check("ajout d'une partie", party.status === 201);

  /* 5. Pièces + upload */
  const pdfBytes = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
  const up = await me.req("POST", `/dossiers/${dossier.id}/documents?name=Facture%20test&filename=facture.pdf&category=piece`, undefined, { data: pdfBytes, type: "application/pdf" });
  check("téléversement PDF", up.status === 201 && up.data.mimeType === "application/pdf", up.data);
  const bad = await me.req("POST", `/dossiers/${dossier.id}/documents?filename=x.pdf`, undefined, { data: new TextEncoder().encode("MZ fake exe"), type: "application/pdf" });
  check("fichier non conforme refusé", bad.status === 400, bad.data);
  const piece = await me.req("POST", `/dossiers/${dossier.id}/pieces`, { designation: "Facture litigieuse", pages: 3, documentId: up.data.id });
  check("ajout pièce liée au document", piece.status === 201 && piece.data.document?.id === up.data.id, piece.data);
  const pieces = (await me.req("GET", `/dossiers/${dossier.id}/pieces`)).data as any[];
  const reordered = await me.req("POST", `/dossiers/${dossier.id}/pieces/reorder`, { ids: [piece.data.id, ...pieces.filter((p) => p.id !== piece.data.id).map((p) => p.id)] });
  check("réorganisation des pièces", reordered.data[0].id === piece.data.id && reordered.data[0].position === 1);

  /* 6. Bordereau PDF */
  const bord = await me.req("POST", `/dossiers/${dossier.id}/bordereaux`, { title: "Bordereau de test", bordereauDate: day(0), pieceIds: pieces.map((p) => p.id) });
  check("génération bordereau", bord.status === 201 && bord.data.itemCount === pieces.length, bord.data);
  const pdf = await me.req("GET", `/bordereaux/${bord.data.id}/pdf?download=1`);
  check("export PDF bordereau", pdf.type.includes("pdf") && new TextDecoder().decode(pdf.data.slice(0, 5)) === "%PDF-", pdf.status);
  const fin = await me.req("PATCH", `/bordereaux/${bord.data.id}`, { status: "finalise" });
  check("finalisation par l'avocat", fin.data.status === "finalise");

  /* 7. Requête */
  const templates = (await me.req("GET", "/templates")).data as any[];
  check("6 modèles fournis + 1 modèle cabinet", templates.filter((t) => t.isSystem).length === 6 && templates.length >= 7);
  const tpl = templates.find((t) => t.type === "requete_introductive");
  const rq = await me.req("POST", "/requetes", { dossierId: dossier.id, templateId: tpl.id, title: "Requête de test", fields: { objet: "Objet de test" } });
  check("requête créée depuis modèle", rq.status === 201 && rq.data.content.includes("SARL ABC Distribution") && rq.data.content.includes("Objet de test"));
  const rq2 = await me.req("PATCH", `/requetes/${rq.data.id}`, { content: rq.data.content + "\n\nParagraphe ajouté.", comment: "test" });
  check("nouvelle version", rq2.data.currentVersion === 2 && rq2.data.versions.length === 2);
  check("export PDF requête", (await me.req("GET", `/requetes/${rq.data.id}/pdf`)).type.includes("pdf"));
  check("export Word requête", (await me.req("GET", `/requetes/${rq.data.id}/word`)).type.includes("msword"));

  /* 8. Démarche */
  const users = (await me.req("GET", "/users")).data as any[];
  const stagiaire = users.find((u) => u.role === "stagiaire");
  const dm = await me.req("POST", "/demarches", { dossierId: dossier.id, type: "depot_pieces", jurisdiction: "Tribunal de commerce hors classe de Dakar", assigneeId: stagiaire.id, plannedDate: day(2), status: "a_effectuer" });
  check("enregistrement démarche", dm.status === 201, dm.data);
  const dmBad = await me.req("POST", "/demarches", { dossierId: dossier.id, type: "depot_pieces", jurisdiction: "TC", assigneeId: stagiaire.id, plannedDate: day(0), status: "effectuee" });
  check("démarche effectuée sans date → 400", dmBad.status === 400);

  /* 9. Audience */
  const start = new Date(Date.now() + 5 * 86400000);
  start.setHours(9, 0, 0, 0);
  const ev = await me.req("POST", "/events", { type: "audience", title: "Audience de test", dossierId: dossier.id, startAt: start.toISOString(), endAt: new Date(start.getTime() + 3600000).toISOString(), assigneeId: stagiaire.id });
  check("programmation audience", ev.status === 201);

  /* 10. Tâche pour le stagiaire */
  const task = await me.req("POST", "/tasks", { title: "Tâche de test", dossierId: dossier.id, assigneeId: stagiaire.id, priority: "haute", dueDate: day(1) });
  check("attribution tâche au stagiaire", task.status === 201 && task.data.assignee.id === stagiaire.id);

  /* 11. Historique */
  const hist = (await me.req("GET", `/dossiers/${dossier.id}/history`)).data as any[];
  check("historique du dossier alimenté", hist.length > 10 && hist[0].summary.includes("Tâche"), hist[0]);

  /* Facturation */
  const inv = await me.req("POST", "/invoices", { dossierId: dossier.id, issueDate: day(0), dueDate: day(30), lines: [{ description: "Honoraires test", kind: "honoraires", quantity: 1, unitPrice: 500000 }] });
  check("création facture", inv.status === 201 && inv.data.total === 500000, inv.data);
  const pay = await me.req("POST", `/invoices/${inv.data.id}/payments`, { amount: 200000, paidAt: day(0), method: "especes" });
  check("paiement partiel", pay.data.paymentState === "partielle" && pay.data.balance === 300000, pay.data);
  check("trop-perçu refusé", (await me.req("POST", `/invoices/${inv.data.id}/payments`, { amount: 400000, paidAt: day(0), method: "especes" })).status === 400);
  check("facture PDF", (await me.req("GET", `/invoices/${inv.data.id}/pdf`)).type.includes("pdf"));

  /* Rôles */
  console.log("\nContrôle des rôles");
  const stg = new Client();
  await stg.login(email("stagiaire"));
  const stgDossiers = (await stg.req("GET", "/dossiers?pageSize=50")).data;
  check("stagiaire : uniquement ses dossiers affectés", stgDossiers.total >= 3 && stgDossiers.total < 15, stgDossiers.total);
  const confidential = (await me.req("GET", "/dossiers?confidentiality=confidentiel&pageSize=50")).data.items[0];
  check("stagiaire : dossier confidentiel → 404", (await stg.req("GET", `/dossiers/${confidential.id}`)).status === 404);
  const docs = (await me.req("GET", `/dossiers/${confidential.id}/documents`)).data as any[];
  if (docs.length) check("stagiaire : fichier d'un dossier confidentiel → 404", (await stg.req("GET", `/documents/${docs[0].id}/file`)).status === 404);
  const stgReq = await stg.req("POST", "/requetes", { dossierId: dossier.id, title: "Brouillon stagiaire", fields: {} });
  check("stagiaire : prépare une requête", stgReq.status === 201);
  check("stagiaire : soumet pour validation", (await stg.req("POST", `/requetes/${stgReq.data.id}/submit`)).data.status === "a_valider");
  check("stagiaire : ne peut PAS valider", (await stg.req("POST", `/requetes/${stgReq.data.id}/validate`)).status === 403);
  check("associé : valide la requête", (await me.req("POST", `/requetes/${stgReq.data.id}/validate`)).data.status === "validee");
  check("stagiaire : met à jour sa tâche", (await stg.req("POST", `/tasks/${task.data.id}/status`, { status: "en_cours" })).data.status === "en_cours");
  check("stagiaire : pas d'accès facturation", (await stg.req("GET", "/invoices")).status === 403);
  check("stagiaire : ne peut pas créer de client", (await stg.req("POST", "/clients", { type: "physique", firstName: "a", lastName: "b", phone: "+221 77 000 00 00" })).status === 403);

  const cpt = new Client();
  await cpt.login(email("comptable"));
  check("comptable : accès facturation", (await cpt.req("GET", "/invoices")).status === 200);
  check("comptable : pas d'accès aux pièces", (await cpt.req("GET", `/dossiers/${dossier.id}/pieces`)).status === 403);
  check("comptable : pas de journal d'audit", (await cpt.req("GET", "/audit")).status === 403);
  check("associé : journal d'audit", (await me.req("GET", "/audit")).data.total > 50);

  check("déconnexion", (await me.req("POST", "/auth/logout")).status === 204);
  check("session invalidée après déconnexion", (await me.req("GET", "/auth/me")).status === 401);

  console.log(`\n${passes} vérifications réussies, ${failures} échec(s).`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
