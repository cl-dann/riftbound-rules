import json,re,collections,sys
sys.path.insert(0,'.')
from notes import NOTES
C=json.load(open('data/cards.json'))
R=json.load(open('data/rules.json'))
def fix(s):
    if s is None: return None
    s=s.replace('▲','').replace('[OLD TEXT]','').replace('[NEW TEXT]','')
    s=s.replace('[M]','[S]').replace('[ADD]','[Add]')
    s=re.sub(r'[ \t]+\n','\n',s); s=re.sub(r'\n{2,}','\n',s)
    return s.strip() or None
ARTICLES=[
 {'k':'origins','t':'Riftbound: Origins Card Errata','u':'https://playriftbound.com/en-us/news/rules-and-releases/riftbound-origins-card-errata/'},
 {'k':'spiritforged','t':'Riftbound Spiritforged Errata','u':'https://playriftbound.com/en-us/news/rules-and-releases/riftbound-spiritforged-errata'},
 {'k':'unleashed','t':'Unleashed Errata Updates','u':'https://playriftbound.com/en-us/news/rules-and-releases/unleashed-errata-updates/'},
 {'k':'vendetta','t':'Vendetta Errata Updates (2026-07-23)','u':'https://playriftbound.com/en-us/news/announcements/vendetta-errata-updates'},
 {'k':'radiance','t':'Radiance Errata Updates (2026-10-09)','u':'https://playriftbound.com/en-us/news/announcements/radiance-errata-updates'}]
ART_OVERRIDE={ # cikk, amelyben az errata tenylegesen megjelent (sajat lekerdezes alapjan)
 'Falling Star':1,'Icathian Rain, Kai\'Sa':1,'Reinforce':1,
 'Guards!':2,'Relentless Pursuit':2,
 'Draven, Vanquisher':3,"Emperor's Dais":3,'Fizz, Trickster':3,'Diana, Lunari':3,'Stalking Wolf':3}
MANUAL={ # hianyzik az adatforrasbol, az Unleashed errata cikkbol
 'Deceiver':(2,"When you conquer or hold, you may discard 1 and exhaust me to play a ready Reflection unit token there. Then do this: It becomes a copy of another unit there. Give it [Temporary]."),
}
BAN=["Called Shot","Ekko, Recurrent","Draven, Vanquisher","Fight or Flight","Scrapheap","Stealthy Pursuer","Stacked Deck","The Arena's Greatest","Aspirant's Climb","The Dreaming Tree","Obelisk of Power","Reaver's Row"]
BAN2=["Wuju Bladesman"]
# Radiance ban list frissites, kozzeteve 2026-11-13, hatalyos 2026-11-23 (Standard es 2v2 Constructed)
BAN_FUT={'from':'2026-11-23','published':'2026-11-13','title':'Radiance Ban List Updates (hatályos 2026-11-23)','url':'https://playriftbound.com/en-us/news/announcements/radiance-ban-list-updates-effective-november-23-2026/',
 'cards':["Riven, Broken Blade","Zhonya's Hourglass","Stellacorn Herder","Nocturne, Horrifying","Rhasa the Sunderer","Brynhir Thundersong","Dazzling Aurora","Baited Hook","Emperor's Dais","Star Spring"]}
champs={x['name'] for x in C if x['cardType']=='Unit' and 'Champion' in x['cardTypeLabels']}
groups=collections.OrderedDict()
for x in C:
    if x['cardType']=='Token': continue
    groups.setdefault((x['fullName'],x['cardType']),[]).append(x)
