"""Build a review-only normalized Item Master import from the supplier sources.

This command never publishes items and never updates old quotations. It writes a
portable JSON review package that can be inspected and then submitted to the
admin import API after brand, media, tax and selling-price approval.
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
VARNI_JSON = ROOT / "tmp" / "import" / "master-price-list.json"
VARNI_XLSX = Path(r"C:\Users\Admin\Downloads\Master Price List 2026 - 50% Discount.xlsx")
PHLIPTON_PDF = Path(r"D:\Techomie\Supplier\Phlipton\Phlipton B2B Bulk Oem Pricelist may26-1.pdf")
OUTPUT = ROOT / "tmp" / "import" / "item-master-normalized.json"
SUMMARY = ROOT / "tmp" / "import" / "item-master-review-summary.json"

VARNI_SERIES = {
    "RE": "Royal Edge Color", "REDC": "Royal Edge DC", "CE": "Color Edge",
    "E": "Edge", "CTP": "Color Touch Panel", "TP": "Touch Panel", "T+": "Touch Plus",
}
TECHNOLOGY = {"WIFI": "Wi-Fi", "ZIGBEE": "Zigbee", "REMOTE": "Remote Based"}
PH_TIER_NAMES = ("Distributor", "20-100", "101-200", "201-500", "500-1000")
PH_TIER_RANGES = ((1, 19), (20, 100), (101, 200), (201, 500), (500, 1000))


def clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def number(value):
    match = re.search(r"-?\d[\d,]*(?:\.\d+)?", clean(value))
    return float(match.group(0).replace(",", "")) if match else None


def stable(prefix: str, *parts) -> str:
    digest = hashlib.sha1("|".join(clean(x).lower() for x in parts).encode()).hexdigest()[:16]
    return f"{prefix}-{digest}"


def slug(value) -> str:
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-")


def category_for(serial: int, name: str):
    text = name.lower()
    if serial and serial <= 72: return "Smart switches"
    if 73 <= serial <= 79: return "Retrofit modules"
    if 80 <= serial <= 84: return "Gateways"
    if 85 <= serial <= 98: return "Control panels and sensors"
    if 99 <= serial <= 119: return "Door locks"
    if 120 <= serial <= 124: return "Video door phones"
    if 125 <= serial <= 131: return "Curtains"
    if serial >= 132: return "Lighting"
    if "dnd" in text or "keytag" in text: return "Hotel controls"
    return "Smart switches"


def module_from(model: str, description: str):
    match = re.search(r"(?<!\d)(2M|3M|4M|6M|8M|6/8M|8M Square|12M|16M|18M)\b", f"{model} {description}", re.I)
    return match.group(1).upper() if match else None


def configuration(description: str, model: str):
    text = f"{description} {model}".lower()
    def count(pattern):
        match = re.search(pattern, text)
        return int(match.group(1)) if match else None
    return {
        "moduleSize": module_from(model, description),
        "lightSwitches": count(r"(\d+)\s*(?:light|l\b)"),
        "switches6a": count(r"(\d+)\s*(?:switch|6a)"),
        "switches16a": count(r"(\d+)\s*16a"),
        "fanControls": count(r"(\d+)\s*(?:fan|f\b)"),
        "curtains": count(r"(\d+)\s*(?:curtain|c\b)"),
        "sockets": count(r"(\d+)\s*(?:socket|sk\b)"),
        "usbSocket": bool(re.search(r"usb|\bu\b", text)),
        "scenes": count(r"(\d+)\s*scene"),
        "loadRating": clean(" / ".join(re.findall(r"\b\d+(?:\.\d+)?(?:a|w)\b", text, re.I))) or None,
        "layoutCode": clean(model) or None,
    }


def phlipton_options(serial: int, description: str, model: str):
    module = module_from(model, description)
    if serial <= 23:
        finish_mod = {"2M": (750, 650), "4M": (1200, 950), "6/8M": (1800, 1500)}.get(module, (0, 0))
        return [("Zigbee", "PC", 0), ("Zigbee", "Aluminium", finish_mod[0]), ("Zigbee", "Glass", finish_mod[1])]
    if serial <= 72:
        glass = {"2M": 750, "4M": 970, "6/8M": 1340}.get(module, 0)
        return [(tech, finish, tech_mod + finish_mod) for tech, tech_mod in (("Zigbee", 0), ("Wi-Fi", -80), ("Only Touch", -350)) for finish, finish_mod in (("PC", 0), ("Glass + aluminium bezel", glass))]
    if 73 <= serial <= 78: return [("Zigbee", None, 0), ("Wi-Fi", None, -80)]
    fixed = "Zigbee" if serial in range(80, 90) else None
    return [(fixed, None, 0)]


def image_for_phlipton(serial: int, model: str):
    candidates = list((ROOT / "public" / "products" / "phlipton").glob(f"{serial:03d}-*.webp"))
    if not candidates and model:
        candidates = list((ROOT / "public" / "products" / "phlipton").glob(f"*{slug(model)}*.webp"))
    return "/" + candidates[0].relative_to(ROOT / "public").as_posix() if candidates else None


def image_for_varni(series: str, serial: int):
    family = {"Royal Edge Color": "re", "Royal Edge DC": "royal-edge", "Color Edge": "edge-color", "Edge": "edge", "Color Touch Panel": "color-touch", "Touch Panel": "touch-panel", "Touch Plus": "touch-plus", "Hotel DND": "dnd"}[series]
    candidates = [ROOT / "public" / "products" / "varni" / f"{family}-{serial}.webp", ROOT / "public" / "products" / "noviq" / f"{family}-{serial}.webp"]
    found = next((path for path in candidates if path.exists()), None)
    return "/" + found.relative_to(ROOT / "public").as_posix() if found else None


def add_record(package, *, supplier, price_book, base_name, series, category, configuration_data,
               technology, material, supplier_model, list_price, discount, net_price, source,
               source_sheet=None, source_page=None, source_row=None, tiers=None, modifier=0, image=None):
    base_id = stable("BASE", supplier, series, base_name, json.dumps(configuration_data, sort_keys=True))
    config_id = stable("CFG", base_id, configuration_data.get("layoutCode") or base_name)
    variant_id = stable("VAR", base_id, technology, material)
    supplier_item_id = stable("SI", price_book, supplier_model, source_sheet, source_page, source_row, technology, material)
    package["baseProducts"].setdefault(base_id, {
        "id": base_id, "internalCode": f"TCM-{base_id[-10:].upper()}", "procurementName": base_name,
        "customerName": base_name, "customerBrand": "Unbranded/OEM", "brandMappingRequired": True,
        "series": series, "category": category, "subcategory": None, "unit": "Nos",
        "pricingMethod": "Quantity-tier price" if tiers else "Base price plus modifier" if modifier else "Fixed variant price",
        "reviewStatus": "Needs Review", "active": False, "image": image,
    })
    package["configurations"].setdefault(config_id, {"id": config_id, "baseProductId": base_id, "configurationCode": configuration_data.get("layoutCode") or base_name, **configuration_data})
    package["variants"].setdefault(variant_id, {
        "id": variant_id, "baseProductId": base_id, "configurationId": config_id,
        "internalItemId": f"TCM-{variant_id[-12:].upper()}", "technology": technology,
        "material": material, "finish": material, "sellingPrice": None, "sellingMethod": "Manual fixed selling price",
        "reviewStatus": "Needs Review", "active": False, "image": image,
    })
    package["supplierItems"].append({
        "id": supplier_item_id, "supplier": supplier, "priceBookId": price_book, "variantId": variant_id,
        "supplierProductName": base_name, "supplierModel": supplier_model or None,
        "sourceListPrice": list_price, "discountPercent": discount, "netBuyingPrice": net_price + modifier if net_price is not None else None,
        "gstStatus": "GST extra" if supplier == "Phlipton" else "As stated in source - review",
        "sourceSheet": source_sheet, "sourcePage": source_page, "sourceRow": source_row,
        "reviewStatus": "Imported", "image": image, "source": source,
    })
    for tier in tiers or []:
        package["quantityTiers"].append({"id": stable("TIER", supplier_item_id, tier[0]), "supplierItemId": supplier_item_id, "name": tier[0], "minQuantity": tier[1], "maxQuantity": tier[2], "unitPrice": tier[3], "isDefault": tier[0] == "Distributor"})
    if modifier:
        package["modifiers"].append({
            "id": stable("MOD", base_id, variant_id, technology, material, modifier),
            "baseProductId": base_id, "variantId": variant_id,
            "name": " / ".join(filter(None, (technology, material))) + " supplier-cost adjustment",
            "modifierType": "Fixed amount", "amount": modifier,
            "conditions": {"technology": technology, "finish": material},
            "customerVisible": False, "active": True,
        })


def build():
    now = datetime.now(timezone.utc).isoformat()
    package = {"generatedAt": now, "mode": "review-only", "baseProducts": {}, "configurations": {}, "variants": {}, "supplierItems": [], "quantityTiers": [], "modifiers": [], "media": [], "errors": []}
    package["suppliers"] = [{"id": "SUP-VARNI", "name": "Varni Digital", "code": "VARNI"}, {"id": "SUP-PHLIPTON", "name": "Phlipton", "code": "PHLIPTON"}]
    package["priceBooks"] = [
        {"id": "PB-VARNI-2026-04-01", "supplierId": "SUP-VARNI", "name": "Varni Master Price List 2026", "version": "2026-04-01", "effectiveDate": "2026-04-01", "gstStatus": "Review source tax status", "defaultTier": "Net buying price", "sourceFile": VARNI_XLSX.name, "status": "Imported"},
        {"id": "PB-PHLIPTON-2026-05-01", "supplierId": "SUP-PHLIPTON", "name": "Phlipton B2B Bulk OEM Pricelist", "version": "2026-05-01", "effectiveDate": "2026-05-01", "gstStatus": "GST extra", "defaultTier": "Distributor", "sourceFile": PHLIPTON_PDF.name, "status": "Imported"},
    ]
    raw = json.loads(VARNI_JSON.read_text(encoding="utf-8"))
    for sheet, rows in raw.items():
        if sheet == "DND": technology, series = "Only Touch/Non-smart", "Hotel DND"
        elif "-" in sheet and sheet.split("-", 1)[0] in TECHNOLOGY and sheet.split("-", 1)[1] in VARNI_SERIES:
            code, family = sheet.split("-", 1); technology, series = TECHNOLOGY[code], VARNI_SERIES[family]
        else: continue
        heading = " ".join(clean(cell) for row in rows[:9] for cell in row if cell)
        expected = technology.split()[0].replace("-", "").lower()
        if sheet != "DND" and expected not in heading.replace("-", "").lower():
            package["errors"].append({"severity": "warning", "code": "CONFLICTING_TECHNOLOGY_LABEL", "message": f"{sheet} heading does not clearly match sheet technology", "sourceSheet": sheet})
        for row_no, row in enumerate(rows, 1):
            if len(row) < 7 or not isinstance(row[0], (int, float)) or not clean(row[2]): continue
            serial, name, module = int(row[0]), clean(row[2]), clean(row[3]) or None
            config = configuration(name, ""); config["moduleSize"] = module
            for material, list_col, discount_col, net_col in (("Acrylic", 4, 5, 6), ("Glass", 7, 8, 9)):
                list_price = number(row[list_col]) if len(row) > list_col else None
                net = number(row[net_col]) if len(row) > net_col else None
                if list_price is None or net is None: continue
                discount = number(row[discount_col]) if len(row) > discount_col else None
                add_record(package, supplier="Varni Digital", price_book="PB-VARNI-2026-04-01", base_name=name, series=series,
                           category=category_for(0, name), configuration_data=config, technology=technology, material=material,
                           supplier_model=None, list_price=list_price, discount=discount, net_price=net,
                           source=VARNI_XLSX.name, source_sheet=sheet, source_row=row_no, image=image_for_varni(series, serial))
    with pdfplumber.open(PHLIPTON_PDF) as document:
        for page_number, page in enumerate(document.pages, 1):
            for table in page.extract_tables():
                for row_index, row in enumerate(table, 1):
                    if not row or not clean(row[0]).isdigit() or len(row) < 9: continue
                    serial, name, model = int(clean(row[0])), clean(row[2]), clean(row[3]).replace(" ", "")
                    prices = [number(value) for value in row[4:9]]
                    if not name or not model or model == "-":
                        package["errors"].append({"severity": "error", "code": "MISSING_MODEL", "message": f"Phlipton item {serial} requires model review", "sourcePage": page_number, "sourceRow": row_index})
                    if not any(price is not None for price in prices):
                        package["errors"].append({"severity": "error", "code": "INVALID_PRICE", "message": f"Phlipton item {serial} has no valid price", "sourcePage": page_number, "sourceRow": row_index}); continue
                    distributor = prices[0] or next(price for price in prices if price is not None)
                    tiers = [(tier_name, bounds[0], bounds[1], price) for tier_name, bounds, price in zip(PH_TIER_NAMES, PH_TIER_RANGES, prices) if price is not None]
                    config = configuration(name, model)
                    for technology, material, modifier in phlipton_options(serial, name, model):
                        add_record(package, supplier="Phlipton", price_book="PB-PHLIPTON-2026-05-01", base_name=name, series="Titan" if model.upper().startswith("PN-TN") else "Luxeray" if model.upper().startswith("PN-LXR") else None,
                                   category=category_for(serial, name), configuration_data=config, technology=technology, material=material,
                                   supplier_model=model or None, list_price=distributor, discount=None, net_price=distributor,
                                   source=PHLIPTON_PDF.name, source_page=page_number, source_row=row_index,
                                   tiers=tiers, modifier=modifier, image=image_for_phlipton(serial, model))
    for base in package["baseProducts"].values():
        if not base["image"]: package["errors"].append({"severity": "warning", "code": "MISSING_IMAGE", "message": f"{base['procurementName']} has no mapped product image", "baseProductId": base["id"]})
        package["media"].append({"id": stable("MEDIA", base["id"], base["image"]), "baseProductId": base["id"], "kind": "Base item image", "fileKey": base["image"], "source": "Supplier price list", "reviewStatus": "Needs Review", "customerApproved": False})
    for key in ("baseProducts", "configurations", "variants"): package[key] = list(package[key].values())
    counts = Counter(error["code"] for error in package["errors"])
    package["summary"] = {"baseItems": len(package["baseProducts"]), "variants": len(package["variants"]), "supplierItems": len(package["supplierItems"]), "quantityTiers": len(package["quantityTiers"]), "media": len(package["media"]), "errors": len(package["errors"]), "errorTypes": counts}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(package, ensure_ascii=False, indent=2), encoding="utf-8")
    SUMMARY.write_text(json.dumps(package["summary"], ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(package["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    build()
