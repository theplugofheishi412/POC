import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { loadSession } from "./lib/auth";
import { errorHandler } from "./lib/http";

const app: Express = express();

// Derrière le proxy Replit / un reverse proxy : req.secure et req.ip fiables.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Le frontend est servi sur la même origine (proxy Vite ou routeur Replit) :
// aucune origine tierce n'est autorisée par défaut.
const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : false, credentials: true }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", loadSession);

app.use("/api", router);

/**
 * En production locale (`pnpm start`), l'API sert aussi le frontend compilé
 * afin de n'avoir qu'un seul processus à lancer. Sur Replit, le frontend est
 * servi séparément (artifact statique) : ce bloc est alors inactif.
 */
const staticDir = path.resolve(
  process.env.STATIC_DIR ?? path.join(process.cwd(), "..", "cabinet-avocat-poc", "dist", "public"),
);
if (process.env.SERVE_STATIC !== "false" && fs.existsSync(path.join(staticDir, "index.html"))) {
  app.use(express.static(staticDir, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
  logger.info({ staticDir }, "Frontend compilé servi par l'API");
}

app.use(errorHandler);

export default app;
