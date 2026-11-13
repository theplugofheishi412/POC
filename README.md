# TechSolution Cabinet — POC de gestion de cabinet d'avocats

Prototype fonctionnel développé par **TechSolution** : clients et justiciables, dossiers juridiques, pièces et bordereaux, requêtes et actes, démarches au palais de justice, agenda et audiences, tâches de l'équipe, facturation en FCFA, utilisateurs, rôles et journal d'audit.

> **Toutes les données sont fictives.** Les documents générés à partir des modèles sont des **projets de démonstration à faire valider par un avocat** : ils ne constituent jamais des actes juridiquement validés.

---

## 1. Installation

Prérequis : **Node.js 24** et **pnpm** (le monorepo refuse npm et yarn). Aucune base de données à installer.

```bash
pnpm install
```

## 2. Lancement

| Commande | Usage |
|---|---|
| `pnpm dev` | Développement : API sur http://localhost:8080 + interface sur **http://localhost:5173** (rechargement à chaud) |
| `pnpm start` | Démonstration : compile tout et sert l'application complète sur **http://localhost:8080** (un seul processus) |
| `pnpm demo:reset` | Remet les données de démonstration dans leur état d'origine (à faire avant chaque séance) |
| `pnpm verify` | Typecheck des 5 paquets + build de l'API et du frontend |
| `pnpm --filter @workspace/scripts run smoke` | Test de bout en bout de l'API (55 vérifications, API démarrée sur :8080) |

Au premier démarrage, l'API crée la base et charge automatiquement le jeu de démonstration. Les dates (audiences, échéances…) sont calculées **par rapport au jour du chargement** : lancez `pnpm demo:reset` le jour de la démonstration pour que l'agenda soit d'actualité.

Variables d'environnement (toutes facultatives) :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `8080` (API) / `5173` (Vite) | Port d'écoute (fourni par Replit) |
| `BASE_PATH` | `/` | Chemin de base du frontend (Replit) |
| `API_PORT` | `8080` | Port de l'API ciblé par le proxy Vite `/api` |
| `DATABASE_URL` | — | Si défini : PostgreSQL. Sinon : PostgreSQL embarqué (PGlite) dans `artifacts/api-server/data/` |
| `DATA_DIR` / `PGLITE_DATA_DIR` | `./data` | Emplacement des fichiers téléversés / de la base embarquée |
| `DEMO_MODE` | `true` | `false` désactive la connexion en un clic |
| `DEMO_PASSWORD` | `Demo2026!` | Mot de passe des comptes de démonstration (au chargement) |
| `CORS_ORIGIN` | aucune | Origines tierces autorisées (même origine par défaut) |
| `SESSION_SECRET` | — | Si défini : sessions signées sans état (utilisé sur Vercel) |

### Déploiement sur Vercel (démo en ligne, sans service externe)

1. Pousser le dépôt sur GitHub, puis sur vercel.com : **Add New → Project → importer le dépôt**. Ne rien modifier dans les réglages : `vercel.json` fournit les commandes d'installation et de build.
2. Cliquer sur **Deploy**. L'application et l'API sont servies à la même adresse (`https://<projet>.vercel.app`).

Fonctionnement (`scripts/vercel-build.mjs`, Build Output API) : le frontend est publié en statique ; l'API Express tourne dans une fonction Vercel (`/api`) avec une base PGlite **en mémoire**, rechargée avec le jeu de démonstration à chaque démarrage d'instance. Les sessions sont signées (secret aléatoire généré à chaque déploiement).

À savoir : les modifications faites pendant une démo (clients créés, pièces téléversées…) durent tant que l'instance reste active, puis disparaissent — les données de démonstration reviennent d'elles-mêmes. Le premier appel après une période d'inactivité prend quelques secondes (chargement des données). Pour une persistance réelle, utiliser `pnpm start` sur un serveur ou définir `DATABASE_URL`.

## 3. Comptes de démonstration

Mot de passe commun : **`Demo2026!`** — ou connexion en un clic depuis l'écran de connexion.

| Rôle | Nom (fictif) | Email |
|---|---|---|
| Administrateur du cabinet | Khady Ndour | khady.ndour@cabinet-demo.example |
| **Avocat associé** (parcours recommandé) | Aïssatou Ndiaye | aissatou.ndiaye@cabinet-demo.example |
| Avocat collaborateur | Ousmane Sarr | ousmane.sarr@cabinet-demo.example |
| Avocat collaborateur | Marième Cissé | marieme.cisse@cabinet-demo.example |
| Juriste | Mariama Ba | mariama.ba@cabinet-demo.example |
| Avocat stagiaire | Ibrahima Diallo | ibrahima.diallo@cabinet-demo.example |
| Assistant juridique | Fatou Mbengue | fatou.mbengue@cabinet-demo.example |
| Comptable | Cheikh Gueye | cheikh.gueye@cabinet-demo.example |

