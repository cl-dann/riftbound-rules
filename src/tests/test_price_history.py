"""Ártörténet (tools/prices/history.py): delta kódolás oda-vissza, hozzáfűzés, azonos napi felülírás, új nyomat."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'prices'))
import history as H  # noqa: E402


def test_encode_decode():
    vals = [500, None, 480, 480, 1234]
    assert H.decode(H.encode(vals)) == vals
    assert H.encode(vals) == [500, None, -20, 0, 754]


def test_append_and_same_day():
    h = H.append(None, '2026-11-19', {'a': {'a1': 1.0, 'a7': 1.2, 'f1': None, 'f7': None}})
    h = H.append(h, '2026-11-26', {'a': {'a1': 1.1, 'a7': 1.3, 'f1': 2.0, 'f7': None}, 'b': {'a1': 0.5, 'a7': None}})
    assert h['d'] == ['2026-11-19', '2026-11-26']
    assert H.decode(h['s']['a']['n']) == [120, 130]
    assert H.decode(h['s']['a']['f']) == [None, 200]
    assert H.decode(h['s']['b']['n']) == [None, 50]
    h = H.append(h, '2026-11-26', {'a': {'a1': 1.0, 'a7': 1.4}})
    assert h['d'] == ['2026-11-19', '2026-11-26']
    assert H.decode(h['s']['a']['n']) == [120, 140]
    assert H.decode(h['s']['b']['n']) == [None, None]
