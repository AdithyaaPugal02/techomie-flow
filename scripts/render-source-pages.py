from pathlib import Path
import fitz
jobs=[
 (r"D:\Techomie\Supplier\Phlipton\Phlipton B2B Bulk Oem Pricelist may26-1.pdf",[0,2,7,9]),
 (r"C:\Users\Admin\Downloads\ORIGINAL Noviq Brochure Print (1).pdf",[12,14,15,17]),
]
out=Path("tmp/pdfs/rendered"); out.mkdir(parents=True,exist_ok=True)
for path,pages in jobs:
 doc=fitz.open(path)
 stem=Path(path).stem[:18].replace(" ","-")
 for p in pages:
  pix=doc[p].get_pixmap(matrix=fitz.Matrix(1.2,1.2),alpha=False)
  pix.save(out/f"{stem}-p{p+1}.png")
