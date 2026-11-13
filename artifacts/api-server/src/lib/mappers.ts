import type { Client, User } from "@workspace/db";
import type { ClientDTO, Role, UserDTO } from "@workspace/api-zod";

export function clientDisplayName(c: Pick<Client, "type" | "firstName" | "lastName" | "companyName">): string {
  if (c.type === "morale") return c.companyName ?? "Société sans nom";
  return [c.firstName, c.lastName?.toUpperCase()].filter(Boolean).join(" ");
}

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    fullName: `${u.firstName} ${u.lastName}`,
    role: u.role as Role,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    title: u.title,
    phone: u.phone,
    active: u.active,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toClientDTO(c: Client, counts?: { total: number; active: number }): ClientDTO {
  return {
    id: c.id,
    type: c.type as ClientDTO["type"],
    displayName: clientDisplayName(c),
    firstName: c.firstName,
    lastName: c.lastName,
    companyName: c.companyName,
    legalForm: c.legalForm,
    registrationNumber: c.registrationNumber,
    representativeName: c.representativeName,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    idNumber: c.idNumber,
    notes: c.notes,
    status: c.status as ClientDTO["status"],
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    dossierCount: counts?.total ?? 0,
    activeDossierCount: counts?.active ?? 0,
  };
}
