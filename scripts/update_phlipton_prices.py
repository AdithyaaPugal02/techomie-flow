import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_JSON = ROOT / "tmp" / "import" / "full-catalog.json"
RAW_FILE = ROOT / "tmp" / "updated_phlipton_parsed.txt"

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
    # Door locks:
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
        return [("Wireless remote", 0)]
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
        # Luxeray: base price is for Zigbee Glass + Aluminium Bezel
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
        return [("Multi-color metal", 0)]
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

def parse_items():
    lines = open(RAW_FILE, encoding='utf-8').read().splitlines()
    items = []
    
    for line in lines:
        line = line.strip()
        if not line: continue
        m = re.match(r'^(\d+)\s+(.+)$', line)
        if not m: continue
        sr = int(m.group(1))
        rest = m.group(2)
        
        rupee_matches = list(re.finditer(r'₹([\d,]+(?:\.\d+)?)', rest))
        if rupee_matches:
            first_rupee_pos = rupee_matches[0].start()
            product_and_model = rest[:first_rupee_pos].strip()
            prices = [float(rm.group(1).replace(',', '')) for rm in rupee_matches]
        else:
            product_and_model = rest
            prices = []
            
        # extract model and title
        # look for model pattern
        model_match = re.search(r'(PN-[A-Za-z0-9\-\/\.\(\)\+]+(?:\s+[\(\)\w\+\/]+)?|12VPS|24VPS)', product_and_model)
        if model_match:
            model = model_match.group(1).strip()
            # remove model from product_and_model to get title
            title = product_and_model.replace(model, '').strip()
            title = re.sub(r'\s*\|\s*$', '', title).strip()
        else:
            model = f"PN-{sr}"
            title = product_and_model
            
        items.append({
            'sr': sr,
            'title': title,
            'model': model,
            'prices': prices,
            'raw': rest
        })
    return items

def run_update():
    items = parse_items()
    print(f"Parsed {len(items)} updated Phlipton items.")
    
    # Load existing full catalog
    existing_catalog = json.load(open(CATALOG_JSON, encoding='utf-8'))
    non_phlipton = [x for x in existing_catalog if not x.get('id', '').startswith('PH-')]
    existing_phlipton = [x for x in existing_catalog if x.get('id', '').startswith('PH-')]
    print(f"Existing catalog: {len(existing_catalog)} total ({len(non_phlipton)} non-Phlipton, {len(existing_phlipton)} old Phlipton)")
    
    # Existing image lookup by model or slug
    existing_images = {}
    for x in existing_phlipton:
        model = x.get('supplierSku', '').strip().upper()
        if model and x.get('image'):
            existing_images[model] = x['image']
        # also by serial
        sr = int(x['id'].split('-')[1])
        existing_images[f"SR-{sr}"] = x['image']

    new_phlipton_records = []
    
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
        
        # Prices
        if prices:
            distributor_price = prices[0]
            # cost is 20-100 tier (prices[1]) if available, else distributor_price
            cost = prices[1] if len(prices) > 1 else distributor_price
        else:
            distributor_price = 0
            cost = 0
            
        # Image resolution
        # Check existing images
        img = existing_images.get(model.upper())
        if not img:
            # check by model slug
            img_slug = slug(model)[:50]
            for m_key, m_img in existing_images.items():
                if img_slug in m_img.lower():
                    img = m_img
                    break
        if not img:
            # Special door locks or accessories
            if model == "PN-WDL-S5 Ai":
                img = "/products/phlipton/119-pn-wdl-s5-ai.webp"
            elif model == "PN-WDL-S6 Pro Ai":
                img = "/products/phlipton/115-pn-wdl-s6.webp"
            elif model == "PN-WDL-S7":
                img = "/products/phlipton/116-pn-wdl-v1.webp"
            elif sr == 208:
                img = "/products/phlipton/257-pn-257.webp"
            elif sr == 209:
                img = "/products/phlipton/258-pn-258.webp"
            elif sr == 210:
                img = "/products/phlipton/259-pn-259.webp"
            elif sr == 211:
                img = "/products/phlipton/260-pn-260.webp"
            elif sr == 212:
                img = "/products/phlipton/261-pn-261.webp"
            elif sr == 213:
                img = "/products/phlipton/262-pn-262.webp"
            elif sr == 214:
                img = "/products/phlipton/263-pn-263.webp"
            elif sr == 215:
                img = "/products/phlipton/264-pn-264.webp"
            elif sr == 216:
                img = "/products/phlipton/265-pn-265.webp"
            elif sr == 217:
                img = "/products/phlipton/266-pn-266.webp"
            else:
                img = f"/products/phlipton/{sr:03d}-{slug(model)[:40]}.webp"
                
        # Generate variants
        techs = technologies_for(sr, title)
        mats = materials_for(sr, title, module_size)
        
        for tech, tech_adj in techs:
            for mat, mat_adj in mats:
                adj = tech_adj + mat_adj
                variant_suffix = f"{slug(tech).upper()}-{slug(mat).upper()}"
                
                # compute final prices
                final_cost = round(max(0, cost + adj), 2)
                # selling price: 2.5x markup on distributor price + adjustment (or 1.5x on accessories if specified)
                if sr >= 208:
                    final_sell = round(max(0, (distributor_price + adj) * 1.5), 2)
                else:
                    final_sell = round(max(0, (distributor_price + adj) * 2.5), 2)
                    
                new_phlipton_records.append({
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

    print(f"Generated {len(new_phlipton_records)} new Phlipton variants.")
    
    # Combine with non_phlipton
    updated_full_catalog = non_phlipton + new_phlipton_records
    print(f"Updated full catalog total: {len(updated_full_catalog)} records.")
    
    with open(CATALOG_JSON, 'w', encoding='utf-8') as f:
        json.dump(updated_full_catalog, f, indent=2, ensure_ascii=False)
    print("Saved tmp/import/full-catalog.json successfully.")

if __name__ == '__main__':
    run_update()
