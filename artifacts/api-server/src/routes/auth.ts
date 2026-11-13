import { Router, type IRouter, type Request } from "express";
import { asc, cabinetsTable, db, eq, usersTable } from "@workspace/db";
import {
  demoLoginSchema,
  loginSchema,
  ROLES,
  ROLE_PERMISSIONS,
  type DemoAccountDTO,
  type Role,
  type SessionDTO,
} from "@workspace/api-zod";
import {
  checkLoginRate,
  clearLoginFailures,
  closeSession,
  currentUser,
  openSession,
  recordLoginFailure,
  requireAuth,
  toAuthUser,
  verifyPassword,
} from "../lib/auth";
import { audit } from "../lib/access";
import { HttpError, notFound, parseBody } from "../lib/http";
import { toUserDTO } from "../lib/mappers";

/** Mode démonstration : connexion en un clic avec les comptes fictifs. */
export const DEMO_MODE = process.env.DEMO_MODE !== "false";

const router: IRouter = Router();

async function sessionPayload(userId: number): Promise<SessionDTO> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) throw notFound("Utilisateur");
  const [cabinet] = await db.select().from(cabinetsTable).where(eq(cabinetsTable.id, user.cabinetId));
  return {
    user: toUserDTO(user),
    permissions: ROLE_PERMISSIONS[user.role as Role],
    cabinet: { id: cabinet!.id, name: cabinet!.name, city: cabinet!.city },
  };
}

async function afterLogin(req: Request, userId: number, mode: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  req.user = toAuthUser(user!);
  await audit(req, {
    action: "auth.login",
    entityType: "user",
    entityId: userId,
    summary: `Connexion de ${req.user.fullName} (${mode})`,
  });
}

router.post("/auth/login", async (req, res) => {
  const { email, password } = parseBody(loginSchema, req);
  const key = `${req.ip}:${email}`;
  checkLoginRate(key);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const ok = user && user.active && (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    recordLoginFailure(key);
    req.log.warn({ email }, "Échec de connexion");
    throw new HttpError(401, "Email ou mot de passe incorrect.");
  }
  clearLoginFailures(key);
  await openSession(req, res, user.id);
  await afterLogin(req, user.id, "mot de passe");
  res.json(await sessionPayload(user.id));
});

router.get("/auth/demo-accounts", async (_req, res) => {
  if (!DEMO_MODE) {
    res.json([]);
    return;
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.active, true)).orderBy(asc(usersTable.id));
  const accounts: DemoAccountDTO[] = users
    .map((u) => ({ id: u.id, fullName: `${u.firstName} ${u.lastName}`, role: u.role as Role, title: u.title, email: u.email }))
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
  res.json(accounts);
});

router.post("/auth/demo-login", async (req, res) => {
  if (!DEMO_MODE) throw new HttpError(404, "Mode démonstration désactivé.");
  const { userId } = parseBody(demoLoginSchema, req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || !user.active) throw notFound("Compte de démonstration");
  await openSession(req, res, user.id);
  await afterLogin(req, user.id, "compte de démonstration");
  res.json(await sessionPayload(user.id));
});

router.post("/auth/logout", async (req, res) => {
  if (req.user) {
    await audit(req, { action: "auth.logout", entityType: "user", entityId: req.user.id, summary: `Déconnexion de ${req.user.fullName}` });
  }
  await closeSession(req, res);
  res.status(204).end();
});

router.get("/auth/me", requireAuth, async (req, res) => {
  res.json(await sessionPayload(currentUser(req).id));
});

export default router;
