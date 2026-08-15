import io
import json
import posixpath
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

import pdfplumber
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "tmp" / "import" / "master-price-list.json"
XLSX = Path(r"C:\Users\Admin\Downloads\Master Price List 2026 - 50% Discount.xlsx")
PDF = Path(r"D:\Techomie\Supplier\Phlipton\Phlipton B2B Bulk Oem Pricelist may26-1.pdf")
AUTOZON_PDFS = [
    (Path(r"C:\Users\Admin\Downloads\5.AUTOZON_SWING_WINDOW_OPERATOR_LIST_PRICE_MARCH_2025_Rev_005.pdf"), "Window automation", "WIN"),
    (Path(r"C:\Users\Admin\Downloads\1.AUTOZON_SLIDING_GATE_OPERATOR_LIST_PRICE_MAY_2025_Rev_007.pdf"), "Gate automation", "SLG"),
    (Path(r"C:\Users\Admin\Downloads\6.AUTOZON_CURTAIN_OPERATOR_LIST_PRICE_JAN_2025-Rev_002.pdf"), "Curtains", "CUR"),
    (Path(r"C:\Users\Admin\Downloads\4.SWING_DOOR_OPERATOR_LIST_PRICE_MARCH_2025.pdf"), "Door automation", "SWD"),
    (Path(r"C:\Users\Admin\Downloads\3.AUTOZON_SLIDING_GLASS_DOOR_OPERATOR_LIST_PRICE_MARCH_2025 Rev_002.pdf"), "Door automation", "SLD"),
    (Path(r"C:\Users\Admin\Downloads\8.AUTOZON_BOOM_BARRIER_LIST_PRICE_PRICE_MARCH_2025_Rev_008.pdf"), "Boom barriers", "BB"),
    (Path(r"C:\Users\Admin\Downloads\SWING -GATE-OPERATOR (4).pdf"), "Gate automation", "SWG"),
]
OUT = ROOT / "public" / "products"
CATALOG_JSON = ROOT / "tmp" / "import" / "full-catalog.json"

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
DRAW_NS = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"

SERIES = {
    "RE": ("Royal Edge Color", "re"), "REDC": ("Royal Edge", "royal-edge"),
    "CE": ("Edge Color", "edge-color"), "E": ("Edge", "edge"),
    "CTP": ("Color Touch Panel", "color-touch"), "TP": ("Touch Panel", "touch-panel"),
    "T+": ("Touch Plus", "touch-plus"),
}
REPRESENTATIVE = {
    "re": "WIFI-RE", "royal-edge": "WIFI-REDC", "edge-color": "WIFI-CE",
    "edge": "WIFI-E", "color-touch": "WIFI-CTP", "touch-panel": "WIFI-TP",
    "touch-plus": "WIFI-T+", "dnd": "DND",
}


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def number(value):
    try:
        match = re.search(r"\d[\d,]*(?:\.\d+)?", str(value or ""))
        return float(match.group(0).replace(",", "")) if match else None
    except (TypeError, ValueError):
        return None


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-")


def noviq_title(value):
    title = clean(value)
    title = re.sub(r"\(?www\.varnidigital\.(?:shop|com|in)\)?", "", title, flags=re.I)
    title = re.sub(r"varni\s+digital", "Noviq", title, flags=re.I)
    title = clean(title).strip(" .-")
    return title if title.upper().startswith("Noviq ") else "Noviq " + title


def category(name):
    value = name.lower()
    if "lock" in value: return "Door locks"
    if "gateway" in value or "repeater" in value: return "Gateways"
    if any(word in value for word in ("sensor", "security", "siren", "smoke", "gas detector")): return "Security"
    if any(word in value for word in ("retrofit", "relay", "module")): return "Retrofit modules"
    if any(word in value for word in ("curtain motor", "curtain track", "curtain remote")): return "Curtains"
    if any(word in value for word in ("light", "lamp", "driver", "cob", "led", "spot", "strip")): return "Lighting"
    if any(word in value for word in ("vdp", "video door", "doorbell")): return "Video door phones"
    return "Smart switches"


