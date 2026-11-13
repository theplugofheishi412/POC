/**
 * Point d'entrée « fonction Vercel » de l'API (déploiement de démonstration).
 *
 * Chaque instance démarre avec une base PGlite en mémoire, crée le schéma puis
 * charge le jeu de démonstration. Les modifications faites pendant la démo
 * durent tant que l'instance est active, puis tout repart des données de
 * démonstration : aucun service externe n'est nécessaire.
 *
 * Variables fixées par scripts/vercel-build.mjs : PGLITE_DATA_DIR=memory://,
 * DATA_DIR=/tmp/cabinet, SESSION_SECRET (aléatoire, propre au déploiement),
 * NODE_ENV=production.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrateDatabase } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./seed";

let ready: Promise<void> | null = null;

function init(): Promise<void> {
  ready ??= (async () => {
    const started = Date.now();
    await migrateDatabase(path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations"));
    await seedIfEmpty();
    logger.info({ ms: Date.now() - started }, "Instance prête (données de démonstration chargées)");
  })().catch((err) => {
    ready = null; // nouvelle tentative à la requête suivante
    throw err;
  });
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // La route Vercel transmet le chemin d'origine dans __path si l'URL est réécrite.
  const url = new URL(req.url ?? "/", "http://localhost");
  const original = url.searchParams.get("__path");
  if (original !== null) {
    url.searchParams.delete("__path");
    req.url = `/api/${original}${url.search}`;
  }

  try {
    await init();
  } catch (err) {
    logger.error({ err }, "Échec de l'initialisation de l'API");
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Service momentanément indisponible. Réessayez dans quelques secondes." }));
    return;
  }
  (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
