import crypto from "node:crypto";
import { promisify } from "node:util";
import type { CookieOptions, NextFunction, Request, Response } from "express";
import { and, db, eq, gte, lt, sessionsTable, usersTable, type User } from "@workspace/db";
import { hasPermission, type Permission, type Role } from "@workspace/api-zod";
import { forbidden, HttpError } from "./http";

const scrypt = promisify(crypto.scrypt) as (pwd: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "cabinet_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // une journée de travail

export interface AuthUser {
  id: number;
  cabinetId: number;
  role: Role;
  firstName: string;
  lastName: string;
  fullName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Mots de passe (scrypt, sel aléatoire, comparaison à temps constant) */
/* ------------------------------------------------------------------ */

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

/* ------------------------------------------------------------------ */
/* Sessions : jeton aléatoire en cookie httpOnly, empreinte en base    */
/* ------------------------------------------------------------------ */

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

function cookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

export async function openSession(req: Request, res: Response, userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(sessionsTable).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, userId));
  // Purge opportuniste des sessions expirées.
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
  res.cookie(SESSION_COOKIE, token, cookieOptions(req));
}

export async function closeSession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string") {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
  }
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(req), maxAge: undefined });
}

export function toAuthUser(u: User): AuthUser {
  return {
    id: u.id,
    cabinetId: u.cabinetId,
    role: u.role as Role,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`,
  };
}

/** Charge l'utilisateur de la session (si présente et valide). */
export async function loadSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string" && token.length > 20) {
    const [row] = await db
      .select({ user: usersTable })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
      .where(and(eq(sessionsTable.tokenHash, hashToken(token)), gte(sessionsTable.expiresAt, new Date())))
      .limit(1);
    if (row && row.user.active) req.user = toAuthUser(row.user);
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new HttpError(401, "Session expirée ou absente. Veuillez vous reconnecter.");
  next();
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, "Authentification requise.");
  return req.user;
}

export function can(user: AuthUser, permission: Permission): boolean {
  return hasPermission(user.role, permission);
}

export function assertCan(user: AuthUser, permission: Permission, message?: string): void {
  if (!can(user, permission)) throw forbidden(message);
}

/** Middleware Express : exige une permission. */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    assertCan(currentUser(req), permission);
    next();
  };
}

/* ------------------------------------------------------------------ */
/* Limitation simple des tentatives de connexion (mémoire)             */
/* ------------------------------------------------------------------ */

const attempts = new Map<string, { count: number; until: number }>();

export function checkLoginRate(key: string): void {
  const entry = attempts.get(key);
  if (entry && entry.until > Date.now() && entry.count >= 8) {
    throw new HttpError(429, "Trop de tentatives. Réessayez dans quelques minutes.");
  }
}

export function recordLoginFailure(key: string): void {
  const entry = attempts.get(key);
  const now = Date.now();
  if (!entry || entry.until < now) attempts.set(key, { count: 1, until: now + 10 * 60 * 1000 });
  else entry.count += 1;
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