## 4. Jeu de données fictives

Cabinet « Ndiaye, Sarr & Associés » (Dakar) : **8 utilisateurs, 12 clients** (personnes physiques et morales), **15 dossiers** couvrant les 8 domaines et les 8 statuts (dont 3 confidentiels et 1 restreint), **plusieurs parties par dossier**, **22 documents PDF** (spécimens générés), **35 pièces numérotées**, **8 bordereaux**, **6 modèles fournis + 1 modèle du cabinet**, **10 requêtes** (brouillon, à valider, validées, déposées, avec versions), **12 démarches au palais**, **14 événements d'agenda**, **15 tâches**, **7 factures** (payées, partielles, impayées, en retard, brouillon), règlements, dépenses et un historique de plus de 120 opérations.

Toutes les données sont reliées. Par exemple, le dossier **DOS-2026-001 « ABC Distribution c. XYZ Logistique »** a un client, une partie adverse et son conseil, un représentant légal, un avocat responsable, un stagiaire et une juriste dans l'équipe, 6 pièces avec leurs fichiers, 2 bordereaux, 2 requêtes, 3 démarches dont le dépôt de requête effectué par le stagiaire (« Requête déposée, en attente du numéro de rôle »), des tâches et une facture partiellement réglée.

## 5. Guide rapide de prise en main

- **Navigation** : la barre latérale donne accès aux modules autorisés pour votre rôle. Sur mobile, elle s'ouvre avec le bouton ☰.
- **Recherche globale** : la barre en haut de l'écran (ou **Ctrl + K**) cherche dans les clients, les dossiers (référence, intitulé, n° de rôle) et les documents.
- **Notifications** (cloche) : rappels d'audiences et d'échéances, tâches en retard, actes à valider, nouvelles tâches attribuées.
- **Tableau de bord** : indicateurs cliquables, graphiques par domaine et par statut, prochaines audiences, échéances urgentes, dernières opérations, mes tâches, et un **parcours guidé en 10 étapes**.
- **Fiche dossier** : actions rapides en tête de page (pièces, document, requête, démarche, audience, tâche) et onglets *Synthèse / Pièces & bordereaux / Documents / Requêtes / Démarches / Agenda / Tâches / Facturation / Historique*.
- **Pièces & bordereaux** : ajoutez des pièces (avec un fichier PDF ou une image en option), réordonnez-les par glisser-déposer ou avec les flèches, puis cliquez sur **Générer un bordereau**. Vous pouvez ensuite prévisualiser, télécharger le PDF, imprimer, et finaliser le bordereau (réservé aux avocats).
- **Requêtes** : choisissez un modèle ; les informations du dossier sont insérées automatiquement. Rédigez avec l'aperçu en direct, chaque enregistrement crée une version, et vous pouvez exporter en PDF ou en Word. Le circuit de validation suit les étapes *brouillon → à valider → validée → déposée*.
- **Démarches** : chaque démarche indique qui la fait, où et quand, avec son statut, son résultat et ses justificatifs. Elles s'affichent en liste ou en chronologie.
- **Agenda** : vues mois / semaine / jour. Cliquez sur un créneau pour créer un événement. Les échéances à moins de 72 h sont encadrées de rouge.
- **Tâches** : tableau Kanban ; glissez une carte pour changer son statut.
- **Facturation** : créez une facture, puis encaissez un montant inférieur pour enregistrer un paiement partiel. La facture est disponible en PDF avec le montant en lettres.

## 6. Scénario de démonstration (≈ 20 min)

