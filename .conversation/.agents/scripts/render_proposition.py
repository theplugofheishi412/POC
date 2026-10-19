import fitz
from pathlib import Path
source = Path('attached_assets/PROPOSITION_DE_PROJET_1792376386507.pdf')
output = Path('.agents/outputs/proposition')
doc = fitz.open(source)
print(f'pages={doc.page_count}')
for i in range(min(3, doc.page_count)):
    page = doc[i]
    pix = page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False)
    pix.save(output / f'page-{i+1}.png')
print(f'rendered={min(3, doc.page_count)} pages')
