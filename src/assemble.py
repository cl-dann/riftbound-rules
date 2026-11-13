import json
import base64
D=json.load(open('data.json',encoding='utf-8'))
D['fonts']={k:base64.b64encode(open('font_%s.ttf'%k,'rb').read()).decode() for k in 'nbi'}
d=json.dumps(D,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
t=open('template.html',encoding='utf-8').read()
assert '/*DATA*/' in t
open('../index.html','w',encoding='utf-8').write(t.replace('/*DATA*/',d))
import os;print(os.path.getsize('../index.html'))