1. **Connexion** en un clic : *Aïssatou Ndiaye — Avocate associée*.
2. **Tableau de bord** : indicateurs, audiences de la semaine, échéances en retard, activité de l'équipe.
3. **Clients** → rechercher « ABC » → fiche **SARL ABC Distribution** (identité, dossiers, historique).
4. Ouvrir le dossier **DOS-2026-001** : synthèse, parties multiples, équipe.
5. Onglet **Pièces & bordereaux** → *Ajouter une pièce* (ex. « Facture litigieuse », 3 pages, joindre un PDF) → la remonter en n° 1.
6. **Générer un bordereau** → aperçu PDF → *Finaliser* → *Télécharger* / *Imprimer*.
7. **Préparer une requête** → modèle « Requête introductive d'instance » → compléter l'objet → relire dans l'éditeur → *Enregistrer une version* → *Aperçu PDF* / *Word*.
8. **Démarche au palais** → « Dépôt de pièces » au tribunal de commerce, confiée au stagiaire.
9. **Programmer une audience** → elle apparaît dans l'agenda et dans la fiche du dossier.
10. **Attribuer une tâche** à Ibrahima Diallo (stagiaire) : « Préparer le bordereau complémentaire ».
11. Onglet **Historique** : toutes les opérations précédentes, horodatées et nominatives.
12. *(Bonus — rôles)* Se déconnecter puis se connecter comme **stagiaire**. Le stagiaire ne voit pas les dossiers confidentiels, retrouve sa tâche, prépare une requête et la **soumet**, mais ne peut pas la valider. Se reconnecter comme associée : la notification « Acte à valider » apparaît, l'associée valide.

## 7. Architecture

