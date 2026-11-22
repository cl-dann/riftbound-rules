"""Cardmarket árak a deck építőhöz.

A Cardmarket publikus product catalog és price guide letöltéseit használja
(downloads.s3.cardmarket.com). A Riftbound idGame értékét a singles katalógusból
ismeri fel ismert lapnevek alapján, mert hivatalosan nincs publikálva.
Kimenet: web/public/prices.json, névenként a legolcsóbb nyomat 1 és 7 napos átlagára EUR-ban.
Hiba esetén nem ír fájlt, az oldal ilyenkor "ár nem elérhető" állapotot mutat.
"""
import json, re, sys, urllib.request, datetime, os
sys.path.insert(0, os.path.dirname(__file__))
import history  # noqa: E402

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

RAW = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'cards.json')


def prow(r, pid):
    """Egy Cardmarket termék árai: normál és foil, 1 és 7 napos átlag."""
    return {'a1': r.get('avg1'), 'a7': r.get('avg7'), 'f1': r.get('avg1-foil'), 'f7': r.get('avg7-foil'), 'id': pid}


def numkey(code):
    """Nyomatok sorrendje egy szetten belül: alapszám, majd betűs (alt art), majd egyéb (overnumber, signature)."""
    m = re.match(r'^[a-z]+-(?:([a-z]+)(\d+)|(\d+))([a-z]*)(.*)$', code)
    if not m:
        return (9, code)
    pre = m.group(1) or ''
    num = int(m.group(2) or m.group(3))
    return (1 if pre else 0, num, len(m.group(4)) + (2 if m.group(5).count('-') > 1 else 0), code)


def audit(ours, byname, main, emap, pr, byid):
    """Diagnosztika: párosítatlan szettek és gyanús párosítások listája a naplóba."""
    inv = {}
    for e, s in emap.items():
        inv.setdefault(s, []).append(e)
    for k, plist in sorted(byname.items()):
        for s, e in main.items():
            mine = sorted([c for c in ours[k] if c['setCode'] == s], key=lambda c: numkey(c['cardCode']))
            if not mine:
                continue
            theirs = sorted([p for p in plist if p['idExpansion'] == e], key=lambda p: p['idProduct'])
            other = [p for p in plist if p['idExpansion'] in inv.get(s, []) and p['idExpansion'] != e]
            def pp(p):
                r = byid.get(p['idProduct']) or {}
                return f"{p['idProduct']}:e{p['idExpansion']}:n{r.get('avg7')}:f{r.get('avg7-foil')}"
            if k.startswith(('jayce defender', 'k sante dauntless')):
                print('AUD-DETAIL', k, s, [c['cardCode'] + '/' + c['rarity'] for c in mine], [pp(p) for p in theirs])
            if len(mine) > len(theirs):
                def pp(p):
                    r = byid.get(p['idProduct']) or {}
                    return f"{p['idProduct']}:e{p['idExpansion']}:n{r.get('avg7')}:f{r.get('avg7-foil')}"
                print('AUD-MISMATCH', k, s, [c['cardCode'] + '/' + c['rarity'] for c in mine], [pp(p) for p in theirs], 'other', [pp(p) for p in other])
            else:
                vals = [(c, pr.get(c['cardCode'])) for c in mine]
                base = [v for c, v in vals if v and c['rarity'] != 'Showcase']
                for c, v in vals:
                    if c['rarity'] == 'Showcase' and v and base:
                        b = base[0]
                        bn = b['a7'] or b['f7'] or 0
                        vn = v['a7'] or v['f7'] or 0
                        if vn and bn and vn < bn:
                            print('AUD-SUSPECT', k, c['cardCode'], 'showcase olcsobb mint alap', vn, bn)


