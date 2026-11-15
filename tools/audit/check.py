import json,sys,re
O=json.load(open(sys.argv[1]));C={c['name']:c for c in json.load(open(sys.argv[2]))};err=[]
if not isinstance(O.get('checked'),int): err.append('checked missing')
R={x['id'] for x in json.load(open('/home/claude/riftbound-rules/src/data/rules.json'))}
for n,v in (O.get('fixes') or {}).items():
    if n not in C: err.append('UNKNOWN: '+n);continue
    if not v.get('why'): err.append(n+': why missing')
    s=v.get('short')
    if s is not None:
        if not isinstance(s,str) or not 60<=len(s)<=420: err.append(n+': short length')
        if re.search('[–—]',s): err.append(n+': dash in short')
    nt=v.get('notes')
    if nt is not None:
        if not isinstance(nt,list) or not nt: err.append(n+': notes empty');continue
        for p in nt:
            if not (isinstance(p,list) and len(p)==3 and p[1] in (0,1,2) and isinstance(p[2],str)): err.append(n+': bad note '+str(p)[:80]);continue
            if re.search('[–—]',p[2]): err.append(n+': dash in note')
            for r in str(p[0]).split(','):
                r=r.strip()
                if r and r not in R: err.append(n+': unknown rule '+r)
    if s is None and nt is None: err.append(n+': nothing to fix')
print('\n'.join(err[:50]) if err else 'OK: %d fixes, checked %s'%(len(O.get('fixes') or {}),O.get('checked')));sys.exit(1 if err else 0)
