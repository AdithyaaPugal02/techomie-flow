import json
import re
import sqlite3
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_JSON = ROOT / "tmp" / "import" / "full-catalog.json"
RAW_FILE = ROOT / "tmp" / "updated_phlipton_parsed.txt"
DB_FILE = ROOT / ".local-db.sqlite"

def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()

def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-")

def noviq_title(value):
    title = clean(value)
    title = re.sub(r"\(?www\.varnidigital\.(?:shop|com|in)\)?", "", title, flags=re.I)
    title = re.sub(r"varni\s+digital", "Noviq", title, flags=re.I)
    title = clean(title).strip(" .-")
    return title if title.upper().startswith("Noviq ") else "Noviq " + title

def switch_subcategory(name):
    value = clean(name).lower()
    if "dnd" in value or "hotel" in value: return "Hotel room controls"
    if "door bell" in value or "doorbell" in value: return "Doorbell panels"
    if "curtain" in value: return "Curtain control panels"
    if "fan" in value or "regulator" in value or "knob" in value: return "Fan control panels"
    if "socket" in value: return "Switch and socket panels"
    if "scene" in value: return "Scene control panels"
    return "Switch panels"

def classification(sr, title):
    value = clean(title).lower()
    if sr <= 77:
        return "Smart switches", switch_subcategory(title)
    if sr <= 84:
        return "Retrofit modules", "Relays" if "relay" in value else "In-wall modules"
    if sr <= 88:
        return "Gateways", "Signal repeaters" if "repeater" in value else "Smart home gateways"
    if sr <= 94:
        return "Control panels", "Wall touch panels"
    if sr <= 103:
        if "sensor" in value or "presence" in value: return "Sensors and controls", "Occupancy sensors"
        if "remote" in value: return "Sensors and controls", "IR remotes"
        if "gateway" in value or "vrf" in value: return "Sensors and controls", "HVAC gateways"
        if "knob" in value: return "Sensors and controls", "Wireless knobs"
        return "Sensors and controls", "Wireless scene switches"
    if sr <= 124:
        return "Door locks", "Cabinet locks" if "cabinet" in value or "wd1" in value or "wd2" in value else "Smart door locks"
    if sr == 125:
        return "Doorbells", "Video doorbells"
    if sr in (126, 127):
        return "Video door phones", "VDP kits"
    if sr == 128:
        return "Door locks", "Hotel door locks"
    if sr <= 135:
        if "track" in value: return "Curtains", "Curtain tracks"
        if "remote" in value: return "Curtains", "Curtain remotes"
        return "Curtains", "Curtain motors"
    if sr <= 149:
        if "power supply" in value or "vps" in value: return "Lighting controls", "Power supplies"
        if "strip" in value and "controller" not in value: return "Lighting controls", "LED strips"
        if "controller" in value: return "Lighting controls", "LED controllers"
        return "Lighting controls", "LED drivers"
    if sr <= 158:
        return "Lighting", "Smart panel and downlights"
    if sr <= 207:
        if "laser" in value or "linea" in value or "glimmer" in value or "seam" in value:
            return "Lighting", "Linear spotlights"
        if "surface" in value or "cylinder" in value:
            return "Lighting", "Surface lights"
        return "Lighting", "COB downlights"
    if sr in (208, 209, 210):
        return "Display and demo", "Display stands"
    if sr in (211, 212, 213, 214):
        return "Door lock accessories", "Lock spares"
    return "Smart switch accessories", "Panels and sockets"

def warranty_for(sr):
    if sr <= 23: return "5 years"
    if sr <= 88: return "3 years"
    if sr <= 94: return "2 years"
    if sr <= 103: return "3 years"
    if sr <= 124:
        if sr in (117, 118, 119, 120, 121, 122): return "3 years"
        return "2 years"
    if sr in (125, 126): return "3 years"
    if sr == 127: return "1 year"
    if sr == 128: return "2 years"
    if sr <= 135: return "3 years"
    if sr <= 139: return "3 years"
    if sr <= 147: return "2 years"
    if sr in (148, 149): return "1 year"
    if sr <= 207: return "2 years"
    if sr == 211: return "6 months"
    if sr == 217: return "2 years"
    return "Manufacturer warranty"

