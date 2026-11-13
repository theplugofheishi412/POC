const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « 12 novembre 2026 » à partir de AAAA-MM-JJ ou d'une Date. */
export function longDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(`${value.slice(0, 10)}T12:00:00`) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** « 12/11/2026 ». */
export function shortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(`${value.slice(0, 10)}T12:00:00`) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** « 1 250 000 FCFA » — espaces simples (compatibles avec les polices PDF standard). */
export function fcfa(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const digits = Math.abs(Math.round(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${digits} FCFA`;
}

/** Convertit un entier en lettres (français), pour les factures. */
export function amountInWords(n: number): string {
  const units = [
    "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
  ];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

  const below100 = (x: number): string => {
    if (x < 20) return units[x]!;
    const t = Math.floor(x / 10);
    let u = x % 10;
    if (t === 7 || t === 9) u += 10;
    let word = tens[t]!;
    if (u === 0) return t === 8 ? "quatre-vingts" : word;
    if ((u === 1 || u === 11) && t !== 8 && t !== 9) word += " et";
    return `${word}${word.endsWith(" et") ? " " : "-"}${units[u]}`;
  };
  const below1000 = (x: number): string => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    let s = "";
    if (h > 0) s = h === 1 ? "cent" : `${units[h]} cent${r === 0 ? "s" : ""}`;
    if (r > 0) s += `${s ? " " : ""}${below100(r)}`;
    return s;
  };

  if (n === 0) return "zéro";
  const parts: string[] = [];
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const thousands = Math.floor((n % 1e6) / 1e3);
  const rest = n % 1e3;
  if (billions) parts.push(`${below1000(billions)} milliard${billions > 1 ? "s" : ""}`);
  if (millions) parts.push(`${below1000(millions)} million${millions > 1 ? "s" : ""}`);
  if (thousands) parts.push(thousands === 1 ? "mille" : `${below1000(thousands).replace(/cents$/, "cent")} mille`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

/** Remplace les caractères absents de l'encodage WinAnsi des polices PDF standard. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[   ]/g, " ")
    .replace(/[‐‑]/g, "-")
    .replace(/…/g, "...");
}
