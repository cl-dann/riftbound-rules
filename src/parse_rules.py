import re,json,sys
src=open('data/rules.txt',encoding='utf-8').read().replace('\f','\n\n')
lines=src.split('\n')
IDRE=re.compile(r'^\s*(\d{3}(?:\.(?:\d+|[a-z]))*)\.\s+(\S.*)$')
rules=[];cur=None;mode=None;prev_blank=True
def norm(s): return re.sub(r'\s+',' ',s).strip()
for ln in lines:
    if not ln.strip():
        prev_blank=True; continue
    m=IDRE.match(ln)
    s=ln.strip()
    if m and (cur is None or True):
        cur={'id':m.group(1),'t':m.group(2).strip(),'ex':[]}; rules.append(cur); mode='t'
    elif cur is None:
        pass
    elif s.startswith('Example:') or s.startswith('Examples:'):
        cur['ex'].append(s); mode='ex'
    else:
        if mode=='ex': cur['ex'][-1]+=' '+s
        else:
            # new paragraph vs wrapped line
            cur['t']+=(' \n' if prev_blank and re.match(r'^[•*\-\u2013]|^\d+\)',s) else ' ')+s
    prev_blank=False
for r in rules:
    r['t']=re.sub(r'[ \t]+',' ',r['t']).strip(); r['ex']=[norm(e) for e in r['ex']]
    if not r['ex']: del r['ex']
json.dump(rules,open('data/rules.json','w'),ensure_ascii=False)
print(len(rules),sum(len(r['t'])+sum(map(len,r.get('ex',[]))) for r in rules))
