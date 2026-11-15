import json,os
b=json.load(open('/home/claude/build/learn/beginner.json'))
a=json.load(open('/home/claude/build/learn/advanced.json')) if os.path.exists('/home/claude/build/learn/advanced.json') else {'chapters':[],'scenarios':[]}
ch=b['chapters']
# a pálya felépítése: interaktív playmat a "játék részei" fejezetbe, az első cards blokk elé
c2=ch[1]
pm={'type':'playmat','caption':'Kattints a zónákra: mindegyiknél megjelenik, mire való, a szabályszámmal együtt. A te oldalad lent, az ellenfélé fent, középen a battlefieldek.'}
if not any(x.get('type')=='playmat' for x in c2['blocks']):
    c2['blocks'].insert(min(2,len(c2['blocks'])),{'type':'p','text':'Így néz ki a pálya. Minden játékosnak saját base-e, Legend Zone-ja, Champion Zone-ja, Main Deckje, Rune Deckje, Trash-e és Banishmentje van, a battlefieldek pedig középen, közösen állnak {{106,107,108}}.'})
    c2['blocks'].insert(min(3,len(c2['blocks'])),pm)
out={'chapters':ch+a.get('chapters',[]),'scenarios':a.get('scenarios',[])}
json.dump(out,open('/home/claude/riftbound-rules/src/data/learn.json','w'),ensure_ascii=False,indent=1)
print(len(out['chapters']),len(out['scenarios']),[c['id'] for c in ch][:3])
