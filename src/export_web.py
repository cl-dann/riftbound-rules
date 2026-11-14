"""Az adatokat a web/ (Vite + React) app számára exportálja: web/src/generated/*.json"""
import json,os,base64
D=json.load(open('data.json',encoding='utf-8'))
out=os.path.join('..','web','src','generated');os.makedirs(out,exist_ok=True)
def w(name,obj):
    p=os.path.join(out,name);json.dump(obj,open(p,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'));print(name,os.path.getsize(p))
w('cards.json',D['cards'])
w('rules.json',D['rules'])
w('meta.json',{k:D[k] for k in ('meta','topics','general','extra')})
w('fonts.json',{k:base64.b64encode(open('font_%s.ttf'%k,'rb').read()).decode() for k in 'nbi'})