Monorepo pnpm (architecture d'origine conservée) :

```
artifacts/api-server        API Express 5 (TypeScript, bundle esbuild)
  src/lib/                  auth (sessions), access (droits / confidentialité), audit,
                            pdf (pdfkit), richtext (Word), storage (fichiers), templating
  src/routes/               auth, users, clients, dossiers, documents (pièces, bordereaux),
                            requetes (modèles, versions, validation), activity (démarches,
                            agenda, tâches), billing, overview (dashboard, recherche,
                            notifications, audit)
  src/seed/                 jeu de données fictives + modèles de documents
artifacts/cabinet-avocat-poc  React 19 + Vite 7 + Tailwind 4 + Radix/shadcn + React Query + Wouter
  src/pages/                une page par module
  src/components/app|dossier|forms   composants métier réutilisables
lib/db                      schéma Drizzle (22 tables) + migrations SQL (lib/db/drizzle)
lib/api-zod                 contrats partagés : énumérations, matrice des droits, schémas Zod, DTO
lib/api-client-react        client HTTP (customFetch) réutilisé par le frontend
scripts/                    run.mjs (dev / start / verify / reset), smoke.ts (test API)
```

**Choix d'architecture (justifiés)**

- **PGlite** (PostgreSQL embarqué) quand `DATABASE_URL` est absent. Le poste du client n'a rien à installer, et l'on garde le même dialecte, le même schéma Drizzle et les mêmes migrations qu'en PostgreSQL serveur (Replit, production).
- **Contrats Zod partagés** dans `lib/api-zod/src/contracts`. Les mêmes règles de validation s'appliquent dans les formulaires et dans l'API. Ils sont écrits à la main plutôt que générés depuis OpenAPI, ce qui était disproportionné pour un POC ; le point `healthz` reste généré par Orval.
- **PDF générés côté serveur** (pdfkit) : les droits d'accès s'appliquent et chaque export est journalisé. L'export **Word** est un `.doc` HTML, sans dépendance supplémentaire.
- Deux dépendances ajoutées seulement : `@electric-sql/pglite` et `pdfkit` (+ `@types/pdfkit`).

## 8. Sécurité et confidentialité

- **Sessions** par cookie httpOnly / SameSite=Lax (jeton aléatoire, seule son empreinte SHA-256 est stockée, expiration 8 h). Mots de passe hachés en **scrypt**. Tentatives de connexion limitées.
- **Aucun secret ni mot de passe dans le frontend** : la connexion en un clic passe par une route serveur dédiée, désactivable (`DEMO_MODE=false`).
- **Droits vérifiés par l'API** à chaque requête (matrice de 19 droits × 7 rôles). Le frontend ne fait que masquer les actions indisponibles.
- **Confidentialité des dossiers** : associés et administrateur voient tout. L'avocat responsable et les membres de l'équipe voient leurs dossiers. Les collaborateurs, juristes, assistants et le comptable voient en plus les dossiers « standard ». Le stagiaire ne voit que les dossiers auxquels il est affecté. Un dossier non autorisé répond 404, pour ne pas révéler son existence.
- **Fichiers** : stockés hors du dossier public sous un nom aléatoire. Le format est vérifié sur la signature binaire (PDF / PNG / JPEG / WEBP), la taille est limitée à 10 Mo, et chaque téléchargement exige l'accès au dossier.
- **Journal d'audit** : connexions, créations et modifications, affectations, validations, exports PDF et Word, consultations de documents confidentiels.
- **Multi-cabinet** : chaque entité porte un `cabinetId` et chaque requête est filtrée par le cabinet de l'utilisateur.

## 9. Fonctionnalités réalisées

| Module | État |
|---|---|
| Connexion, comptes de démo, déconnexion, session expirée → retour à la connexion | ✅ |
| A. Tableau de bord : 8 indicateurs, graphiques par domaine et par statut, audiences, échéances urgentes, activité, mes tâches, parcours guidé | ✅ |
| B. Clients : CRUD, personnes physiques et morales, recherche, filtres, pagination, fiche, dossiers, historique, archivage et suppression selon les règles métier | ✅ |
| C. Dossiers : référence automatique, recherche multicritère, 6 filtres, parties multiples, équipe, affectation, statuts, confidentialité, historique | ✅ |
| D. Pièces et bordereaux : CRUD, réorganisation (glisser-déposer), fichier joint, bordereau figé, aperçu, PDF, impression, finalisation | ✅ |
| E. Requêtes : 6 modèles + modèles du cabinet, champs automatiques, éditeur avec aperçu, versions et restauration, validation, PDF, Word | ✅ |
| F. Démarches : 7 types, 5 statuts, justificatifs, chronologie par dossier et globale, indicateurs | ✅ |
| G. Agenda : vues mois / semaine / jour, création au clic, modification, suppression, attribution, rappels, échéances urgentes | ✅ |
| H. Tâches : Kanban à 4 colonnes, glisser-déposer, attribution (accès au dossier ouvert automatiquement), priorités, retards | ✅ |
| I. Facturation : factures à lignes multiples, paiements partiels, impayés et retards, dépenses, PDF avec montant en lettres | ✅ |
| J. Utilisateurs et rôles : 7 profils, matrice des droits, création, modification, désactivation (administrateur) | ✅ |
| Interface en français, responsive, notifications, états de chargement et d'erreur | ✅ |

**Vérifications effectuées** : typecheck des 5 paquets, build de l'API et du frontend, test API de bout en bout (55/55), parcours d'interface automatisé dans Edge (formulaires, validation, toasts, bordereau, persistance après actualisation, droits du stagiaire, affichage mobile sans défilement horizontal), persistance après redémarrage du serveur, mode production sur base vierge.

## 10. Limitations connues

- Notifications **dans l'application** uniquement (pas d'email, de SMS ni de WhatsApp). Les rappels sont calculés à l'affichage.
- L'export Word est un `.doc` au format HTML : il s'ouvre et se modifie dans Word, mais ce n'est pas un `.docx` natif.
- Éditeur de requêtes en texte avec mise en forme légère (`#`, `##`, `>`, `^`, `-`), pas un traitement de texte complet.
- Fichiers stockés sur le disque local du serveur, sans antivirus ni chiffrement au repos.
- Pas de récupération de mot de passe, de double authentification ni de gestion multi-cabinet dans l'interface (le modèle de données la prévoit).
- Pas de TVA ni de numérotation fiscale réglementaire. Montants en FCFA entiers.
- Les dates du jeu de démonstration sont relatives au jour de son chargement (`pnpm demo:reset`).
- Le script racine `pnpm run typecheck` (appel `pnpm` imbriqué) échoue sur ce poste Windows à cause de l'installation globale de pnpm 12 ; `pnpm verify` effectue les mêmes contrôles sans cet appel imbriqué.

## 11. Recommandations pour la V1 commerciale

1. **Hébergement et données** : PostgreSQL managé (`DATABASE_URL`), stockage objet chiffré pour les pièces, sauvegardes, hébergement conforme à la réglementation locale sur les données personnelles.
2. **Sécurité** : double authentification, politique de mots de passe, réinitialisation par email, sessions révocables, chiffrement au repos des pièces, journal d'audit exportable et scellé, test d'intrusion.
3. **Production documentaire** : export `.docx` natif, éditeur riche, bibliothèque de modèles validée par les avocats du cabinet, fusion des bordereaux et des pièces en un PDF unique paginé, signature électronique.
4. **Communication** : rappels par email, SMS ou WhatsApp, portail client sécurisé (suivi du dossier, dépôt de pièces).
5. **Gestion** : temps passés et honoraires au temps, conventions d'honoraires, TVA et numérotation conforme, relances automatiques, exports comptables.
6. **Organisation** : paramétrage du cabinet (juridictions, types de procédure, catégories), multi-cabinet dans l'interface, droits fins par dossier, tableaux de bord par avocat.
7. **Qualité** : tests automatisés (API et parcours d'interface) en intégration continue, supervision et journalisation centralisée.
