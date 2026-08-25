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


def switch_subcategory(name):
    value = clean(name).lower()
    if "dnd" in value or "hotel" in value: return "Hotel room controls"
    if "door bell" in value or "doorbell" in value: return "Doorbell panels"
    if "curtain" in value: return "Curtain control panels"
    if "fan" in value or "regulator" in value or "knob" in value: return "Fan control panels"
    if "socket" in value: return "Switch and socket panels"
    if "scene" in value: return "Scene control panels"
    return "Switch panels"


def phlipton_classification(serial, title):
    value = clean(title).lower()
    if serial <= 72: return "Smart switches", switch_subcategory(title)
    if serial <= 79: return "Retrofit modules", "Relays" if "relay" in value else "In-wall modules"
    if serial <= 84: return "Gateways", "Signal repeaters" if "repeater" in value else "Smart home gateways"
    if serial <= 88: return "Control panels", "Wall touch panels"
    if serial <= 98:
        if "sensor" in value or "presence" in value: return "Sensors and controls", "Occupancy sensors"
        if "remote" in value: return "Sensors and controls", "IR remotes"
        if "gateway" in value: return "Sensors and controls", "HVAC gateways"
        if "knob" in value: return "Sensors and controls", "Wireless knobs"
        return "Sensors and controls", "Wireless scene switches"
    if serial <= 119: return "Door locks", "Cabinet locks" if "cabinet" in value else "Smart door locks"
    if serial == 120: return "Doorbells", "Video doorbells"
    if serial in (121, 122, 124): return "Video door phones", "Multi-apartment systems" if serial == 124 else "VDP kits"
    if serial == 123: return "Door locks", "Hotel door locks"
    if serial <= 131:
        if "track" in value: return "Curtains", "Curtain tracks"
        if "remote" in value: return "Curtains", "Curtain remotes"
        return "Curtains", "Curtain motors"
    if serial <= 146:
        if "power supply" in value: return "Lighting controls", "Power supplies"
        if "strip" in value and "controller" not in value: return "Lighting controls", "LED strips"
        if "controller" in value: return "Lighting controls", "LED controllers"
        return "Lighting controls", "LED drivers"
    if serial <= 159: return "Lighting", "Smart panel and downlights"
    if serial <= 248:
        if "laser" in value or "linea" in value or "glimmer" in value: return "Lighting", "Linear spotlights"
        if "surface" in value or "cylinder" in value: return "Lighting", "Surface lights"
        return "Lighting", "COB downlights"
    if serial <= 255: return "Lighting accessories", "COB modules and frames"
    if serial == 256: return "Lighting", "Track lighting"
    if serial <= 259: return "Display and demo", "Display stands"
    if serial <= 263: return "Door lock accessories", "Lock spares"
    return "Smart switch accessories", "Panels and sockets"


def phlipton_technologies(serial, title):
    value = clean(title).lower()
    if serial <= 23: return [("ZigBee", 0)]
    if serial <= 72: return [("ZigBee", 0), ("Wi-Fi", -80)]
    if serial <= 78: return [("ZigBee", 0), ("Wi-Fi", -80)]
    if serial == 79: return [("Wired", 0)]
    if serial == 80: return [("ZigBee + Bluetooth", 0)]
    if serial == 81: return [("ZigBee + Thread + Matter", 0)]
    if serial == 82: return [("Dual ZigBee", 0)]
    if serial == 83: return [("Multi-protocol", 0)]
    if serial == 84: return [("ZigBee", 0)]
    if serial == 85: return [("Sigmesh", 0)]
    if serial in (86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98): return [("ZigBee", 0)]
    if serial == 90: return [("Wi-Fi", 0)]
    if serial in (99, 100, 102): return [("Standalone", 0), ("Wi-Fi", 550), ("ZigBee", 850), ("RX-TX", 1100)]
    if serial == 101: return [("Standalone", 0)]
    if serial in (103, 104, 105, 106, 113, 115, 116): return [("Wi-Fi", 0), ("RX-TX", 1100)]
    if serial in (107, 108): return [("Standalone", 0), ("Wi-Fi", 550), ("RX-TX", 1100)]
    if serial in (109, 110, 111): return [("Bluetooth", 0)]
    if serial in (112, 117): return [("Wireless remote", 0)]
    if serial in (118, 119): return [("Standalone", 0)]
    if serial == 120: return [("Wi-Fi", 0)]
    if serial == 121: return [("Wired + IP", 0)]
    if serial == 122: return [("Wired analog", 0)]
    if serial == 123: return [("RFID + Wi-Fi", 0)]
    if serial == 124: return [("IP intercom", 0)]
    if serial == 125: return [("Wired", 0)]
    if serial in (126, 127): return [("ZigBee", 0)]
    if serial in (128, 129, 130): return [("Mechanical", 0)]
    if serial == 131: return [("RF remote", 0)]
    if serial in (132, 133, 134, 135, 141, 142, 144): return [("ZigBee", 0)]
    if serial == 143: return [("Wi-Fi", 0)]
    if 147 <= serial <= 159: return [("ZigBee", 0)]
    if serial == 256: return [("ZigBee", 0)]
    if any(token in value for token in ("zigbee", "wi-fi", "wifi", "bluetooth", "matter")):
        parts = []
        if "zigbee" in value: parts.append("ZigBee")
        if "wi-fi" in value or "wifi" in value: parts.append("Wi-Fi")
        if "bluetooth" in value: parts.append("Bluetooth")
        if "matter" in value: parts.append("Matter")
        return [(" + ".join(parts), 0)]
    return [("Standard", 0)]


