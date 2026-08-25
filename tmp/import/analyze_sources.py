import json
from pathlib import Path

import pdfplumber
from PIL import Image, ImageDraw

PDF = Path(r"D:\Techomie\Supplier\Phlipton\Phlipton B2B Bulk Oem Pricelist may26-1.pdf")
OUT = Path(r"D:\Techomie-Flow\tmp\pdfs\phlipton")
OUT.mkdir(parents=True, exist_ok=True)

pages = []
thumbs = []
with pdfplumber.open(PDF) as document:
    for page_number, page in enumerate(document.pages, start=1):
        tables = [table.extract() for table in page.find_tables()]
        pages.append({"page": page_number, "text": page.extract_text() or "", "tables": tables})
        image = page.to_image(resolution=95).original.convert("RGB")
        image.thumbnail((420, 560), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (440, 590), "white")
        canvas.paste(image, ((440 - image.width) // 2, 22))
        ImageDraw.Draw(canvas).text((10, 5), f"Page {page_number}", fill="black")
        canvas.save(OUT / f"page-{page_number:02d}.jpg", quality=88)
        thumbs.append(canvas)

contact = Image.new("RGB", (440 * 4, 590 * 5), "#d9dde3")
for index, image in enumerate(thumbs):
    contact.paste(image, ((index % 4) * 440, (index // 4) * 590))
contact.save(OUT / "contact-sheet.jpg", quality=90)
(OUT / "extracted.json").write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"pages": len(pages), "tables": sum(len(p["tables"]) for p in pages)}, indent=2))
