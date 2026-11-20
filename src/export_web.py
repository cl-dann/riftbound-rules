"""Az adatokat a web/ (Vite + React) app számára exportálja: web/src/generated/*.json"""
import json,os,base64
D=json.load(open('data.json',encoding='utf-8'))
out=os.path.join('..','web','src','generated');os.makedirs(out,exist_ok=True)
def w(name,obj):
    p=os.path.join(out,name);json.dump(obj,open(p,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'));print(name,os.path.getsize(p))
# A kártyák két részben: a kereséshez és a rácshoz kellő index (cards.json), és a részletek (jegyzetek, Gyakori kérdések,
# Röviden, nyomatok), amelyeket a frontend lustán, az első kártyalap vagy nézet előtt tölt be (cards-detail.json, azonos sorrendben).
DETAIL=('nt','qa','sh','pr')
# Az indexben a részletek helyén null áll: így a kártyaobjektum mezősorrendje a betöltés előtt és után is ugyanaz.
w('cards.json',[{k:(None if k in DETAIL else v) for k,v in c.items()} for c in D['cards']])
w('cards-detail.json',[{k:c[k] for k in DETAIL if k in c} for c in D['cards']])
w('rules.json',D['rules'])
w('meta.json',{k:D[k] for k in ('meta','topics','general','extra')})
w('fonts.json',{k:base64.b64encode(open('font_%s.ttf'%k,'rb').read()).decode() for k in 'nbi'})
# Tanulás modul: fejezetek, kvízek, szituációk (src/data/learn.json)
L=json.load(open('data/learn.json',encoding='utf-8')) if os.path.exists('data/learn.json') else {'chapters':[],'scenarios':[]}
w('learn.json',L)
# Versenyformátumok (Szabályzat fül)
w('formats.json',json.load(open('data/formats.json',encoding='utf-8')) if os.path.exists('data/formats.json') else {'intro':'','formats':[]})
