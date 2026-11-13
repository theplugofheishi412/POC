import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { badRequest } from "./http";

/**
 * Stockage des fichiers téléversés sur disque, hors de toute arborescence
 * servie publiquement. Les fichiers ne sont accessibles qu'au travers de
 * l'API, après contrôle des droits sur le dossier.
 */
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/webp",
    ext: "webp",
    test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  },
];

export const ACCEPTED_MIME_TYPES = SIGNATURES.map((s) => s.mime);

/**
 * Vérifie le contenu réel du fichier (signature binaire) : on ne se fie ni
 * à l'extension ni au type MIME annoncé par le navigateur.
 */
export function detectFileType(buffer: Buffer): { mime: string; ext: string } {
  if (buffer.length === 0) throw badRequest("Le fichier est vide.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw badRequest("Fichier trop volumineux (10 Mo maximum).");
  const match = SIGNATURES.find((s) => s.test(buffer));
  if (!match) throw badRequest("Format non accepté. Formats autorisés : PDF, PNG, JPEG, WEBP.");
  return match;
}

/** Nettoie un nom de fichier fourni par le client (affichage uniquement). */
export function sanitizeFileName(name: string | undefined, fallbackExt: string): string {
  const base = (name ?? "")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  if (!base) return `document.${fallbackExt}`;
  return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.${fallbackExt}`;
}

export function saveFile(buffer: Buffer, ext: string): { storageKey: string; sha256: string } {
  const storageKey = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, storageKey), buffer, { flag: "wx" });
  return { storageKey, sha256: crypto.createHash("sha256").update(buffer).digest("hex") };
}

export function filePath(storageKey: string): string {
  // La clé est générée par le serveur ; on refuse tout de même toute traversée.
  if (!/^[0-9a-f-]{36}\.[a-z]{3,4}$/.test(storageKey)) throw badRequest("Clé de stockage invalide.");
  return path.join(UPLOAD_DIR, storageKey);
}

export function deleteFile(storageKey: string): void {
  try {
    fs.unlinkSync(filePath(storageKey));
  } catch {
    // fichier déjà absent : rien à faire
  }
}

/** En-tête Content-Disposition compatible avec les noms accentués. */
export function contentDisposition(kind: "inline" | "attachment", fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
