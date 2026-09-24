import json
import re
import sys

def parse():
    lines = open('tmp/updated_phlipton_parsed.txt', encoding='utf-8').read().splitlines()
    parsed_items = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        m = re.match(r'^(\d+)\s+(.+)$', line)
        if not m:
            continue
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
            
        parsed_items.append({'sr': sr, 'text': product_and_model, 'prices': prices})

    print(f"Total parsed: {len(parsed_items)}")
    special = [x for x in parsed_items if len(x['prices']) < 2]
    print(f"Special / <2 prices: {len(special)}")
    for x in special:
        print(f"Sr {x['sr']}: {x['text']} | Prices: {x['prices']}")

if __name__ == '__main__':
    parse()
