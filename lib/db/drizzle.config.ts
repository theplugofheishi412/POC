import { defineConfig } from "drizzle-kit";

// `generate` n'a pas besoin de base ; `push` exige DATABASE_URL (PostgreSQL).
// En mode PGlite (démo locale), les migrations sont appliquées au démarrage
// de l'API à partir du dossier ./drizzle.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/cabinet",
  },
});