def webp_bytes(raw, max_size=(600, 480)):
    image = Image.open(io.BytesIO(raw)).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox: image = image.crop(bbox)
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    output = io.BytesIO()
    image.save(output, "WEBP", quality=84, method=4)
    return output.getvalue()


def rels(archive, rel_path, base_path):
    root = ET.fromstring(archive.read(rel_path))
    return {node.attrib["Id"]: posixpath.normpath(posixpath.join(posixpath.dirname(base_path), node.attrib["Target"])) for node in root}


def workbook_sheet_paths(archive):
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    workbook_rels = rels(archive, "xl/_rels/workbook.xml.rels", "xl/workbook.xml")
    result = {}
    for sheet in workbook.find(f"{{{MAIN_NS}}}sheets"):
        path = workbook_rels[sheet.attrib[f"{{{REL_NS}}}id"]]
        result[sheet.attrib["name"]] = path if path.startswith("xl/") else "xl/" + path
    return result


def drawing_images(archive, sheet_path):
    root = ET.fromstring(archive.read(sheet_path))
    drawing = root.find(f"{{{MAIN_NS}}}drawing")
    if drawing is None: return []
    sheet_rel = posixpath.join(posixpath.dirname(sheet_path), "_rels", posixpath.basename(sheet_path) + ".rels")
    drawing_path = rels(archive, sheet_rel, sheet_path)[drawing.attrib[f"{{{REL_NS}}}id"]]
    drawing_rel = posixpath.join(posixpath.dirname(drawing_path), "_rels", posixpath.basename(drawing_path) + ".rels")
    media = rels(archive, drawing_rel, drawing_path)
    drawing_root = ET.fromstring(archive.read(drawing_path))
    ns = {"x": DRAW_NS, "a": A_NS}
    result = []
    for anchor in drawing_root:
        start, blip = anchor.find("x:from", ns), anchor.find(".//a:blip", ns)
        if start is None or blip is None: continue
        row, col = int(start.find("x:row", ns).text) + 1, int(start.find("x:col", ns).text) + 1
        path = media.get(blip.attrib.get(f"{{{REL_NS}}}embed"))
        if col == 2 and path and path.lower().endswith((".png", ".jpg", ".jpeg")):
            result.append((row, path))
    return result


def import_varni(raw):
    records, product_rows = [], {}
    for sheet, rows in raw.items():
        if sheet == "DND":
            technology, series_name, series_slug = "Wired", "Hotel DND", "dnd"
        elif "-" in sheet and sheet.split("-", 1)[0] in ("WIFI", "ZIGBEE", "REMOTE"):
            technology_key, code = sheet.split("-", 1)
            if code not in SERIES: continue
            technology = {"WIFI": "Wi-Fi", "ZIGBEE": "ZigBee", "REMOTE": "Remote"}[technology_key]
            series_name, series_slug = SERIES[code]
        else: continue
        product_rows.setdefault(series_slug, {})
        for row_index, row in enumerate(rows, start=1):
            if len(row) < 7 or not isinstance(row[0], (int, float)) or not clean(row[2]): continue
            serial = clean(row[0]).removesuffix(".0")
            pairs = [("Acrylic", 4, 6), ("Glass", 7, 9)]
            made = False
            for finish, list_col, cost_col in pairs:
                selling = number(row[list_col]) if len(row) > list_col else None
                cost = number(row[cost_col]) if len(row) > cost_col else None
                if selling is None: continue
                cost = cost if cost is not None else selling * 0.5
                title = clean(row[2])
                records.append({
                    "id": f"VN-{sheet}-{serial}-{finish[0]}", "sku": f"NQ-{series_slug.upper()}-{slug(row[3]).upper() or 'STD'}-{int(float(row[0])):03d}-{technology[:2].upper()}-{finish[:3].upper()}", "supplierSku": "",
                    "name": noviq_title(title),
                    "series": series_name, "category": category(title), "module": clean(row[3]) or "Standard",
                    "technology": technology, "finish": finish, "sellingPrice": selling,
                    "purchaseCost": cost, "warranty": "6 years", "source": "Noviq Master Price List 2026",
                    "image": f"/products/noviq/{series_slug}-{serial}.webp", "description": noviq_title(title), "hsn": "", "gst": 18,
                })
                made = True
            if made: product_rows[series_slug][serial] = row_index

    cache = {}
    with zipfile.ZipFile(XLSX) as archive:
        paths = workbook_sheet_paths(archive)
        for series_slug, sheet in REPRESENTATIVE.items():
            rows = product_rows.get(series_slug, {})
            candidates = drawing_images(archive, paths[sheet])
            if not candidates: continue
            first_row, last_row = min(rows.values()), max(rows.values())
            candidates = [(row, path) for row, path in candidates if first_row - 2 <= row <= last_row + 2]
            for serial, row in rows.items():
                exact = [path for anchor_row, path in candidates if anchor_row == row]
                path = exact[-1] if exact else min(candidates, key=lambda item: abs(item[0] - row))[1]
                if path not in cache: cache[path] = webp_bytes(archive.read(path))
                destination = OUT / "noviq" / f"{series_slug}-{serial}.webp"
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(cache[path])
    return records