def technologies_for(sr, title):
    value = clean(title).lower()
    if sr <= 23:
        return [("ZigBee", 0)]
    if sr in (24, 25):
        return [("ZigBee", 0)]
    if sr <= 77:
        return [("ZigBee", 0), ("Wi-Fi", -80)]
    if sr <= 84:
        return [("ZigBee", 0), ("Wi-Fi", -80)]
    if sr == 85:
        return [("ZigBee + Bluetooth", 0)]
    if sr == 86:
        return [("ZigBee + Thread + Matter", 0)]
    if sr == 87:
        return [("Multi-protocol", 0)]
    if sr == 88:
        return [("ZigBee", 0)]
    if sr == 89:
        return [("Sigmesh", 0)]
    if sr in (90, 91, 92, 93, 94):
        return [("ZigBee", 0)]
    if sr == 95:
        return [("ZigBee", 0)]
    if sr == 96:
        return [("Wi-Fi", 0)]
    if sr in (97, 98, 99, 100, 101, 102, 103):
        return [("ZigBee", 0)]
    # Digital Door locks:
    if sr in (104, 105, 106):
        return [("Standalone", 0), ("Wi-Fi", 550), ("ZigBee", 850), ("RX-TX", 1100)]
    if sr in (107, 108, 109, 110):
        return [("Wi-Fi", 0), ("RX-TX", 1100)]
    if sr in (111, 112):
        return [("Standalone", 0), ("Wi-Fi", 550), ("RX-TX", 1100)]
    if sr in (113, 114, 115):
        return [("Bluetooth", 0)]
    if sr == 116:
        return [("Bluetooth", 0), ("Wireless remote", 450)]
    if sr in (117, 120, 121):
        return [("Wi-Fi", 0), ("RX-TX", 1100)]
    if sr in (118, 119):
        return [("Wi-Fi", 0)]
    if sr == 122:
        return [("Wireless remote", 0), ("Extra remote", 450)]
    if sr in (123, 124):
        return [("Standalone", 0)]
    if sr == 125:
        return [("Wi-Fi", 0)]
    if sr == 126:
        return [("Wired + IP", 0)]
    if sr == 127:
        return [("Wired analog", 0)]
    if sr == 128:
        return [("RFID + Wi-Fi", 0)]
    if sr in (129, 130, 131):
        return [("ZigBee", 0)]
    if sr in (132, 133, 134):
        return [("Standard", 0)]
    if sr == 135:
        return [("RF remote", 0)]
    if sr in (136, 137, 138, 139):
        return [("ZigBee", 0)]
    if sr in (140, 141, 142, 143):
        return [("Standard", 0)]
    if sr in (144, 145, 146, 147):
        return [("ZigBee", 0)]
    if 150 <= sr <= 207:
        return [("ZigBee", 0)]
    return [("Standard", 0)]

def materials_for(sr, title, module_size):
    value = clean(title).lower()
    if sr <= 23:
        if "pc only" in value:
            return [("PC", 0)]
        surcharge = {"2M": 750, "4M": 1200, "6/8M": 1800}.get(module_size, 0)
        return [("PC", 0), ("Brushed aluminium", surcharge)]
    if sr in (24, 25):
        return [("Glass + aluminium bezel", 0)]
    if sr == 26:
        return [("Bezel less glass", 0)]
    if sr <= 77:
        return [("Glass + aluminium bezel", 0)]
    if sr in (104, 105, 106, 107):
        return [("SS304 stainless steel", 0)]
    if sr in (108, 109, 110):
        return [("CNC-finished metal", 0)]
    if sr in (111, 112):
        return [("Metal", 0)]
    if sr == 113:
        return [("Aluminium", 0)]
    if sr in (114, 115):
        return [("Metal", 0)]
    if sr == 116:
        return [("Glass", 0)]
    if sr in (117, 118):
        return [("Black matte metal", 0)]
    if sr == 119:
        return [("Black / Gold / Grey metal", 0)]
    if sr == 120:
        return [("Solid silver finish", 0)]
    if sr == 121:
        return [("Black matte metal + CNC", 0)]
    if sr == 122:
        return [("Glass", 0)]
    if sr in (123, 124):
        return [("Metal", 0)]
    if 150 <= sr <= 207:
        return [("Aluminium", 0)]
    return [("Standard", 0)]

def parse_lines():
    lines = open(RAW_FILE, encoding='utf-8').read().splitlines()
    items = []
    
    for line in lines:
        line = line.strip()
        if not line: continue
        sr = int(line.split()[0])
        
        matches = list(re.finditer(r'(?:PN-[\w\-\.\(\)\+\/]+(?:\s+[\w\-\.\(\)\+\/]+)*|12VPS|24VPS)', line))
        if matches:
            m = matches[-1]
            model = re.sub(r'\s+Click.*$', '', m.group(0).strip())
            model = re.sub(r'\s+₹.*$', '', model)
            title = line[len(str(sr)):m.start()].strip()
            price_strs = re.findall(r'₹([\d,]+(?:\.\d+)?)', line[m.end():])
            prices = [float(p.replace(',', '')) for p in price_strs]
        else:
            model = f"PN-{sr}"
            title = line[len(str(sr)):].strip()
            prices = []
            
        items.append({
            'sr': sr,
            'title': title,
            'model': model,
            'prices': prices,
            'raw': line
        })
    return items

