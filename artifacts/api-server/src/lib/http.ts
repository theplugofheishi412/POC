import type { ErrorRequestHandler, Request } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { logger } from "./logger";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const forbidden = (message = "Vous n'avez pas les droits nécessaires pour cette action.") =>
  new HttpError(403, message);
export const notFound = (what = "Ressource") => new HttpError(404, `${what} introuvable.`);

/** Valide `req.body` avec un schéma Zod partagé et renvoie la valeur typée. */
export function parseBody<S extends ZodTypeAny>(schema: S, req: Request): z.infer<S> {
  return schema.parse(req.body ?? {});
}

export function idParam(req: Request, name = "id"): number {
  const value = Number(req.params[name]);
  if (!Number.isInteger(value) || value <= 0) throw badRequest("Identifiant invalide.");
  return value;
}

export function queryString(req: Request, name: string): string | undefined {
  const v = req.query[name];
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function queryInt(req: Request, name: string): number | undefined {
  const v = queryString(req, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
}

export function pagination(req: Request, defaultSize = 10) {
  const page = Math.max(1, queryInt(req, "page") ?? 1);
  const pageSize = Math.min(100, Math.max(1, queryInt(req, "pageSize") ?? defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Échappe les jokers d'un motif ILIKE saisi par l'utilisateur. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    res.status(400).json({ error: "Certains champs sont invalides.", fields });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Fichier trop volumineux (10 Mo maximum)." });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Corps de requête JSON invalide." });
    return;
  }
  req.log?.error({ err }, "Erreur non gérée");
  if (!req.log) logger.error({ err }, "Erreur non gérée");
  res.status(500).json({ error: "Une erreur interne est survenue. Veuillez réessayer." });
};

/** Date du jour au format AAAA-MM-JJ (fuseau du serveur). */
export function today(): string {
  return toIsoDay(new Date());
}

export function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