def import_phlipton():
    records = []
    with pdfplumber.open(PDF) as document:
        for page_number, page in enumerate(document.pages, start=1):
            rendered = page.to_image(resolution=130).original.convert("RGB")
            scale_x, scale_y = rendered.width / page.width, rendered.height / page.height
            for table in page.find_tables():
                extracted = table.extract()
                for row_index, values in enumerate(extracted):
                    if not values or not clean(values[0]).isdigit() or len(values) < 6: continue
                    serial = clean(values[0])
                    title = clean(values[2]) or f"Product {serial}"
                    model = clean(values[3])
                    sku_value = model if model and model != "-" else f"PN-{serial}"
                    switch_family = "Titan" if sku_value.upper().startswith("PN-TN") else "Luxeray" if sku_value.upper().startswith("PN-LXR") else ""
                    module_match = re.search(r"-(\d+(?:/\d+)?M)(?:\b|\()", sku_value, re.I)
                    module_size = module_match.group(1).upper() if module_match else "Standard"
                    product_name = noviq_title(title)
                    if switch_family:
                        product_name = re.sub(r"^Noviq\s+", f"Noviq {switch_family} ", product_name, flags=re.I)
                    selling, cost = number(values[4]), number(values[5])
                    if selling is None:
                        available = [number(value) for value in values[4:] if number(value) is not None]
                        selling = available[0] if available else 0
                    cost = cost if cost is not None else selling
                    selling = round(selling * 2.5, 2)
                    image_slug = f"{int(serial):03d}-{slug(sku_value)[:70]}"
                    cells = table.rows[row_index].cells
                    cell = cells[1] if len(cells) > 1 else None
                    if cell:
                        x0, top, x1, bottom = cell
                        crop = rendered.crop((max(0, int(x0 * scale_x)), max(0, int(top * scale_y)), min(rendered.width, int(x1 * scale_x)), min(rendered.height, int(bottom * scale_y))))
                        # Trim only empty white margin while keeping the complete product.
                        diff = ImageChops.difference(crop, Image.new("RGB", crop.size, "white"))
                        bbox = diff.getbbox()
                        if bbox: crop = crop.crop(bbox)
                        crop.thumbnail((600, 480), Image.Resampling.LANCZOS)
                        destination = OUT / "phlipton" / f"{image_slug}.webp"
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        crop.save(destination, "WEBP", quality=84, method=4)
                    records.append({
                        "id": f"PH-{serial}", "sku": f"NQ-PH-{int(serial):03d}-{slug(sku_value).upper()}", "supplierSku": sku_value, "name": product_name,
                        "series": f"Noviq {switch_family}" if switch_family else "Noviq", "category": "Smart switches" if switch_family else category(title), "module": module_size,
                        "technology": "ZigBee" if "zigbee" in (title + model).lower() else "Smart",
                        "finish": "Multiple finishes", "sellingPrice": selling, "purchaseCost": cost,
                        "warranty": "Manufacturer warranty", "source": "Supplier catalogue May 2026",
                        "image": f"/products/phlipton/{image_slug}.webp", "description": title, "hsn": "", "gst": 18,
                    })
    # Some lighting rows share one merged image cell. Use the nearest numbered
    # product artwork for those rows so every imported record remains visual.
    existing = []
    for record in records:
        path = ROOT / "public" / record["image"].lstrip("/")
        if path.exists(): existing.append((int(record["id"].split("-")[1]), path))
    for record in records:
        path = ROOT / "public" / record["image"].lstrip("/")
        if not path.exists() and existing:
            serial = int(record["id"].split("-")[1])
            source = min(existing, key=lambda item: abs(item[0] - serial))[1]
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(source.read_bytes())
    return records


