"""Cardmarket ártörténet: a prices.json nyomatonkénti árai dátummal, egy külön, lustán betöltött fájlban.

Formátum (web/public/price-history.json):
  {"v": 1, "d": ["2026-11-19", ...], "s": {"ogn-001-298": {"n": [...], "f": [...]}}}
- d: a frissítések dátuma (nap), növekvő sorrendben;
- s: nyomatonként a normál (n) és a foil (f) 7 napos átlag (ha nincs, az 1 napos) euró centben, delta kódolva:
  az első szám az érték, a többi az előző ismert értékhez képesti változás; null, ha aznap nincs ár.
Ugyanazon a napon ismételt futás az utolsó oszlopot felülírja. Automatikus ütemezés nincs (prices.yml, kézi futás).
"""
import json
import os

PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'web', 'public', 'price-history.json')


def cents(a, b):
    v = a if a is not None else b
    return None if v is None else int(round(v * 100))


def decode(xs):
    out, acc = [], 0
    for x in xs:
        if x is None:
            out.append(None)
        else:
            acc += x
            out.append(acc)
    return out


def encode(vals):
    out, last = [], 0
    for v in vals:
        if v is None:
            out.append(None)
        else:
            out.append(v - last)
            last = v
    return out


def append(hist, day, pr):
    """A nap árainak hozzáfűzése (vagy az utolsó oszlop felülírása, ha ugyanaz a nap)."""
    hist = hist or {'v': 1, 'd': [], 's': {}}
    dates = hist['d']
    series = {k: {t: decode(v[t]) for t in ('n', 'f')} for k, v in hist['s'].items()}
    if dates and dates[-1] == day:
        dates.pop()
        for v in series.values():
            for t in ('n', 'f'):
                v[t].pop()
    if dates and day < dates[-1]:
        raise ValueError('a dátum korábbi, mint az utolsó: ' + day)
    n = len(dates)
    dates.append(day)
    for code, r in pr.items():
        series.setdefault(code, {'n': [None] * n, 'f': [None] * n})
    for code, v in series.items():
        r = pr.get(code) or {}
        v['n'].append(cents(r.get('a7'), r.get('a1')))
        v['f'].append(cents(r.get('f7'), r.get('f1')))
    hist['s'] = {k: {t: encode(v[t]) for t in ('n', 'f')} for k, v in sorted(series.items())}
    return hist


def update(doc, path=PATH):
    """A prices.json tartalmának (doc) hozzáfűzése a történethez; a fájl tömör JSON."""
    hist = json.load(open(path)) if os.path.exists(path) else None
    day = str(doc['updated'])[:10]
    hist = append(hist, day, doc.get('pr') or {})
    json.dump(hist, open(path, 'w'), separators=(',', ':'))
    return hist
