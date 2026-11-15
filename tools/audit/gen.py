import json,sys
K=int(sys.argv[1]); off=int(sys.argv[2])
c=json.load(open('/home/claude/riftbound-rules/web/src/generated/cards.json'))
c=sorted(c,key=lambda x:x['n']); c=c[off:]+c[:off]
L=lambda v: v if isinstance(v,list) else ([] if v in (None,'') else v)
out=[{'name':x['n'],'type':x['t'],'supertypes':L(x.get('st')),'domain':L(x.get('d')),'tags':L(x.get('tg')),'energy':x.get('e'),'power':x.get('p'),'might':x.get('m'),'text':x.get('txt'),'equip_effect_text':x.get('eff'),'old_text_before_errata':x.get('old'),'short':x.get('sh'),'notes':x.get('nt')} for x in c]
n=12;k=-(-len(out)//n)
for i in range(n): json.dump(out[i*k:(i+1)*k],open(f'r{K}_{i+1:02d}_cards.json','w'),ensure_ascii=False,indent=1)
print(k,len(out))
