"""A Python adat pipeline ellenőrzése: determinisztikus kimenet, lapszám, kötelező kulcsok.

Futtatás a repó gyökeréből: python3 -m pytest src/tests
A web/src/generated/*.json fájlokat újraírja (azonos tartalommal, ha a pipeline determinisztikus).
"""
import hashlib
import json
import os
import subprocess
import sys

import pytest

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(SRC, '..', 'web', 'src', 'generated')
FILES = ['cards.json', 'rules.json', 'meta.json', 'learn.json', 'formats.json', 'fonts.json']
CARD_KEYS = ['n', 'a', 't', 'st', 'd', 'tg', 'e', 'p', 'm', 'sets', 'code', 'rar', 'txt', 'old', 'err', 'img', 'pr', 'fk', 'ch', 'banf', 'ban', 'tp', 'ex', 'sh', 'nt', 'qa']


def run(script):
    subprocess.run([sys.executable, script], cwd=SRC, check=True, stdout=subprocess.DEVNULL)


def digest(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def pipeline():
    run('build_data.py')
    data = digest(os.path.join(SRC, 'data.json'))
    run('export_web.py')
    return data, {f: digest(os.path.join(GEN, f)) for f in FILES}


@pytest.fixture(scope='module')
def runs():
    had = os.path.exists(os.path.join(SRC, 'data.json'))
    try:
        yield pipeline(), pipeline()
    finally:
        if not had and os.path.exists(os.path.join(SRC, 'data.json')):
            os.remove(os.path.join(SRC, 'data.json'))


def load(name):
    with open(os.path.join(GEN, name), encoding='utf-8') as f:
        return json.load(f)


def test_deterministic(runs):
    (d1, g1), (d2, g2) = runs
    assert d1 == d2, 'data.json eltér két futás között'
    assert g1 == g2, 'a generált JSON eltér két futás között'


def test_cards(runs):
    cards = load('cards.json')
    assert len(cards) == 1101
    for c in cards:
        missing = [k for k in CARD_KEYS if k not in c]
        assert not missing, (c.get('n'), missing)
    assert len({(c['n'], c['code']) for c in cards}) == len(cards)


def test_other_outputs(runs):
    rules = load('rules.json')
    assert isinstance(rules, list) and len(rules) > 2000
    assert all(isinstance(r, list) and len(r) == 3 for r in rules)
    assert set(load('meta.json')) >= {'meta', 'topics', 'general', 'extra'}
    assert set(load('learn.json')) >= {'chapters', 'scenarios'}
    assert set(load('formats.json')) >= {'intro', 'formats'}
    assert set(load('fonts.json')) == {'n', 'b', 'i'}
