"""Cardmarket árak a deck építőhöz.

A Cardmarket publikus product catalog és price guide letöltéseit használja
(downloads.s3.cardmarket.com). A Riftbound idGame értékét a singles katalógusból
ismeri fel ismert lapnevek alapján, mert hivatalosan nincs publikálva.
Kimenet: web/public/prices.json, névenként a legolcsóbb nyomat 1 és 7 napos átlagára EUR-ban.
Hiba esetén nem ír fájlt, az oldal ilyenkor "ár nem elérhető" állapotot mutat.
"""
import json, re, sys, urllib.request, datetime, os

BASE = 'https://downloads.s3.cardmarket.com/productCatalog'
PROBE = ['annie stubborn', 'jinx loose cannon', 'darius trifarian', 'kaisa survivor']
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'web', 'public', 'prices.json')

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'riftbound-rules price sync'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def pn(s):
    s = re.sub(r'\([^)]*\)', ' ', s.lower())
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def find_game():
    forced = os.environ.get('CM_GAME')
    rng = [int(forced)] if forced else range(1, 40)
    for g in rng:
        try:
            p = get(f'{BASE}/productList/products_singles_{g}.json')
        except Exception:
            continue
        names = {pn(x.get('name', '')) for x in p.get('products', [])}
        hits = sum(any(n.startswith(k) for n in names) for k in PROBE)
        print('idGame', g, 'products', len(names), 'probe hits', hits)
        if hits >= 2:
            return g, p
    return None, None

def main():
    g, prods = find_game()
    if not g:
        print('Riftbound idGame nem található, prices.json nem készül'); return 0
    pg = get(f'{BASE}/priceGuide/price_guide_{g}.json')
    byid = {x['idProduct']: x for x in pg.get('priceGuides', [])}
    out = {}
    for p in prods['products']:
        k = pn(p.get('name', ''))
        r = byid.get(p['idProduct'])
        if not k or not r:
            continue
        a1, a7 = r.get('avg1'), r.get('avg7')
        if not a7 and not a1:
            continue
        cur = out.get(k)
        key = a7 or a1
        if cur is None or key < (cur['a7'] or cur['a1']):
            out[k] = {'a1': a1, 'a7': a7, 'id': p['idProduct']}
    doc = {'updated': pg.get('createdAt') or datetime.datetime.utcnow().isoformat() + 'Z', 'game': g, 'cards': out}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(doc, open(OUT, 'w'), separators=(',', ':'))
    print('prices', len(out))
    try:
        cj = json.load(open(os.path.join(os.path.dirname(OUT), '..', 'src', 'generated', 'cards.json')))
        cj = cj if isinstance(cj, list) else cj['cards']
        ours = {c['n'] for c in cj if c.get('t') not in ('Token',)}
        miss = sorted(n for n in ours if pn(n) not in out)
        print('matched', len(ours) - len(miss), 'of', len(ours))
        print('MISSING', ' | '.join(miss))
        po = {pn(n) for n in ours}
        print('CMONLY', ' | '.join(sorted(k for k in out if k not in po)))
    except Exception as e:
        print('match check skipped', e)
    return 0

if __name__ == '__main__':
    sys.exit(main())
