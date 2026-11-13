import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import pg from "pg";
import * as schema from "./schema";

/**
 * Deux modes de stockage, même dialecte PostgreSQL et même schéma Drizzle :
 *
 * - `DATABASE_URL` défini  → serveur PostgreSQL (Replit, production) ;
 * - sinon                  → PGlite, PostgreSQL embarqué persistant sur
 *   disque (`PGLITE_DATA_DIR`, par défaut `./data/pgdata`). Aucun service à
 *   installer pour faire tourner la démonstration.
 */
export type Database = NodePgDatabase<typeof schema>;

export const databaseMode: "postgres" | "pglite" = process.env.DATABASE_URL ? "postgres" : "pglite";

let pool: pg.Pool | null = null;
let pglite: PGlite | null = null;
let database: Database;

if (process.env.DATABASE_URL) {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  database = drizzlePg(pool, { schema });
} else {
  // « memory:// » : base éphémère en mémoire (déploiement serverless de démo).
  const configured = process.env.PGLITE_DATA_DIR;
  if (configured === "memory://") {
    pglite = new PGlite();
  } else {
    const dataDir = path.resolve(configured ?? path.join(process.cwd(), "data", "pgdata"));
    fs.mkdirSync(dataDir, { recursive: true });
    pglite = new PGlite(dataDir);
  }
  // L'API du constructeur de requêtes est identique entre les deux pilotes.
  database = drizzlePglite(pglite, { schema }) as unknown as Database;
}

export const db: Database = database;

/** Applique les migrations SQL générées par drizzle-kit. */
export async function migrateDatabase(migrationsFolder: string): Promise<void> {
  if (pool) {
    await migratePg(drizzlePg(pool), { migrationsFolder });
  } else if (pglite) {
    await migratePglite(drizzlePglite(pglite), { migrationsFolder });
  }
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  await pglite?.close();
}

export * from "./schema";
// Opérateurs réexportés pour garantir une seule instance de drizzle-orm.
export { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, like, lt, lte, ne, or, sql, sum } from "drizzle-orm";
