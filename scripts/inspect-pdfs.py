from pathlib import Path
import json, re
from pypdf import PdfReader

paths = [
 r"D:\Techomie\Supplier\Phlipton\Phlipton B2B Bulk Oem Pricelist may26-1.pdf",
 r"D:\Techomie\Marketing\Prints\Catelogue\Noviq\Noviq Catalogue Aug 2025 Compressed.pdf",
 r"C:\Users\Admin\Downloads\ORIGINAL Noviq Brochure Print (1).pdf",
]
out=[]
for p in paths:
    reader=PdfReader(p)
    samples=[]
    for i in range(min(len(reader.pages), 18)):
        text=(reader.pages[i].extract_text() or "").strip()
        samples.append({"page":i+1,"text":re.sub(r"\s+"," ",text)[:1800]})
    out.append({"path":p,"pages":len(reader.pages),"samples":samples})
Path("tmp/pdfs").mkdir(parents=True,exist_ok=True)
Path("tmp/pdfs/source-summary.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps([{"path":x["path"],"pages":x["pages"]} for x in out],indent=2))
