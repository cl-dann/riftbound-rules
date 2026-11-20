#!/usr/bin/env python3
"""Validate a notes batch. Usage: python3 check_notes.py batches/batch_03_notes.json batches/batch_03_cards.json"""
import json,sys
R={r['id'] for r in json.load(open('data/rules.json'))}
N=json.load(open(sys.argv[1])); C=json.load(open(sys.argv[2])) if len(sys.argv)>2 else None
err=[]
for name,notes in N.items():
    if not isinstance(notes,list) or not (2<=len(notes)<=9): err.append(f'{name}: needs 2-9 notes, has {len(notes) if isinstance(notes,list) else "?"}')
    for n in notes:
        if not (isinstance(n,list) and len(n)==3): err.append(f'{name}: bad note shape {n}'); continue
        refs,flag,text=n
        if flag not in (0,1,2): err.append(f'{name}: bad flag {flag}')
        for x in refs.split(','):
            if x.strip() not in R: err.append(f'{name}: rule id does not exist: "{x.strip()}"')
        if '\u2014' in text or '\u2013' in text: err.append(f'{name}: em/en dash in text')
        if len(text)>330: err.append(f'{name}: note too long ({len(text)} chars)')
        if len(text)<25: err.append(f'{name}: note too short')
if C:
    want={c['name'] for c in C}
    for m in sorted(want-set(N)): err.append(f'MISSING card: {m}')
    for m in sorted(set(N)-want): err.append(f'UNKNOWN card name (must match exactly): {m}')
print('\n'.join(err[:80]) if err else 'OK: %d cards, %d notes'%(len(N),sum(len(v) for v in N.values())))
sys.exit(1 if err else 0)
