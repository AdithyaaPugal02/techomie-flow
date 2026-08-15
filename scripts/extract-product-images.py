import io
import posixpath
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageChops
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
XLSX = Path(r"C:\Users\Admin\Downloads\Master Price List 2026 - 50% Discount.xlsx")
PDF = Path(r"D:\Techomie\Supplier\Phlipton\Phlipton B2B Bulk Oem Pricelist may26-1.pdf")
OUT = ROOT / "public" / "products"

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
DRAW_NS = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"


def save_webp(raw: bytes, destination: Path):
    image = Image.open(io.BytesIO(raw)).convert("RGBA")
    alpha_box = image.getchannel("A").getbbox()
    if alpha_box:
        image = image.crop(alpha_box)
    else:
        background = Image.new("RGBA", image.size, "white")
        box = ImageChops.difference(image, background).getbbox()
        if box:
            image = image.crop(box)
    image.thumbnail((900, 700), Image.Resampling.LANCZOS)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=88, method=6)


def relationships(archive, rel_path, base_path):
    root = ET.fromstring(archive.read(rel_path))
    return {
        node.attrib["Id"]: posixpath.normpath(posixpath.join(posixpath.dirname(base_path), node.attrib["Target"]))
        for node in root
    }


def extract_varni():
    wanted = {"WIFI-RE": "re", "WIFI-E": "edge", "WIFI-TP": "touch-panel", "WIFI-T+": "touch-plus"}
    with zipfile.ZipFile(XLSX) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        workbook_rels = relationships(archive, "xl/_rels/workbook.xml.rels", "xl/workbook.xml")
        sheet_paths = {}
        for sheet in workbook.find(f"{{{MAIN_NS}}}sheets"):
            name = sheet.attrib["name"]
            rid = sheet.attrib[f"{{{REL_NS}}}id"]
            target = workbook_rels[rid]
            if not target.startswith("xl/"):
                target = "xl/" + target
            sheet_paths[name] = target

        extracted = 0
        for sheet_name, slug in wanted.items():
            sheet_path = sheet_paths[sheet_name]
            sheet_root = ET.fromstring(archive.read(sheet_path))
            drawing = sheet_root.find(f"{{{MAIN_NS}}}drawing")
            sheet_rel_path = posixpath.join(posixpath.dirname(sheet_path), "_rels", posixpath.basename(sheet_path) + ".rels")
            sheet_rels = relationships(archive, sheet_rel_path, sheet_path)
            drawing_path = sheet_rels[drawing.attrib[f"{{{REL_NS}}}id"]]
            drawing_rel_path = posixpath.join(posixpath.dirname(drawing_path), "_rels", posixpath.basename(drawing_path) + ".rels")
            drawing_rels = relationships(archive, drawing_rel_path, drawing_path)
            drawing_root = ET.fromstring(archive.read(drawing_path))
            candidates = {}
            ns = {"x": DRAW_NS, "a": A_NS}
            for anchor in drawing_root:
                start = anchor.find("x:from", ns)
                blip = anchor.find(".//a:blip", ns)
                if start is None or blip is None:
                    continue
                row = int(start.find("x:row", ns).text) + 1
                col = int(start.find("x:col", ns).text) + 1
                media = drawing_rels.get(blip.attrib.get(f"{{{REL_NS}}}embed"))
                if col == 2 and 10 <= row <= 21 and media:
                    # Prefer the transparent PNG when a worksheet has duplicate photo anchors.
                    if row not in candidates or media.lower().endswith(".png"):
                        candidates[row] = media
            for row in range(10, 22):
                media = candidates.get(row)
                if media is None and candidates:
                    # Some Touch Plus photos span merged product rows; use the nearest
                    # embedded panel image for rows covered by that merged block.
                    media = candidates[min(candidates, key=lambda candidate: abs(candidate - row))]
                if media is None:
                    continue
                save_webp(archive.read(media), OUT / "varni" / f"{slug}-{row - 9}.webp")
                extracted += 1
        return extracted


def extract_phlipton():
    # PDF product artwork is stored in the same order as the numbered rows.
    selected = {
        "PN-TN-2M (6S)": (1, 2),
        "PN-TN-4M (4S+SK)": (1, 3),
        "PN-TN-4M (4S+4S)": (1, 6),
        "PN-LXR-2M (4+0+0+0U)": (3, 8),
        "PN-LXR-4M (8+0+0+0U)": (4, 3),
        "PN-LXR-6/8M (10+0+0+0)": (5, 6),
        "PN-RFT-4N": (8, 3),
        "PN-GAT-Pro": (8, 8),
        "PN-ZHPS-01": (9, 6),
        "PN-WDL-S2 Pro": (10, 4),
    }
    reader = PdfReader(PDF)
    for sku, (page_number, image_index) in selected.items():
        image = reader.pages[page_number - 1].images[image_index]
        slug = re.sub(r"[^a-z0-9]+", "-", sku.lower()).strip("-")
        save_webp(image.data, OUT / "phlipton" / f"{slug}.webp")
    return len(selected)


if __name__ == "__main__":
    varni = extract_varni()
    phlipton = extract_phlipton()
    print(f"Extracted {varni} Varni and {phlipton} Phlipton catalogue images")