def find_image(sr, model, title):
    imgs = set(p.name for p in (ROOT / "public" / "products" / "phlipton").glob("*.webp"))
    
    # 1. Exact custom overrides
    if model == "PN-WDL-S5 Ai":
        return "/products/phlipton/119-pn-wdl-s5-ai.webp"
    if "s6 pro" in model.lower() or "s6-pro" in model.lower():
        return "/products/phlipton/115-pn-wdl-s6.webp"
    if "s7" in model.lower():
        return "/products/phlipton/116-pn-wdl-v1.webp"
    if 69 <= sr <= 77:
        old_sr = sr - 5
        for img in imgs:
            if img.startswith(f"{old_sr:03d}-"):
                return f"/products/phlipton/{img}"
    if 64 <= sr <= 68:
        return "/products/phlipton/055-pn-lxr-6-8m-8-0-0-1u-pn-lxr-6-8m-8-0-0-1ul.webp"
    if sr == 208: return "/products/phlipton/257-pn-257.webp"
    if sr == 209: return "/products/phlipton/258-pn-258.webp"
    if sr == 210: return "/products/phlipton/259-pn-259.webp"
    if sr == 211: return "/products/phlipton/260-pn-260.webp"
    if sr == 212: return "/products/phlipton/261-pn-261.webp"
    if sr == 213: return "/products/phlipton/262-pn-262.webp"
    if sr == 214: return "/products/phlipton/263-pn-263.webp"
    if sr == 215: return "/products/phlipton/264-pn-264.webp"
    if sr == 216: return "/products/phlipton/265-pn-265.webp"
    if sr == 217: return "/products/phlipton/266-pn-266.webp"

    # 2. Check by model slug
    mslug = slug(model)[:45]
    for img in imgs:
        if mslug in img.lower() and len(mslug) > 5:
            return f"/products/phlipton/{img}"

    # 3. Check by token (e.g. S1PRO, B53, A01, etc.)
    tokens = re.findall(r'[A-Za-z0-9]+', model)
    for token in reversed(tokens):
        if len(token) >= 3 and token.upper() not in ("PN", "LXR", "COB", "PL", "TN"):
            for img in imgs:
                if token.lower() in img.lower():
                    return f"/products/phlipton/{img}"

    # 4. By serial prefix
    for img in imgs:
        if img.startswith(f"{sr:03d}-"):
            return f"/products/phlipton/{img}"

    return f"/products/phlipton/{sr:03d}-{slug(model)[:35]}.webp"

