# TechSolution Cabinet — POC de gestion de cabinet d'avocats

Prototype interactif (en français) permettant à un cabinet d'avocats de gérer clients, dossiers, pièces et bordereaux, requêtes, démarches au palais, agenda, tâches et facturation (FCFA). Documentation complète : `README.md`.

## Run & Operate

- `pnpm dev` — API (:8080) + frontend Vite (:5173, proxy `/api`)
- `pnpm start` — build complet, un seul serveur (:8080) qui sert aussi le frontend
- `pnpm verify` — typecheck de tous les paquets + builds (sans appel pnpm imbriqué)
- `pnpm demo:reset` — recharge les données de démonstration
- `pnpm --filter @workspace/scripts run smoke` — test API de bout en bout
- `pnpm --filter @workspace/db run generate` — régénérer les migrations SQL après modification du schéma
- Env facultatif : `DATABASE_URL` (PostgreSQL ; sinon PGlite embarqué dans `artifacts/api-server/data`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API : Express 5, cookie de session httpOnly, pdfkit (PDF)
- DB : PostgreSQL ou PGlite + Drizzle ORM, migrations appliquées au démarrage
- Validation : Zod (v3) — schémas partagés `lib/api-zod/src/contracts`
- Frontend : React 19, Vite 7, Tailwind 4, Radix/shadcn, React Query, Wouter, react-hook-form

## Where things live

- Schéma DB : `lib/db/src/schema/index.ts` ; migrations : `lib/db/drizzle/`
- Contrats partagés (énumérations, droits par rôle, schémas, DTO) : `lib/api-zod/src/contracts/`
- Règles d'accès / confidentialité : `artifacts/api-server/src/lib/access.ts`
- Jeu de démonstration : `artifacts/api-server/src/seed/`
- Thème (bleu marine / doré) : `artifacts/cabinet-avocat-poc/src/index.css`, `src/lib/tones.ts`

## Architecture decisions

- PGlite par défaut pour une démo sans installation ; même dialecte et mêmes migrations que PostgreSQL.
- Contrats Zod écrits à la main (OpenAPI/Orval conservé pour `healthz`) : validation identique client/serveur.
- PDF générés côté serveur pour appliquer droits et journalisation ; Word = `.doc` HTML.
- Bordereaux = instantané figé des pièces au moment de la génération.
- L'API est seule autorité sur les droits ; un dossier non autorisé renvoie 404.

## Gotchas

- Après modification du schéma : `pnpm --filter @workspace/db run generate`, puis redémarrer l'API.
- Dans l'API, importer les opérateurs Drizzle depuis `@workspace/db` (une seule instance de drizzle-orm).
- Les dates du seed sont relatives au jour de chargement.
- Sous Windows avec pnpm 12 global, les scripts à `pnpm` imbriqué (`typecheck`, `build`) peuvent échouer : utiliser `pnpm verify`.