SETORDER=['Origins','Proving Grounds','Spiritforged','Unleashed','Vendetta','Radiance']
cards=[]
for (fn,ty),vs in groups.items():
    base=sorted(vs,key=lambda v:(v['rarity']=='Showcase',-len(v.get('abilityOriginal') or '')))[0]
    printed=fix(max((v.get('abilityOriginal') or '' for v in vs),key=len))
    er=[v for v in vs if v.get('hasErrata') and v.get('abilityCorrected')]
    txt=printed; err=None
    if er:
        txt=fix(er[0]['abilityCorrected']); k=er[0]['matchedErrataCode'].split('-')[0]
        err=ART_OVERRIDE.get(fn,[a['k'] for a in ARTICLES].index(k))
    if fn in MANUAL: err,txt=MANUAL[fn][0],fix(MANUAL[fn][1])
    labels=[l for l in base['cardTypeLabels'] if l!=ty and not (ty=='Legend' and l=='Champion')]
    tags=sorted({tg for v in vs for tg in (v.get('tags') or [])})
    disp=fn; al=[fn]; chtag=None
    if ty=='Legend':
        ct=[t for t in tags if t in champs]
        nm=base['name']
        if ct: disp=f"{ct[0]}, {nm}"; al+= [disp,nm, f"{ct[0]}, {fn}"]
        chtag=ct[0] if ct else None
        if base.get('subtitle'): disp+=f" ({base['subtitle']})"
    doms=[d for d in (base.get('domains') or []) if d and d!='Colorless']
    cards.append({'n':disp,'a':sorted(set(al)),'t':ty,'st':labels,'d':doms,'tg':tags,
      'e':base.get('energy'),'p':base.get('power'),'m':base.get('might'),
      'sets':sorted({v['cardSet'] for v in vs},key=SETORDER.index),'code':base['cardCode'],'rar':base['rarity'],
      'txt':txt,'old':printed if (err is not None and printed!=txt) else None,'err':err,
      'img':(base.get('imageUrl') or '').rsplit('/',1)[-1],
      'ch':chtag,
      'banf':BAN_FUT['from'] if fn in BAN_FUT['cards'] else None,
      'ban':1 if fn in BAN else (2 if base['name'] in BAN2 and ty=='Legend' else 0),'_fn':fn,'_name':base['name']})
assert all(any(c['_fn']==b for c in cards) for b in BAN), [b for b in BAN if not any(c['_fn']==b for c in cards)]
TXT_OVERRIDE={ # a hivatalos Spiritforged errata cikk alapjan javitva (az adatforras hibasan vette at)
 'Falling Star':("Deal 3 to a unit.\nDeal 3 to a unit.","Do this twice:\nDeal 3 to a unit. (You can choose different units.)"),
 "Icathian Rain, Kai'Sa":("Deal 2 to a unit.\nDeal 2 to a unit.\nDeal 2 to a unit.\nDeal 2 to a unit.\nDeal 2 to a unit.\nDeal 2 to a unit.","Do this 6 times:\nDeal 2 to a unit. (You can choose different units.)"),
}
for c in cards:
    if c['_fn'] in TXT_OVERRIDE: c['txt'],c['old']=TXT_OVERRIDE[c['_fn']]
    if c['txt'] and c['txt'].endswith('instead.disa'): c['txt']=c['txt'][:-4]
EFF=json.load(open('data/fix/effect_text.json',encoding='utf-8'))
FIX=json.load(open('data/fix/fixes.json',encoding='utf-8'))
for c in cards:
    fn=c['_fn']
    if fn in EFF:
        e=EFF[fn]
        if e.get('effect'): c['eff']=e['effect']; c['effsrc']=e.get('source') or ''
        d=e.get('top_text_diff') or ''
        if d.startswith('Equip cost is [A]') and c['txt']: c['txt']=c['txt'].replace('[Equip] [C] ([C]:','[Equip] [A] ([A]:')
        if 'lacks brackets' in d and c['txt'] and '[Equip]' not in c['txt']: c['txt']=c['txt'].replace('Equip [C]','[Equip] [C]',1)
        if fn=="Protector's Shield" and not c['d']: c['d']=['Order']
    if fn in FIX:
        f=FIX[fn]
        if f.get('tags'): c['tg']=f['tags']
        if f.get('domains'): c['d']=f['domains']
        if f.get('old_text') and c.get('err') is not None and not c.get('old'): c['old']=fix(f['old_text'])
        if fn=='Disintegrate' and f.get('text'): c['txt']=fix(f['text'])
        if 'Unit / Gear' in (f.get('type_note') or '') and 'Gear' not in c['st']: c['st']=c['st']+['Gear']