def import_autozon():
    records = []
    for source_path, product_category, family in AUTOZON_PDFS:
        source_slug = slug(source_path.stem)[:42]
        source_records = []
        with pdfplumber.open(source_path) as document:
            for page_number, page in enumerate(document.pages, start=1):
                rendered = page.to_image(resolution=130).original.convert("RGB")
                scale_x, scale_y = rendered.width / page.width, rendered.height / page.height
                for table in page.find_tables():
                    extracted = table.extract()
                    for row_index, values in enumerate(extracted):
                        if not values or not clean(values[0]).isdigit() or len(values) < 6: continue
                        serial, code = clean(values[0]), clean(values[1])
                        if not code: code = f"AUTOZON-{source_slug}-{serial}"
                        title, description = clean(values[2]) or code, clean(values[4])
                        selling = number(values[5])
                        if selling is None: selling = 0
                        image_slug = f"{source_slug}-{int(serial):03d}-{slug(code)[:48]}"
                        cells = table.rows[row_index].cells
                        cell = cells[3] if len(cells) > 3 else None
                        if cell:
                            x0, top, x1, bottom = cell
                            crop = rendered.crop((max(0, int(x0 * scale_x)), max(0, int(top * scale_y)), min(rendered.width, int(x1 * scale_x)), min(rendered.height, int(bottom * scale_y))))
                            diff = ImageChops.difference(crop, Image.new("RGB", crop.size, "white"))
                            bbox = diff.getbbox()
                            if bbox: crop = crop.crop(bbox)
                            crop.thumbnail((600, 480), Image.Resampling.LANCZOS)
                            destination = OUT / "autozon" / f"{image_slug}.webp"
                            destination.parent.mkdir(parents=True, exist_ok=True)
                            crop.save(destination, "WEBP", quality=84, method=4)
                        record = {
                            "id": f"AZ-{source_slug}-{slug(code)}", "sku": f"NQ-AZ-{family}-{slug(code).upper()}", "supplierSku": code, "name": noviq_title(f"AUTOZON {title}"),
                            "series": "Autozon", "category": product_category, "module": "Fixed configuration",
                            "technology": "Automatic", "finish": "Standard", "sellingPrice": selling,
                            "purchaseCost": 0, "warranty": "Manufacturer warranty", "source": "Autozon Price List 2025",
                            "image": f"/products/autozon/{image_slug}.webp", "description": description or title, "hsn": "", "gst": 18,
                        }
                        source_records.append(record)
        existing = []
        for index, record in enumerate(source_records):
            path = ROOT / "public" / record["image"].lstrip("/")
            if path.exists(): existing.append((index, path))
        for index, record in enumerate(source_records):
            path = ROOT / "public" / record["image"].lstrip("/")
            if not path.exists() and existing:
                source = min(existing, key=lambda item: abs(item[0] - index))[1]
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(source.read_bytes())
        records.extend(source_records)
    return records


if __name__ == "__main__":
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    varni = import_varni(raw)
    phlipton = import_phlipton()
    autozon = import_autozon()
    records = varni + phlipton + autozon
    CATALOG_JSON.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"noviq": len(varni), "phlipton": len(phlipton), "autozon": len(autozon), "total": len(records)}, indent=2))
