import json,sys,re
# Kompakt köteg: csak a megadott lapok, és a notes által hivatkozott szabályok szövege és példái
K=int(sys.argv[1]); names=json.load(open(sys.argv[2])); n=int(sys.argv[3])
c={x['n']:x for x in json.load(open('/home/claude/riftbound-rules/web/src/generated/cards.json'))}
R={x[0]:x for x in json.load(open('/home/claude/riftbound-rules/web/src/generated/rules.json'))}
G=json.load(open('/home/claude/riftbound-rules/src/data/glossary.json'))
kwrule={g['kw']:g['rule'] for g in G}
L=lambda v: v if isinstance(v,list) else ([] if v in (None,'') else v)
out=[]
for nm in names:
    x=c[nm]; refs=set()
    for r,f,t in x.get('nt') or []:
        for p in re.split(r'[,\s]+',str(r)):
            if p in R: refs.add(p)
    for kw,r in kwrule.items():
        if re.search(r'\['+re.escape(kw)+r'\b',x.get('txt') or '') and r in R: refs.add(r)
    out.append({'name':nm,'type':x['t'],'supertypes':L(x.get('st')),'domain':L(x.get('d')),'tags':L(x.get('tg')),'energy':x.get('e'),'power':x.get('p'),'might':x.get('m'),'text':x.get('txt'),'equip_effect_text':x.get('eff'),'old_text_before_errata':x.get('old'),'short':x.get('sh'),'notes':x.get('nt'),
      'rules':{k:{'t':R[k][1],'ex':R[k][2]} for k in sorted(refs)}})
k=-(-len(out)//n)
for i in range(n): json.dump(out[i*k:(i+1)*k],open(f'r{K}_{i+1:02d}_cards.json','w'),ensure_ascii=False,indent=1)
print(k,len(out),[len(json.dumps(out[i*k:(i+1)*k]))//1000 for i in range(n)])
