/**
 * Format de rédaction des requêtes : texte brut avec quelques conventions
 * légères, lisibles même sans mise en forme.
 *
 *   # Titre centré          ## Intertitre
 *   > Ligne alignée à droite (lieu, date, destinataire)
 *   ^ Ligne centrée en gras (ex. « PAR CES MOTIFS »)
 *   - Élément de liste
 *   Paragraphes séparés par une ligne vide.
 */
export type RichBlock =
  | { kind: "title" | "heading" | "right" | "center" | "bullet" | "paragraph"; text: string };

export function parseRichText(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const prefix = (p: string) => line.startsWith(p);
    if (prefix("## ")) {
      flush();
      blocks.push({ kind: "heading", text: line.slice(3) });
    } else if (prefix("# ")) {
      flush();
      blocks.push({ kind: "title", text: line.slice(2) });
    } else if (prefix("> ")) {
      flush();
      blocks.push({ kind: "right", text: line.slice(2) });
    } else if (prefix("^ ")) {
      flush();
      blocks.push({ kind: "center", text: line.slice(2) });
    } else if (prefix("- ")) {
      flush();
      blocks.push({ kind: "bullet", text: line.slice(2) });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Rendu HTML (export Word). */
export function richTextToHtml(source: string): string {
  return parseRichText(source)
    .map((b) => {
      const t = escapeHtml(b.text);
      switch (b.kind) {
        case "title":
          return `<h1>${t.toUpperCase()}</h1>`;
        case "heading":
          return `<h2>${t}</h2>`;
        case "right":
          return `<p class="right">${t}</p>`;
        case "center":
          return `<p class="center"><b>${t}</b></p>`;
        case "bullet":
          return `<p class="bullet">&bull;&nbsp;&nbsp;${t}</p>`;
        default:
          return `<p>${t}</p>`;
      }
    })
    .join("\n");
}

/** Document Word (HTML compatible Microsoft Word, ouvert nativement en .doc). */
export function wordDocument(opts: { title: string; cabinetName: string; body: string; notice: string }): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(opts.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page { size: 21cm 29.7cm; margin: 2.2cm 2cm 2.2cm 2cm; }
body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.4; }
.head { font-family: "Times New Roman", serif; font-size: 16pt; font-weight: bold; color: #14213d; }
.sub { font-family: Arial, sans-serif; font-size: 8pt; letter-spacing: 1.5pt; color: #5b6472; border-bottom: 1.5pt solid #b08d3c; padding-bottom: 6pt; margin-bottom: 18pt; }
h1 { text-align: center; font-size: 15pt; color: #14213d; margin: 12pt 0; }
h2 { font-size: 12pt; color: #14213d; margin: 12pt 0 4pt; }
p { text-align: justify; margin: 0 0 8pt; }
p.right { text-align: right; }
p.center { text-align: center; }
p.bullet { margin-left: 14pt; }
.notice { font-family: Arial, sans-serif; font-size: 8pt; color: #8a6d2b; border-top: 0.5pt solid #d5d9e0; padding-top: 6pt; margin-top: 24pt; text-align: center; }
</style></head>
<body>
<div class="head">${escapeHtml(opts.cabinetName)}</div>
<div class="sub">AVOCATS À LA COUR</div>
${opts.body}
<p class="notice">${escapeHtml(opts.notice)}</p>
</body></html>`;
}
