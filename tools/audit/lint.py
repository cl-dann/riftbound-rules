import json,re
c=json.load(open('/home/claude/riftbound-rules/web/src/generated/cards.json'))
R={x[0] for x in json.load(open('/home/claude/riftbound-rules/web/src/generated/rules.json'))}
iss=[]
for x in c:
    s=x.get('sh') or ''
    if re.search('[\u2013\u2014]',s): iss.append((x['n'],'dash short'))
    if re.search(r'\[[ACTS]\]|\[\d\]',s): iss.append((x['n'],'raw symbol short'))
    if not 60<=len(s)<=420: iss.append((x['n'],'short len %d'%len(s)))
    if re.search(r'saját kör(öd)?ben|Main Phase',s) and 'showdown' not in s.lower() and re.search(r'kijátsz|aktivál|elrejt|Equip',s): iss.append((x['n'],'timing w/o showdown?'))
    for r,f,t in x.get('nt') or []:
        if re.search('[\u2013\u2014]',t): iss.append((x['n'],'dash note'))
        for p in re.split(r'[,\s]+',str(r)):
            if p and p not in R: iss.append((x['n'],'bad ref '+p))
        if re.search(r'Open State',t) and not re.search(r'Neutral|showdown',t,re.I) and re.search(r'Main Phase|Hide|elrejt|Equip|aktiv',t): iss.append((x['n'],'note timing'))
print(len(iss));[print(i) for i in iss[:40]]
