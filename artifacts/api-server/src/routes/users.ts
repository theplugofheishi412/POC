import { Router, type IRouter } from "express";
import { and, asc, db, eq, ne, usersTable } from "@workspace/db";
import { ROLE_LABELS, userCreateSchema, userUpdateSchema } from "@workspace/api-zod";
import { currentUser, hashPassword, requirePermission } from "../lib/auth";
import { audit } from "../lib/access";
import { badRequest, HttpError, idParam, notFound, parseBody } from "../lib/http";
import { toUserDTO } from "../lib/mappers";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
  const me = currentUser(req);
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.cabinetId, me.cabinetId))
    .orderBy(asc(usersTable.lastName));
  res.json(rows.map(toUserDTO));
});

async function assertEmailFree(email: string, exceptId?: number) {
  const [dup] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(exceptId ? and(eq(usersTable.email, email), ne(usersTable.id, exceptId)) : eq(usersTable.email, email))
    .limit(1);
  if (dup) throw new HttpError(409, "Cette adresse email est déjà utilisée.");
}

router.post("/users", requirePermission("users.manage"), async (req, res) => {
  const me = currentUser(req);
  const input = parseBody(userCreateSchema, req);
  await assertEmailFree(input.email);
  const [user] = await db
    .insert(usersTable)
    .values({
      cabinetId: me.cabinetId,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      title: input.title ?? ROLE_LABELS[input.role],
      phone: input.phone ?? null,
    })
    .returning();
  await audit(req, {
    action: "user.create",
    entityType: "user",
    entityId: user!.id,
    summary: `Création du compte ${user!.firstName} ${user!.lastName} (${ROLE_LABELS[input.role]})`,
  });
  res.status(201).json(toUserDTO(user!));
});

router.patch("/users/:id", requirePermission("users.manage"), async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req);
  const input = parseBody(userUpdateSchema, req);
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.cabinetId, me.cabinetId)));
  if (!existing) throw notFound("Utilisateur");
  if (id === me.id && (input.active === false || (input.role && input.role !== existing.role))) {
    throw badRequest("Vous ne pouvez pas désactiver votre propre compte ni modifier votre rôle.");
  }
  if (input.email) await assertEmailFree(input.email, id);
  const { password, ...rest } = input;
  const [user] = await db
    .update(usersTable)
    .set({ ...rest, ...(password ? { passwordHash: await hashPassword(password) } : {}) })
    .where(eq(usersTable.id, id))
    .returning();
  const changes = [
    input.role && input.role !== existing.role ? `rôle → ${ROLE_LABELS[input.role]}` : null,
    input.active === false ? "compte désactivé" : input.active === true && !existing.active ? "compte réactivé" : null,
    password ? "mot de passe réinitialisé" : null,
  ].filter(Boolean);
  await audit(req, {
    action: "user.update",
    entityType: "user",
    entityId: id,
    summary: `Modification du compte ${user!.firstName} ${user!.lastName}${changes.length ? ` (${changes.join(", ")})` : ""}`,
  });
  res.json(toUserDTO(user!));
});

export default router;
