#!/usr/bin/env python3
"""Riftbound Core Rules lookup. Usage:
  python3 rule.py 811            -> rule 811 and all its subrules (full text + examples)
  python3 rule.py 359.3.e.8      -> that subrule subtree
  python3 rule.py -s "mistarget" -> search rule text/examples (case-insensitive), prints matching rule ids + text
  python3 rule.py -h3            -> list all 3-digit rule headings
"""
import json,sys,re
R=json.load(open('data/rules.json'))
a=sys.argv[1:]
if not a: print(__doc__); sys.exit()
if a[0]=='-h3':
    for r in R:
        if re.fullmatch(r'\d{3}',r['id']): print(r['id'],r['t'][:90])
elif a[0]=='-s':
    q=' '.join(a[1:]).lower(); n=0
    for r in R:
        if q in r['t'].lower() or any(q in e.lower() for e in r.get('ex',[])):
            print(r['id'],r['t'][:300]); n+=1
            for e in r.get('ex',[]):
                if q in e.lower(): print('    EX:',e[:500])
            if n>=40: print('... (more)'); break
else:
    for p in a:
        for r in R:
            if r['id']==p or r['id'].startswith(p+'.'):
                print(r['id'],r['t'])
                for e in r.get('ex',[]): print('    EX:',e)
