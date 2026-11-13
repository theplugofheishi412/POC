/**
 * Même convention de rédaction que le serveur (PDF / Word) :
 *   # Titre   ## Intertitre   > aligné à droite   ^ centré gras   - liste
 */
type Block = { kind: 'title' | 'heading' | 'right' | 'center' | 'bullet' | 'paragraph'; text: string };

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', text: para.join(' ') });
    para = [];
  };
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const map: [string, Block['kind']][] = [
      ['## ', 'heading'],
      ['# ', 'title'],
      ['> ', 'right'],
      ['^ ', 'center'],
      ['- ', 'bullet'],
    ];
    const hit = map.find(([p]) => line.startsWith(p));
    if (hit) {
      flush();
      blocks.push({ kind: hit[1], text: line.slice(hit[0].length) });
    } else para.push(line);
  }
  flush();
  return blocks;
}

/** Met en évidence les champs restant à compléter. */
function highlight(text: string) {
  const parts = text.split(/(\[à compléter[^\]]*\])/g);
  return parts.map((p, i) =>
    p.startsWith('[à compléter') ? (
      <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">
        {p}
      </mark>
    ) : (
      p
    ),
  );
}

export function RichTextPreview({ source }: { source: string }) {
  return (
    <div className="font-serif text-[13.5px] leading-relaxed text-[#1b1f29]">
      {parseRichText(source).map((b, i) => {
        switch (b.kind) {
          case 'title':
            return (
              <h1 key={i} className="my-4 text-center text-[17px] font-bold uppercase tracking-wide text-[#14213d]">
                {highlight(b.text)}
              </h1>
            );
          case 'heading':
            return (
              <h2 key={i} className="mb-1 mt-4 text-[14px] font-bold text-[#14213d]">
                {highlight(b.text)}
              </h2>
            );
          case 'right':
            return (
              <p key={i} className="mb-1 text-right">
                {highlight(b.text)}
              </p>
            );
          case 'center':
            return (
              <p key={i} className="my-2 text-center font-bold">
                {highlight(b.text)}
              </p>
            );
          case 'bullet':
            return (
              <p key={i} className="mb-1 pl-5 -indent-3 text-justify">
                •&nbsp;&nbsp;{highlight(b.text)}
              </p>
            );
          default:
            return (
              <p key={i} className="mb-2.5 text-justify">
                {highlight(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