def main():
    items = parse_lines()
    print(f"Parsed {len(items)} updated items.")

    existing_catalog = json.load(open(CATALOG_JSON, encoding='utf-8'))
    non_phlipton = [x for x in existing_catalog if not x.get('id', '').startswith('PH-')]
    print(f"Retained {len(non_phlipton)} non-Phlipton products.")

    new_records = []

    for item in items:
        sr = item['sr']
        title = item['title']
        model = item['model']
        prices = item['prices']

        # Determine module size
        module_match = re.search(r"-(\d+(?:/\d+)?M)(?:\b|\()", model, re.I)
        if not module_match:
            module_match = re.search(r"\b(\d+(?:/\d+)?M)\b", title, re.I)
        module_size = module_match.group(1).upper() if module_match else "Standard"

        switch_family = "Titan" if model.upper().startswith("PN-TN") else "Luxeray" if model.upper().startswith("PN-LXR") else ""

        product_name = noviq_title(title)
        if switch_family and not switch_family.lower() in product_name.lower():
            product_name = re.sub(r"^Noviq\s+", f"Noviq {switch_family} ", product_name, flags=re.I)

        cat, subcat = classification(sr, title)
        warranty = warranty_for(sr)

        if prices:
            distributor_price = prices[0]
            # Buying price is 20-100 tier (prices[1]) if available, else distributor_price
            cost = prices[1] if len(prices) > 1 else distributor_price
        else:
            distributor_price = 0
            cost = 0

        img = find_image(sr, model, title)

        techs = technologies_for(sr, title)
        mats = materials_for(sr, title, module_size)

        for tech, tech_adj in techs:
            for mat, mat_adj in mats:
                adj = tech_adj + mat_adj
                variant_suffix = f"{slug(tech).upper()}-{slug(mat).upper()}"

                final_cost = round(max(0, cost + adj), 2)
                if sr >= 208:
                    final_sell = round(max(0, (distributor_price + adj) * 1.5), 2)
                else:
                    final_sell = round(max(0, (distributor_price + adj) * 2.5), 2)

                new_records.append({
                    "id": f"PH-{sr}-{variant_suffix}",
                    "sku": f"NQ-PH-{sr:03d}-{slug(model).upper()}-{variant_suffix}",
                    "supplierSku": model,
                    "name": product_name,
                    "series": f"Noviq {switch_family}" if switch_family else "Noviq",
                    "category": cat,
                    "subcategory": subcat,
                    "module": module_size,
                    "technology": tech,
                    "material": mat,
                    "finish": mat,
                    "sellingPrice": final_sell,
                    "purchaseCost": final_cost,
                    "warranty": warranty,
                    "source": "Phlipton Smart Products Price List 2026",
                    "sourcePage": 1,
                    "image": img,
                    "description": clean(title),
                    "hsn": "8536" if "switch" in cat.lower() else "8301" if "lock" in cat.lower() else "9405" if "light" in cat.lower() else "",
                    "gst": 18
                })

    print(f"Generated {len(new_records)} Phlipton variants with updated prices.")

    # Check lock count
    locks = [x for x in new_records if "lock" in x["category"].lower()]
    print(f"Total Phlipton door locks created: {len(locks)}")
    for l in [x for x in locks if x['id'].endswith(('-STANDALONE-SS304-STAINLESS-STEEL', '-WI-FI-BLACK-MATTE-METAL', '-WI-FI-MULTI-COLOR-METAL', '-WI-FI-SOLID-SILVER-FINISH', '-WI-FI-BLACK-MATTE-METAL-CNC', '-BLUETOOTH-ALUMINIUM', '-STANDALONE-METAL'))]:
        print(f"  {l['id']:35s} | {l['supplierSku']:16s} | Cost: {l['purchaseCost']:8.2f} | Sell: {l['sellingPrice']:8.2f}")

    updated_full_catalog = non_phlipton + new_records
    with open(CATALOG_JSON, 'w', encoding='utf-8') as f:
        json.dump(updated_full_catalog, f, indent=2, ensure_ascii=False)
    print("Updated tmp/import/full-catalog.json saved.")

    # Rebuild TypeScript chunks
    print("Rebuilding catalog-data chunks via build-catalog.mjs...")
    subprocess.run(["node", "scripts/build-catalog.mjs"], check=True, cwd=str(ROOT))
    print("Catalog chunks built successfully.")

    # Update SQLite database
    if DB_FILE.exists():
        print("Updating .local-db.sqlite products and variants...")
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()

        # Delete existing Phlipton products and variants
        cursor.execute("SELECT id FROM products WHERE brand = 'Noviq'")
        # Note: in local-db.ts all catalog items had brand='Noviq'
        # But we only want to replace Phlipton items or all catalog items from full-catalog.json!
        # Re-syncing from full-catalog.json ensures full consistency!
        cursor.execute("BEGIN TRANSACTION;")
        try:
            cursor.execute("DELETE FROM variants;")
            cursor.execute("DELETE FROM products;")

            insert_product = """
                INSERT INTO products (name, category, subcategory, series, brand, description, hsn, tax_rate, warranty, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'Noviq', ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            """
            insert_variant = """
                INSERT INTO variants (product_id, sku, name, attributes, selling_price, purchase_cost, tax_rate, hsn, warranty, image_key, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """

            product_map = {}
            p_count = 0
            v_count = 0

            for item in updated_full_catalog:
                prod_key = f"{item['category']}:::{item['series']}:::{item['name']}"
                prod_id = product_map.get(prod_key)
                if not prod_id:
                    cursor.execute(
                        insert_product,
                        (
                            item["name"],
                            item["category"] or "Smart Home",
                            item.get("subcategory"),
                            item.get("series"),
                            item.get("description") or item["name"],
                            item.get("hsn"),
                            float(item.get("gst", 18)),
                            item.get("warranty"),
                        )
                    )
                    prod_id = cursor.lastrowid
                    product_map[prod_key] = prod_id
                    p_count += 1

                attrs = json.dumps({
                    "module": item.get("module"),
                    "technology": item.get("technology"),
                    "material": item.get("material"),
                    "finish": item.get("finish"),
                })

                try:
                    cursor.execute(
                        insert_variant,
                        (
                            prod_id,
                            item.get("sku") or f"SKU-{v_count + 1}",
                            item["name"],
                            attrs,
                            float(item.get("sellingPrice", 0)),
                            float(item.get("purchaseCost", 0)),
                            float(item.get("gst", 18)),
                            item.get("hsn"),
                            item.get("warranty"),
                            item.get("image"),
                        )
                    )
                    v_count += 1
                except sqlite3.IntegrityError:
                    pass

            conn.commit()
            print(f"Successfully re-synced SQLite DB: {p_count} products and {v_count} variants.")
        except Exception as e:
            conn.rollback()
            print(f"Error updating SQLite DB: {e}")
            raise
        finally:
            conn.close()

if __name__ == "__main__":
    main()