def phlipton_materials(serial, title, module_size):
    value = clean(title).lower()
    if serial <= 23:
        if "pc only" in value: return [("PC", 0)]
        surcharge = {"2M": (750, 650), "4M": (1200, 950), "6/8M": (1800, 1500)}.get(module_size, (0, 0))
        return [("PC", 0), ("Brushed aluminium", surcharge[0]), ("Glass", surcharge[1])]
    if serial <= 72:
        if "glass" in value or "bezel less" in value: return [("Glass + aluminium bezel", 0)]
        surcharge = {"2M": 750, "4M": 970, "6/8M": 1340}.get(module_size, 0)
        return [("PC", 0), ("Glass + aluminium bezel", surcharge)]
    if "ss304" in value or "stainless" in value: return [("SS304 stainless steel", 0)]
    if "aluminum profile" in value or "aluminium" in value: return [("Aluminium", 0)]
    if "glass lock" in value: return [("Glass", 0)]
    if "black matte" in value: return [("Black matte metal", 0)]
    if "silver chrome" in value: return [("Silver chrome metal", 0)]
    if "cnc finish" in value: return [("CNC-finished metal", 0)]
    if "metal finish" in value: return [("Metal", 0)]
    if "pc " in value or value.startswith("pc "): return [("PC", 0)]
    if 99 <= serial <= 123: return [("Metal", 0)]
    if 147 <= serial <= 256: return [("Aluminium", 0)]
    return [("Standard", 0)]


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
                    "series": series_name, "category": category(title), "subcategory": switch_subcategory(title), "module": clean(row[3]) or "Standard",
                    "technology": technology, "material": finish, "finish": finish, "sellingPrice": selling,
                    "purchaseCost": cost, "warranty": "6 years", "source": "Noviq Master Price List 2026",
                    "sourceSheet": sheet, "image": f"/products/noviq/{series_slug}-{serial}.webp", "description": noviq_title(title), "hsn": "", "gst": 18,
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
                    distributor_price, cost = number(values[4]), number(values[5])
                    if distributor_price is None:
                        available = [number(value) for value in values[4:] if number(value) is not None]
                        distributor_price = available[0] if available else 0
                    cost = cost if cost is not None else distributor_price
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
                    serial_number = int(serial)
                    item_category, item_subcategory = phlipton_classification(serial_number, title)
                    warranty = "5 years" if serial_number <= 23 else "3 years" if serial_number <= 98 or 132 <= serial_number <= 144 else "2 years" if 99 <= serial_number <= 131 or 147 <= serial_number <= 256 else "Manufacturer warranty"
                    for technology, technology_adjustment in phlipton_technologies(serial_number, title):
                        for material, material_adjustment in phlipton_materials(serial_number, title, module_size):
                            adjustment = technology_adjustment + material_adjustment
                            variant_suffix = f"{slug(technology).upper()}-{slug(material).upper()}"
                            records.append({
                                "id": f"PH-{serial}-{variant_suffix}",
                                "sku": f"NQ-PH-{serial_number:03d}-{slug(sku_value).upper()}-{variant_suffix}",
                                "supplierSku": sku_value,
                                "name": product_name,
                                "series": f"Noviq {switch_family}" if switch_family else "Noviq",
                                "category": item_category,
                                "subcategory": item_subcategory,
                                "module": module_size,
                                "technology": technology,
                                "material": material,
                                "finish": material,
                                "sellingPrice": round(max(0, distributor_price + adjustment) * 2.5, 2),
                                "purchaseCost": round(max(0, cost + adjustment), 2),
                                "warranty": warranty,
                                "source": "Phlipton B2B Bulk OEM Pricelist May 2026",
                                "sourcePage": page_number,
                                "image": f"/products/phlipton/{image_slug}.webp",
                                "description": title,
                                "hsn": "",
                                "gst": 18,
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
                            "series": "Autozon", "category": product_category, "subcategory": product_category, "module": "Fixed configuration",
                            "technology": "Automatic", "material": "Standard", "finish": "Standard", "sellingPrice": selling,
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