# Radiance: Riot card-gallery feed has wrong or missing domains on 27 main-set cards.
# The printed set is numbered by domain in blocks of 23 (Fury 001-023, Calm 024-046, Mind 047-069,
# Body 070-092, Chaos 093-115, Order 116-138); this matches the image-based corrections
# in github.com/RubenPeeters/ni-han-bao bot/riftbound-corrections.json for all 27 cards.
RAD_BLOCK=['Fury','Calm','Mind','Body','Chaos','Order']
DOMFIX={}
for c in cards:
    m=re.match(r'^rad-(\d{3})-167$',c.get('code') or '')
    if m and 1<=int(m.group(1))<=138:
        want=[RAD_BLOCK[(int(m.group(1))-1)//23]]
        if c['d']!=want: DOMFIX[c['_fn']]=(c['d'],want); c['d']=want
print('radiance domain fixes',len(DOMFIX))
# Tags missing from the feed, proven by an official Core Rules example
EQFIX=[]
for c in cards:
    if c['t']=='Gear' and re.search(r'\[(Equip|Quick-Draw)\]',c['txt'] or '') and 'Equipment' not in c['tg']: c['tg']=sorted(c['tg']+['Equipment']); EQFIX.append(c['_fn'])  # 818.1.a, 819.1.a
print('equipment tag added',EQFIX)
for c in cards:
    if c['_fn']=='Clanging Sentry' and 'Mech' not in c['tg']: c['tg']=sorted(c['tg']+['Mech'])  # 831.2 example: both Sentries get Disarm 2
# ---------- topics
T=[]
def topic(k,title,g,refs,test=None,rel=(),why=None): T.append({'k':k,'title':title,'g':g,'refs':list(refs),'rel':list(rel),'why':why,'_t':test})
def rx(p,fl=re.I): return re.compile(p,fl)
# type
topic('unit','Units','type',['140-146'],lambda c:c['t']=='Unit',rel=['447-455','461-468'],why='Kártyatípus: Unit')
topic('champion','Champion supertype, Chosen Champion','type',['133.7.a','103.3.a','103.3.b'],lambda c:c['t']=='Unit' and 'Champion' in c['st'],why='Supertype: Champion')
topic('signature','Signature supertype','type',['133.7.b','103.3.d'],lambda c:'Signature' in c['st'],why='Supertype: Signature')
topic('gear','Gear','type',['147-149','151-152'],lambda c:c['t']=='Gear',why='Kártyatípus: Gear')
topic('equipment','Equipment, Attachment, Effect Text','type',['150','716-719','136-137','720-725'],lambda c:c['t']=='Gear' and ('Equipment' in c['tg'] or '[Equip' in (c['txt'] or '') or '[Quick-Draw' in (c['txt'] or '')),rel=['435','436'],why='Tag: Equipment')
topic('spell','Spells','type',['153-159'],lambda c:c['t']=='Spell',why='Kártyatípus: Spell')
topic('rune','Runes, Rune Pool','type',['160-168','103.4'],lambda c:c['t']=='Rune',rel=['430','431','315.3'],why='Kártyatípus: Rune')
topic('battlefield','Battlefields, Control, Locations','type',['169-172','189-190','197-200','103.5'],lambda c:c['t']=='Battlefield',rel=['469-474','341-348'],why='Kártyatípus: Battlefield')
topic('legend','Legends, Domain Identity','type',['173-176','103.2'],lambda c:c['t']=='Legend',why='Kártyatípus: Legend')
topic('tokencard','Tokens','type',['179-187'],lambda c:'Token' in c['st'],rel=['440'],why='Ez a kártya token')
# keywords (auto)
KWREL={'Hidden':['422','129.4'],'Reaction':['327-331','311-313'],'Action':['341-348'],'Equip':['435','436','716-719'],'Quick-Draw':['818','716-719'],'Weaponmaster':['818','716-719'],
 'Deathknell':['429','726-727'],'Temporary':['315.2'],'Level':['728-733','726-727'],'Empower':['442','443'],'Empowered':['442','443','726-727'],'Ambush':['813'],'Assault':['461-468'],'Shield':['461-468'],
 'Tank':['467'],'Backline':['467'],'Ganking':['447-455','144'],'Accelerate':['356.2.b','143.4'],'Deflect':['356.2.a','355.7','355.9'],'Legion':['726-727'],'Vision':['431'],'Hunt':['728-733'],'Disarm':['461-468'],'Repeat':['204.2']}
for r in R:
    if re.fullmatch(r'\d{3}',r['id']) and 805<=int(r['id'])<=832:
        kw=r['t'].strip()
        topic('kw:'+kw,kw,'kw',[r['id']],rx(r'\['+re.escape(kw)+r'(?: \d+)?\]',0),rel=KWREL.get(kw,[]),why='kw')
# actions
ACT=[('Draw','414',r'\bdraws?\b|\bdrew\b|\bdrawn\b',[]),('Exhaust','415',r'\bexhaust(s|ed|ing)?\b|\[T\]|\[E\]',[]),('Ready','416',r'\bready\b|\breadies\b|\breadied\b',[]),
 ('Recycle','417',r'\brecycl\w*',[]),('Deal (damage)','418',r'\bdeals?\b|\bdealt\b|\bdamage\b',['143.3']),('Heal','419',r'\bheal\w*',['143.3']),
 ('Play (effect által kijátszott kártya)','420',r'\bplay (?:a|an|it|that|those|them|two|three|four|one|up to|me from|this from|\d)\b[^.\n]{0,40}|ignoring (?:its|their|any and all) (?:Energy )?costs?',['349-359']),
 ('Move','421',r'\bmov(?:e|es|ed|ing)\b',['447-455']),('Hide','422',r'\bhide\b|facedown|face down',['811','129.4']),('Discard','423',r'\bdiscard\w*',[]),
 ('Stun','424',r'\[Stun\]|\bstun\w*',[]),('Reveal','425',r'\breveal\w*',[]),('Counter','426',r"\bcounter(?:ed)?\b",[]),('Buff','427',r'\[Buff\]|\bbuff(?:s|ed)?\b',['701-705']),
 ('Banish','428',r'\bbanish\w*',[]),('Kill','429',r'\bkill(?:s|ed)?\b|\bdies?\b|\bdied\b',[]),('Add (resources)','430',r'\[Add\]',['165-168']),('Channel','431',r'\bchannel\w*',['160-163']),
 ('Burn Out','432',r'\bburn(?:s|ed)? out\b',[]),('Double','433',r'\bdoubles?\b|\bdoubled\b',[]),('Swap','434',r'\bswap\w*',[]),('Attach','435',r'\battach\w*',['716-719']),('Detach','436',r'\bdetach\w*|\bunattach\w*',['716-719']),
 ('Predict','437',r'\[Predict(?: \d+)?\]|\bpredict\w*',[]),('Prevent','438',r'\bprevent\w*',[]),('Replace','439',r'\breplace\w*',[]),('Create (tokens)','440',r'\btokens?\b',['179-187']),
 ('Burn','441',r'\[Burn(?: \d+)?\]',[]),('Empower','442',r'(?<!\[)\bempower\b',['827','828']),('Disempower','443',r'\bdisempower\w*',[]),('Skip','444',r'\bskips?\b',[]),('Pay','445',r'\bpay(?:s|ing)?\b|\bpaid\b|\bspend\w*',['201-206']),('Copy','446',r'\bcop(?:y|ies|ied)\b',['475-482'])]
for t,ref,p,rel in ACT: topic('act:'+t,t,'act',[ref],rx(p),rel=rel,why='txt')
OTH=[('Tokens','179-187',r'\btokens?\b',['440']),('Recalls','456-460',r'\brecall\w*',[]),('Scoring: Conquer','471.1',r'\bconquer\w*',['469-474']),('Scoring: Hold','471.2',r'\bholds?\b|\bheld\b',['469-474','315.2']),
 ('Scoring, Points','469-474',r'\bscor(?:e|es|ed|ing)\b|\bpoints?\b',['193-196']),('Combat','461-468',r'\battack\w*|\bdefend\w*|\bcombat\b',[]),('Showdowns','341-348',r'\bshowdowns?\b',['311-313']),
 ('Mighty','706-711',r'\bMighty\b',[]),('Bonus Damage','712-715',r'Bonus Damage',['418']),('XP','728-733',r'\bXP\b',[]),('Additional Turns','734-738',r'take a turn after|additional turn|extra turn',[]),
 ('Counters','741-749',r'\bcounters\b',[]),('Untargetability','756-758',r"can(?:'|’)t be chosen|cannot be chosen",[]),('Naming Cards, Types, and Tags','759-763',r'\bname a\b|\bnames? an?\b|\bguess\w*',[]),
 ('Ignoring Effects','764-767',r'\bignore\b',[]),('Making New Choices','750-755',r'new choices|choose new',[]),('Winning','193-196',r'wins? the game',[]),
 ('Replacement Effects','367-375',r'\binstead\b|\bwould\b',[]),('Triggered Abilities','382-386',r'\bwhen(?:ever)?\b|\bat the (?:start|end|beginning)\b|\bthe (?:first|second|third|next) time\b',['399-407']),
 ('Reflexive Triggers','387-389',r'if you do,|then do this|when you do\b',[]),('Activated Abilities','376-381',r'(?:\[[^\]]+\]|\d|\bme|\bthis|\b[a-z]+)\s*:\s(?=\S)',['399-407']),
 ('Delayed Abilities','390-393',r'\bthe next time\b|\bthe next (?:unit|card|spell|gear)\b|\buntil\b',[]),('Beginning Phase','315.2',r'Beginning Phase',[]),('Ending Phase','317',r'Ending Phase|end of (?:your|the|each|this) turn',[]),
 ('Additional Costs','204.2',r'additional cost',['201-206']),('Cost módosítás (Determine Total Cost)','356',r'costs? (?:\[[^\]]+\])+ (?:less|more)|costs? \d+ (?:less|more)|cost (?:is )?(?:reduced|increased)|ignoring (?:its|their|any and all) (?:Energy |Power )?costs?|play (?:me|it|this|that card) for \[',['201-206']),('Applied Costs (must pay)','204.4',r'must pay (?:\[|an additional)',['201-206']),
 ('Chosen Champion','103.3.a',r'Chosen Champion|Champion Zone',[]),('Deckbuilding choices','103.1',r'in your deck|starting legend',['101-103']),
 ('Runes','160-163',r'\brunes?\b',['165-168']),('Might','143.2',r'\[S\]|\bMight\b',['701-705']),('Equipment','150',r'\bEquipment\b',['716-719']),
 ('Dependent Keywords','726-727',r'\[(?!Action|Reaction)[A-Z][A-Za-z\- ]*\d*\]\[>\]',[])]
for t,ref,p,rel in OTH: topic('o:'+t,t,'oth',[ref],rx(p),rel=rel,why='txt')
NOACT={'Activated Abilities':r'do this\s*:|following\s*:|one\s*:|domain\s*:'}
ti={t['k']:i for i,t in enumerate(T)}
# ---------- rule name mentions
def ap(s): return s.replace('’',"'").replace('‘',"'")
names=[]
for c in cards:
    for n in {c['_fn']}|({c['_name']} if c['t']=='Legend' else set())|({c['n']} if c['t']=='Legend' else set()):
        if len(n)>=4 and n not in('Buff',): names.append((n,c))
        m_=re.match(r'^(\w+) the (.+)$',n)
        if m_: names.append((m_.group(1)+', the '+m_.group(2),c))
names.sort(key=lambda z:-len(z[0]))
ment=collections.defaultdict(list)
for r in R:
    for e in r.get('ex',[]):
        s=ap(e)
        for n,c in names:
            pat=re.compile(r'(?<![A-Za-z])'+re.escape(n)+r'(?![A-Za-z])')
            if pat.search(s):
                if r['id'] not in ment[id(c)]: ment[id(c)].append(r['id'])
                s=pat.sub(lambda m:'#'*len(m.group()),s)
# ---------- apply
import glob
REV={}
for f in sorted(glob.glob('data/review/rv_*_out.json')):
    REV.update(json.load(open(f,encoding='utf-8')).get('fixes') or {})
NP=json.load(open('data/audit/notes_patch.json',encoding='utf-8'))
RF={}
for f in sorted(glob.glob('data/audit/r*_out.json')):
    for k,v in (json.load(open(f,encoding='utf-8')).get('fixes') or {}).items(): RF.setdefault(k,{}).update({x:y for x,y in v.items() if x in ('short','notes')})
SA={}
for f in sorted(glob.glob('data/audit/[av]*_out.json')):
    SA.update({k:v['short'] for k,v in (json.load(open(f,encoding='utf-8')).get('fixes') or {}).items()})
SA.update(json.load(open('data/audit/manual.json',encoding='utf-8')))
SH={}
for f in sorted(glob.glob('data/short/s*_short.json')):
    SH.update(json.load(open(f,encoding='utf-8')))
BN={}
for f in sorted(glob.glob('data/notes/batch_*_notes.json')):
    try: BN.update(json.load(open(f,encoding='utf-8')))
    except Exception as e: print('BATCH LOAD FAIL',f,e)
RID={r['id'] for r in R}
BNFIX=json.load(open('data/notes/batch_zfix_notes.json',encoding='utf-8'))
def clean_notes(v):
    out=[]
    for n in v:
        if not(isinstance(n,list) and len(n)==3): continue
        refs=','.join(x.strip() for x in str(n[0]).split(',') if x.strip() in RID)
        if not refs or n[1] not in (0,1,2): continue
        out.append([refs,n[1],str(n[2]).replace('\u2014',',').replace('\u2013','-')])
    return out
for c in cards:
    tx=(c['txt'] or '')+('\n'+c['eff'] if c.get('eff') else '')
    tp=[]
    for i,t in enumerate(T):
        f=t['_t']
        if callable(f):
            if f(c): tp.append([i,''])
        else:
            src=tx
            if t['title'] in NOACT: src=re.sub(NOACT[t['title']],' ',src,flags=re.I)
            if t['k']=='act:Counter': src=re.sub(r'\bcounters\b','',src,flags=re.I)
            if t['k'].startswith('act:Create') and 'Token' in c['st']: continue
            m=f.search(src)
            if m: tp.append([i,m.group(0).strip()[:60]])
    # self-evident duplicates
    ks={T[i]['k'] for i,_ in tp}
    if 'kw:Empower' in ks or 'kw:Empowered' in ks: pass
    c['tp']=tp; c['ex']=ment.get(id(c),[])
    if c['n'] in SH: c['sh']=SH[c['n']].replace('\u2014',',').replace('\u2013','-')
    if c['n'] in BNFIX:
        c['nt']=clean_notes(BNFIX[c['n']])
    elif c['n'] in NOTES or c['_fn'] in NOTES: c['nt']=[[r,f,t] for r,f,t in NOTES.get(c['n'],NOTES.get(c['_fn']))]
    elif c['n'] in BN:
        cn=clean_notes(BN[c['n']])
        if cn: c['nt']=cn
    rv=REV.get(c['n'])
    if rv and rv.get('notes'):
        cn=clean_notes(rv['notes'])
        if cn: c['nt']=cn
    if rv and rv.get('short'): SH[c['n']]=rv['short']
    if c['n'] in SA: SH[c['n']]=SA[c['n']]
    if c['n'] in SH: c['sh']=SH[c['n']].replace('\u2014',',').replace('\u2013','-')
    if c.get('sh'): c['sh']=' '.join(x for x in re.split(r'(?<=[.!?])\s+',c['sh']) if not re.search(r'tiltott|bannol|banned|tiltólist|Riftlens|ellenőrizd a legalitást',x,re.I)).strip()
    rf=RF.get(c['n'])
    if rf:
        if rf.get('notes'): c['nt']=[[str(r),int(f),x.replace('\u2014',',').replace('\u2013','-')] for r,f,x in rf['notes']]
        if rf.get('short'): c['sh']=rf['short'].replace('\u2014',',').replace('\u2013','-')
    for o,nw in NP.get(c['n'],[]):
        for x in c.get('nt',[]):
            if o in x[2]: x[2]=x[2].replace(o,nw)
    for k in ('_fn','_name'): del c[k]
for t in T: del t['_t']
cards.sort(key=lambda c:c['n'].lower())
GENERAL=[{'title':'Golden and Silver Rules','refs':['000-056'],'for':'all'},{'title':'Cards (felépítés, cost, domain, rules text)','refs':['125-139'],'for':'all'},
 {'title':'Playing Cards','refs':['349-359'],'for':'main'},{'title':'Costs','refs':['201-206'],'for':'main'},{'title':'Deck Construction','refs':['101-103'],'for':'all'}]
META={'rules_updated':'2026-10-09','ban_updated':'2026-09-18','cards_snapshot':'2026-11-12','articles':ARTICLES,
 'ban':BAN,'ban2':['Master Yi, Wuju Bladesman'],'banfut':BAN_FUT}
EXTRA={}
import os
for k in ('glossary','flow','patchnotes','terms','guide'):
    p='data/%s.json'%k
    if os.path.exists(p):
        try: EXTRA[k]=json.load(open(p,encoding='utf-8'))
        except Exception as e: print('EXTRA FAIL',k,e)
if 'patchnotes' in EXTRA:
    for p in EXTRA['patchnotes']:
        tr='Tournament' in p.get('title','')
        for c in p.get('changes',[]):
            r=(c.get('rule') or '').strip()
            if r and (tr or r not in RID):
                c['text']=('Tournament Rules ' if tr else '')+r+': '+c['text']; c['rule']=''
out={'meta':META,'rules':[[r['id'],r['t'],r.get('ex',[])] for r in R],'topics':T,'general':GENERAL,'cards':cards,'extra':EXTRA}
json.dump(out,open('data.json','w'),ensure_ascii=False,separators=(',',':'))
print('cards',len(cards),'topics',len(T),'bytes',len(json.dumps(out,ensure_ascii=False)))
print('errata',sum(c['err'] is not None for c in cards),collections.Counter(c['err'] for c in cards if c['err'] is not None))
print('banned',[c['n'] for c in cards if c['ban']]); print('future ban',[c['n'] for c in cards if c.get('banf')])
print('avg topics',sum(len(c['tp']) for c in cards)/len(cards))
cnt=collections.Counter(T[i]['title'] for c in cards for i,_ in c['tp']); print(cnt.most_common())

ids={r['id'] for r in R}
def ok(ref):
    ref=ref.strip()
    m=re.fullmatch(r'(\d{3}(?:\.[\da-z]+)*)-(\d{3}(?:\.[\da-z]+)*)',ref)
    if m: return m.group(1) in ids and m.group(2) in ids
    return ref in ids
bad=[(n,r) for n,v in NOTES.items() for r,f,t in v for x in r.split(',') if not ok(x)]
print('bad refs',bad)
print('review fixes',len(REV)); print('short',sum('sh' in c for c in cards)); print('notes cards',sum('nt' in c for c in cards),'batch notes',len(BN),'of',len(NOTES),'unmatched',[n for n in NOTES if not any(c['n']==n for c in cards)])
import itertools
alltxt=' '.join(t for v in NOTES.values() for r,f,t in v)
print('dash check',[ch for ch in '\u2013\u2014' if ch in alltxt])
print('img sample',cards[5]['img'])
