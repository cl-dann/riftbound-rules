"""Árletöltő (tools/prices/fetch.py) egy kicsi, mentett Cardmarket mintán (src/tests/fixtures/cardmarket).

A minta a Cardmarket product catalog és price guide letöltés formátumát követi (products, priceGuides, createdAt).
Az idProduct és az ár értékek a commitolt web/public/prices.json-ból valók (2026-11-22), az idExpansion
mintaérték. A kártyaadat 7 valós lap: a generált cards.json-ban nincs 'pr', a nyomatok a cards-detail.json-ban
vannak (PR #10), ezért a párosítás csak akkor ad nyomatot, ha a szkript a detail fájlt olvassa.
"""
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'prices'))
import fetch as F  # noqa: E402

FIX = os.path.join(os.path.dirname(__file__), 'fixtures', 'cardmarket')


def load(name):
    with open(os.path.join(FIX, name), encoding='utf-8') as f:
        return json.load(f)


def setup(tmp_path, monkeypatch, detail=True):
    gen = tmp_path / 'src' / 'generated'
    gen.mkdir(parents=True)
    (tmp_path / 'public').mkdir()
    shutil.copy(os.path.join(FIX, 'cards.json'), gen / 'cards.json')
    if detail:
        shutil.copy(os.path.join(FIX, 'cards-detail.json'), gen / 'cards-detail.json')
    monkeypatch.setattr(F, 'RAW', os.path.join(FIX, 'raw_cards.json'))
    monkeypatch.setattr(F, 'OUT', str(tmp_path / 'public' / 'prices.json'))


def byid():
    return {x['idProduct']: x for x in load('price_guide_22.json')['priceGuides']}


def test_mintaadat_valos_lapok():
    names = {c['n'] for c in load('cards.json')}
    assert 'Darius, Trifarian' in names and 'Akali, Rogue Assassin' in names
    assert all('pr' not in c for c in load('cards.json'))
    assert all(d['pr'] for d in load('cards-detail.json'))


def test_nyomatok_a_detail_fajlbol(tmp_path, monkeypatch):
    setup(tmp_path, monkeypatch)
    pr, ex, emap = F.printings(load('products_singles_22.json'), byid())
    # kiadás -> szett szavazással (legalább 3 egyszettes lap, 80%)
    assert emap == {'5900': 'ogn', '6301': 'ven'}
    # szetten belül gyűjtői szám szerint (alap, betűs alt art, csillagos), a Cardmarket idProduct szerint
    assert pr['ogn-027-298']['id'] == 847142 and pr['ogn-027a-298']['id'] == 847143
    assert [pr[c]['id'] for c in ('ogn-251-298', 'ogn-301-298', 'ogn-301-star-298')] == [847451, 847503, 847504]
    # legend: a nyers név champion nélküli ("Rogue Assassin"), a párosítás a megjelenített teljes névvel megy
    assert [pr[c]['id'] for c in ('ven-139-166', 'ven-189-166', 'ven-189-star-166')] == [898093, 898141, 898161]
    assert pr['ven-189-star-166'] == {'a1': 2299, 'a7': 459.86, 'f1': 1350, 'f7': 2093.22, 'id': 898161}
    assert len(pr) == 12
    # a többlet termék (a mi adatunkban nincs ilyen nyomat) az 'ex' alá kerül, a szettjével
    assert ex == {'jinx loose cannon': [{'a1': None, 'a7': None, 'f1': 1500, 'f7': 1054.75, 'id': 871239, 's': 'ogn'}]}


def test_detail_nelkul_nincs_nyomat(tmp_path, monkeypatch):
    setup(tmp_path, monkeypatch, detail=False)
    pr, ex, _ = F.printings(load('products_singles_22.json'), byid())
    assert pr == {} and ex == {}


def test_main_teljes_futas(tmp_path, monkeypatch):
    setup(tmp_path, monkeypatch)
    prods, pg = load('products_singles_22.json'), load('price_guide_22.json')

    def get(url):
        if url.endswith('/productList/products_singles_22.json'):
            return prods
        if url.endswith('/priceGuide/price_guide_22.json'):
            return pg
        raise OSError('nincs ilyen minta: ' + url)

    hist = {}
    monkeypatch.setattr(F, 'get', get)
    monkeypatch.setattr(F.history, 'update', lambda doc: hist.setdefault('doc', doc) and {'d': [1], 's': {}})
    monkeypatch.setenv('CM_GAME', '22')
    assert F.main() == 0
    doc = json.load(open(F.OUT))
    assert doc['game'] == 22 and doc['updated'] == '2026-11-22T02:44:20+0100'
    # névenként a legolcsóbb nyomat (7 napos átlag), ár nélküli és ismeretlen termék nélkül
    assert doc['cards']['darius trifarian'] == {'a1': 0.89, 'a7': 1.5, 'id': 847142}
    assert doc['cards']['akali rogue assassin']['id'] == 898093
    assert 'fury rune' not in doc['cards']
    assert len(doc['pr']) == 12
    assert hist['doc']['pr'] == doc['pr']