def printings(prods, byid):
    """A Cardmarket termékek párosítása a saját nyomatainkkal.

    A Cardmarket adatban a nyomat típusa (alap, Showcase, overnumber) nem szerepel, csak a
    kiadás azonosítója. Ezért: 1) a Cardmarket kiadásokat szavazással a szettjeinkhez rendeljük
    (azonos nevű lapok alapján); 2) szetten belül a saját nyomatainkat gyűjtői szám szerint, a
    Cardmarket termékeket idProduct szerint rendezzük, és csak akkor párosítunk, ha a darabszám
    egyezik. Ami nem párosítható, az 'ex' alá kerül kiadás szerint, típuscímke nélkül.
    """
    raw = {c['cardCode']: c for c in json.load(open(RAW, encoding='utf-8')) if c.get('cardType') != 'Token'}
    # A legendek nyers neve champion nélküli ("Rogue Assassin"), a Cardmarket viszont a teljes
    # nevet használja ("Akali, Rogue Assassin"). Ezért a generált kártyaadat megjelenített nevével
    # és álneveivel is kulcsolunk; a nyomatok listája ott a 'pr' mezőben van.
    ours = {}
    gen = os.path.join(os.path.dirname(OUT), '..', 'src', 'generated', 'cards.json')
    cj = json.load(open(gen, encoding='utf-8'))
    cj = cj if isinstance(cj, list) else cj['cards']
    # A nyomatok ('pr') a lustán betöltött cards-detail.json-ban vannak, a cards.json-nal azonos sorrendben.
    det = os.path.join(os.path.dirname(gen), 'cards-detail.json')
    if os.path.exists(det):
        for card, d in zip(cj, json.load(open(det, encoding='utf-8'))):
            if not card.get('pr') and d.get('pr'):
                card['pr'] = d['pr']
    for card in cj:
        prs = [raw[x[0]] for x in (card.get('pr') or []) if x[0] in raw]
        if not prs:
            continue
        for key in {pn(card['n'])} | {pn(a) for a in card.get('a', []) if ',' in a}:
            if key and key not in ours:
                ours[key] = prs
    votes = {}
    for p in prods['products']:
        cs = ours.get(pn(p.get('name', '')))
        if not cs:
            continue
        sets = {c['setCode'] for c in cs}
        if len(sets) == 1:
            v = votes.setdefault(p['idExpansion'], {})
            s = next(iter(sets))
            v[s] = v.get(s, 0) + 1
    emap = {}
    for e, v in votes.items():
        s, n = max(v.items(), key=lambda x: x[1])
        if n >= 3 and n >= 0.8 * sum(v.values()):
            emap[e] = s
    # szettenként a fő kiadás: amelyikben a legtöbb termék van
    cnt = {}
    for p in prods['products']:
        cnt[p['idExpansion']] = cnt.get(p['idExpansion'], 0) + 1
    main = {}
    for e, s in emap.items():
        if s not in main or cnt[e] > cnt[main[s]]:
            main[s] = e
    pr, ex = {}, {}
    byname = {}
    for p in prods['products']:
        k = pn(p.get('name', ''))
        if k in ours:
            byname.setdefault(k, []).append(p)
    for k, plist in byname.items():
        used = set()
        for s, e in main.items():
            mine = sorted([c for c in ours[k] if c['setCode'] == s], key=lambda c: numkey(c['cardCode']))
            theirs = sorted([p for p in plist if p['idExpansion'] == e], key=lambda p: p['idProduct'])
            # Ha a Cardmarketen több termék van (pl. a mi adatunkból hiányzó csillagos vagy
            # később felvett változat), az első N termék a mi N nyomatunk, a többlet az 'ex' alá kerül.
            if mine and len(theirs) >= len(mine):
                for c, p in zip(mine, theirs):
                    r = byid.get(p['idProduct'])
                    if r:
                        pr[c['cardCode']] = prow(r, p['idProduct'])
                    used.add(p['idProduct'])
        for p in plist:
            if p['idProduct'] in used:
                continue
            r = byid.get(p['idProduct'])
            if not r or not any(r.get(x) for x in ('avg1', 'avg7', 'avg1-foil', 'avg7-foil')):
                continue
            row = prow(r, p['idProduct'])
            row['s'] = emap.get(p['idExpansion'])
            ex.setdefault(k, []).append(row)
    if os.environ.get('CM_DEBUG'):
        audit(ours, byname, main, emap, pr, byid)
    return pr, ex, {str(e): s for e, s in emap.items()}


def main():
    g, prods = find_game()
    if not g:
        print('Riftbound idGame nem található, prices.json nem készül'); return 0
    pg = get(f'{BASE}/priceGuide/price_guide_{g}.json')
    if os.environ.get('CM_DEBUG'):
        print('PRODKEYS', sorted(prods['products'][0].keys()), 'TOP', sorted(k for k in prods if k != 'products'))
        print('PGKEYS', sorted(pg['priceGuides'][0].keys()))
        bid = {x['idProduct']: x for x in pg.get('priceGuides', [])}
        for p in prods['products']:
            if pn(p.get('name', '')).startswith(('fury rune', 'annie stubborn', 'jinx loose cannon', 'ahri inquisitive', 'bullet time')):
                print('DBG', json.dumps(p, ensure_ascii=False), json.dumps(bid.get(p['idProduct']), ensure_ascii=False))
        exps = {}
        for p in prods['products']:
            exps[p.get('idExpansion')] = exps.get(p.get('idExpansion'), 0) + 1
        print('EXPANSIONS', exps)
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
    pr, ex, emap = printings(prods, byid)
    doc = {'updated': pg.get('createdAt') or datetime.datetime.utcnow().isoformat() + 'Z', 'game': g, 'cards': out, 'pr': pr, 'ex': ex}
    print('printings', len(pr), 'extra names', len(ex), 'expansion map', emap)
    for code in ('ogn-119-298', 'ven-139-166', 'ven-189-166', 'ven-189-star-166'):
        print('PR', code, pr.get(code))
    print('EX ahri', ex.get('ahri inquisitive'))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(doc, open(OUT, 'w'), separators=(',', ':'))
    hist = history.update(doc)
    print('history', len(hist['d']), 'nap,', len(hist['s']), 'nyomat')
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
