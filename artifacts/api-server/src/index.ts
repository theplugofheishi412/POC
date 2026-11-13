import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { databaseMode, migrateDatabase } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { resetDemoData, seedIfEmpty } from "./seed";

// Port par défaut aligné sur la configuration Replit (artifact.toml).
const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/** Dossier des migrations : copié dans dist/ au build, sinon lib/db/drizzle. */
function migrationsFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.join(here, "migrations"),
    path.resolve(here, "..", "..", "..", "lib", "db", "drizzle"),
  ].filter((p): p is string => !!p);
  const found = candidates.find((p) => fs.existsSync(path.join(p, "meta", "_journal.json")));
  if (!found) throw new Error(`Migrations introuvables (cherchées dans : ${candidates.join(", ")})`);
  return found;
}

async function main() {
  await migrateDatabase(migrationsFolder());
  if (process.argv.includes("--reset-only")) {
    await resetDemoData();
    logger.info("Données de démonstration réinitialisées");
    process.exit(0);
  }
  const seeded = await seedIfEmpty();
  logger.info({ databaseMode, seeded }, seeded ? "Base initialisée avec les données de démonstration" : "Base de données prête");

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Échec du démarrage de l'API");
  process.exit(1);
});
