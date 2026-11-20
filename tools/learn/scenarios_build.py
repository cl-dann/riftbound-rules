#!/usr/bin/env python3
"""Practice szituációk (src/data/learn.json "scenarios") előállítása a szituáció-motor formátumában.

A kiinduló pályák a korábbi, lépésenkénti szituációkból jönnek (tools/learn/scenarios_v1.json), a lépések,
a jó és rossz kimenetek, a célpont-készletek és az optimális sor itt vannak leírva. Futtatás a repó gyökeréből:
    python3 tools/learn/scenarios_build.py
A motor: web/src/components/practiceEngine.ts, a tesztje: web/unit/practice.test.ts.
"""
import json, os, copy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
V1 = {s['id']: s for s in json.load(open(os.path.join(ROOT, 'tools/learn/scenarios_v1.json'), encoding='utf-8'))}
LEARN = os.path.join(ROOT, 'src/data/learn.json')

# ---------------- segédek ----------------
def runes(r):
    d = list(r.get('domains') or [])
    return [{'d': x, **({'ex': True} if i >= r['ready'] else {})} for i, x in enumerate(d)]

def unit(u):
    o = {'n': u['n'], 'm': u['m']}
    if u.get('ex'): o['ex'] = True
    tags = [t for t in (u.get('status') or []) if t in ('attacker', 'defender')]
    if tags: o['tags'] = [t.capitalize() for t in tags]
    return o

def side(s, me):
    o = {'legend': s.get('legend'), 'champion': s.get('champion'), 'base': [unit(u) for u in s.get('base', [])],
         'runes': runes(s['runes']), 'score': s.get('score', 0)}
    if me: o['hand'] = list(s.get('hand', []))
    else: o['handCount'] = s.get('handCount', 0)
    return o

def board_v1(sid, turn='me'):
    b = V1[sid]['steps'][0]['board']
    return {'turn': turn, 'me': side(b['me'], True), 'opp': side(b['opp'], False),
            'bfs': [{'name': f['name'], 'ctrl': f.get('ctrl'), 'me': [unit(u) for u in f.get('me', [])], 'opp': [unit(u) for u in f.get('opp', [])], 'fd': None} for f in b['bfs']],
            'chain': []}

def B(l, go='next', **kw):
    o = {'l': l, 'go': go}; o.update(kw); return o

def panel(tag, text, btns=None, **kw):
    o = {'t': 'panel', 'tag': tag, 'text': text}
    if btns is not None: o['btns'] = btns
    o.update(kw); return o

def free(**kw):
    o = {'t': 'free'}; o.update(kw); return o

def O(kind, title, text, opt=None):
    o = {'kind': kind, 'title': title, 'text': text}
    if opt: o['opt'] = opt
    return o

def bad(title, text, opt=None): return O('bad', title, text, opt)
def good(title, text): return O('good', title, text)

FB = bad('Nem ez a terv', 'Ez a lépés szabályos lehet, de ebben a helyzetben nem viszi előre a célt.')
SKIP = lambda text: bad('Kihagyott lehetőség', text)

SC = []

# =====================================================================
# 1. ABCD
# =====================================================================
b = board_v1('abcd-kor-eleje')
SC.append({
    'id': 'abcd-kor-eleje', 'title': 'ABCD: a kör eleje', 'topic': 'Körfelépítés', 'level': 'kezdo',
    'intro': 'A kör első négy fázisa: Awaken, Beginning, Channel, Draw. Mindegyiket a pályán hajtod végre.',
    'brief': 'A második köröd kezdődik, te vagy a második játékos. Az első körödben kijátszottad az [[Eager Drakehound]] lapot, és elfoglaltad vele a Grove of the God-Willow-t. A Drakehound és a két rune-od exhausted. A Main Phase előtt négy fázis jön sorban, mindegyik Task: döntés nélkül történik {{315.1.a}}.',
    'rules': '315.1-315.4, 316.3, 416.3.a, 431.2.a, 471.2',
    'board': b,
    'optimal': 'Awaken: minden saját lap ready. Beginning: hold, 1 pont, a Grove miatt 1 húzás. Channel: 2 rune. Draw: 1 lap. A Main Phase elején a Rune Pool kiürül.',
    'fallback': 'o_fb',
    'steps': [
        panel('TURN-START', 'Melyik fázissal kezdődik a köröd?', [
            B('A: Awaken', kind='gold'), B('C: Channel', 'o_c_first'), B('D: Draw', 'o_d_first')]),
        panel('ABCD-AWAKEN', 'A Turn Player readyzi az összes általa kontrollált, readyzhető lapot {{315.1.b}} {{416.3.a}}: a unitokat és a rune-okat is. Kattints egyenként a sárgán kiemelt exhausted lapjaidra.', [B('Awaken indítása', kind='gold')], letter='A', title='Awaken'),
        free(mode='awaken', hint='Kattints a sárgán kiemelt exhausted lapokra: az Eager Drakehoundra és a két rune-ra.'),
        panel('ABCD-BEGINNING', 'Előbb a kör eleji hatások futnak le {{315.2.a.1}}: a [[Jinx, Loose Cannon]] csak akkor húzat, ha legfeljebb 1 lap van a kezedben, most 4 van. Utána a Scoring Step: holdolod a battlefieldeket, amelyeket kontrollálsz {{315.2.b.2}} {{471.2}}. Mi jön most?', [
            B('Hold: a Grove pontja', kind='gold'), B('Előbb channelölök, a hold ráér', 'o_hold_late'),
            B('Holdolni csak a kör végén lehet', 'o_hold_end')], letter='B', title='Beginning'),
        free(bbtn={'l': '+1 pont: hold', 'at': 'score', 'do': [{'op': 'score', 'n': 1}, {'op': 'draw', 'card': 'Cleave'}]}, hint='Kattints a saját pontszámodra a pálya jobb oldalán.'),
        panel('HOLD', 'A Grove holdja 1 pont {{471.2}}. A Grove of the God-Willow szövege szerint holdkor húzol 1 lapot: a [[Cleave]] a kezedbe került. Hány rune-t channelölsz a Channel Phase-ben?', [
            B('2 rune-t', kind='gold'), B('3 rune-t, mert második játékos vagyok', 'o_ch3'), B('1 rune-t, mert már van 2', 'o_ch1')], letter='C', title='Channel'),
        free(bbtn={'l': 'Channel: 2 rune', 'at': 'runes', 'do': [{'op': 'channel', 'd': ['Fury', 'Fury']}]}, hint='Kattints a Channel gombra a rune-jaid alatt.'),
        panel('ABCD-DRAW', '2 rune került a Rune Deck tetejéről a boardra {{315.3.b}}, ready állapotban {{431.2.a}}. Most 4 rune-od van. Jön a Draw Phase.', [B('Tovább', kind='gold')], letter='D', title='Draw'),
        free(bbtn={'l': 'Draw: 1 lap', 'at': 'hand', 'do': [{'op': 'draw', 'card': 'Flash'}]}, hint='Kattints a Draw gombra a kezed alatt.'),
        panel('MAIN-PHASE', 'Húztál 1 lapot {{315.4.b}}: a [[Flash]]. Ha a Main Deck üres lenne, előbb Burn Out jönne {{315.4.b.1}}. Mi történik a Main Phase elején?', [
            B('Kiürül a Rune Pool, a rune-ok ready maradnak', 'o_good'), B('A rune-ok exhaustolódnak', 'o_pool1'),
            B('Az előző kör Energyje még elkölthető', 'o_pool2')]),
    ],
    'outcomes': {
        'o_good': good('Demó kész', 'Végigjártad a kör elejét: Awaken, Beginning, Channel, Draw. A Main Phase elején a Rune Pool kiürül {{316.3}} {{167}}, a rune-ok állapota nem változik. Innentől te döntesz: a Drakehound ready, Standard Move-val léphet {{144.2}}, és 4 rune-ból fizethetsz.'),
        'o_c_first': bad('Rossz sorrend', 'A Channel Phase a harmadik fázis {{315.3}}. Az első az Awaken: a Turn Player readyzi, amit kontrollál {{315.1.b}}.'),
        'o_d_first': bad('Rossz sorrend', 'A Draw Phase a negyedik fázis {{315.4}}. Az első az Awaken {{315.1.b}}.'),
        'o_hold_late': bad('Rossz sorrend', 'A Beginning Phase a Channel Phase előtt van {{315.2}} {{315.3}}, a hold a Beginning Phase Scoring Stepjében történik {{315.2.b.2}}.'),
        'o_hold_end': bad('Nem így működik a hold', 'A hold a saját Beginning Phase-edben jár, ha akkor te kontrollálod a battlefieldet {{471.2}}.'),
        'o_ch3': bad('Csak az első körben', 'Az extra rune csak a második játékos első Channel Phase-ére jár {{487.7}}. Most 2 rune jön {{315.3.b}}.'),
        'o_ch1': bad('Mindig 2', 'A boardon lévő rune-ok száma nem számít, a Channel Phase-ben 2 rune jön {{315.3.b}}.'),
        'o_pool1': bad('Nem ez történik', 'A Main Phase eleje csak a Rune Poolt üríti {{316.3}}, a rune-ok ready maradnak.'),
        'o_pool2': bad('Elveszett Energy', 'A kör végén és a Main Phase elején is ürül a pool, a maradék elvész {{167}} {{167.1}}.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 2. Egyszerű combat
# =====================================================================
b = board_v1('egyszeru-combat-conquer')
SC.append({
    'id': 'egyszeru-combat-conquer', 'title': 'Egyszerű combat', 'topic': 'Combat alapok', 'level': 'kezdo',
    'intro': 'Egy unit Standard Move-val egy ellenséges battlefieldre lép: combat, damage, conquer.',
    'brief': 'A te köröd Main Phase-e. A base-edben ready a [[Vanguard Sergeant]] (4 Might). Az ellenfél a Packed Amphitheatert kontrollálja, ott áll az exhausted [[Shipyard Skulker]] (3 Might). Foglald el az Amphitheatert: kattints a Sergeantre, válaszd a célt, majd erősítsd meg a mozgást.',
    'hint': 'Kattints a base-edben álló Vanguard Sergeantre, és válaszd a Packed Amphitheatert.',
    'rules': '144, 452, 467.2, 142.4.b, 468.5.d, 471, 472',
    'board': b,
    'optimal': 'A Vanguard Sergeant Standard Move-val a Packed Amphitheaterre lép, mindkét fél passzol, a combatban a 4 Might megöli a 3 Mightú Skulkert: conquer, 1 pont.',
    'fallback': 'o_fb',
    'steps': [
        free(need=['move:Vanguard Sergeant:bf0'], acts={'move:Vanguard Sergeant:bf1': {'go': 'o_grove'}},
             end={'go': 'o_skip'}),
        panel('PRIORITY', 'A Sergeant exhaustolva átlépett {{144.2}} {{144.4.a}}. Az Amphitheater Contested lett {{452}}, két játékos unitja áll ott, ezért combat kezdődik {{463}}. Te vagy az Attacker {{466.2.c.1}}, a combat showdownban nálad a Focus {{466.2.c.1.a}}.', [
            B('Spell kijátszása', dis='A kezedben nincs [Action] vagy [Reaction] lap, showdownban csak ilyen játszható ki {{308.1.a}}.'), B('Passz', kind='gold')],
            st='showdown', pre=[{'op': 'tag', 'ref': 'Vanguard Sergeant', 'add': ['Attacker']}, {'op': 'tag', 'ref': 'Shipyard Skulker', 'add': ['Defender']}]),
        panel('OPP-PASS', 'Az ellenfél is passzol. Mindenki egymás után passzolt, a showdown véget ér {{347.2.a}}. Jön a combat damage: ki osztja ki előbb, és mennyit?', [
            B('Én, az Attacker: 4-et', kind='gold'), B('A Defender: 3-at', 'o_dmg1'), B('A nagyobb Mightú fél a különbséget: 1-et', 'o_dmg2')], st='showdown'),
        panel('COMBAT', 'Az attackerek Mightját összeadod {{467.2.c}}, a kiosztást az Attacker kezdi. A damage egyszerre érkezik {{467.2.c.1.a}}: a Skulker 4-et, a Sergeant 3-at kap. Lethal az a nem nulla damage, ami eléri a Mightot {{142.4.b}}.', [B('Combat feloldása', kind='gold')],
              clash=0, pre=[{'op': 'dmg', 'ref': 'Shipyard Skulker', 'n': 4}, {'op': 'dmg', 'ref': 'Vanguard Sergeant', 'n': 3}]),
        panel('RESULT', 'A Skulker a cleanupban a trashbe kerül {{323.4}}, a Sergeant damage-e gyógyul {{468.1.a.1}}. Egyedül neked maradt unitod, megnyerted a combatot {{468.3.a}}. Ez conquer, mert ebben a körben még nem pontoztad ezt a battlefieldet {{468.5.d}} {{471.1}}: 1 pont. Pontozhatod még egyszer ebben a körben az Amphitheatert?', [
            B('Nem', kind='gold'), B('Igen, ha a Sergeant visszamegy, majd újra belép', 'o_twice')],
              pre=[{'op': 'kill', 'ref': 'Shipyard Skulker'}, {'op': 'heal'}, {'op': 'ctrl', 'bf': 0, 'to': 'me'}, {'op': 'score', 'n': 1}, {'op': 'untagAll', 'tags': ['Attacker', 'Defender']}]),
        free(need=['end'], end={'go': 'o_good'}, hint='Fejezd be a kört az End Turn gombbal.'),
    ],
    'outcomes': {
        'o_good': good('Demó kész', 'Mozgás, passz, combat, conquer. Egy battlefieldet körönként egyszer pontozhatsz {{472}}. A következő köröd Beginning Phase-ében holdolod az Amphitheatert, ha még a tiéd: ez újabb pont {{471.2}}.'),
        'o_skip': SKIP('A Sergeant ready volt, és az ellenfél egyetlen unitja exhausted: a kör vége előtt szabadon elfoglalhattad volna az Amphitheatert.'),
        'o_grove': bad('Szabályos, de gyengébb', 'A gazdátlan Grove elfoglalása is conquer, 1 pont {{471.1}}. A Skulker viszont életben marad, és az ellenfél a következő körében holdolja az Amphitheatert {{471.2}}. Az ellenséges battlefieldre lépve a pont mellé a Skulkert is leveszed.'),
        'o_dmg1': bad('Rossz sorrend', 'A kiosztást az Attacker kezdi {{467.2.c}}, és a teljes Might összegét osztja ki.'),
        'o_dmg2': bad('Nincs különbségszámítás', 'Mindkét fél a teljes Might összegét osztja ki {{467.2.c}}, a damage egyszerre érkezik {{467.2.c.1.a}}.'),
        'o_twice': bad('Körönként egyszer', 'Egy battlefieldet körönként egyszer pontozhatsz, bármelyik módszerrel {{472}}. Az újbóli elfoglalás nem ad új pontot.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 3. Több unit
# =====================================================================
b = board_v1('tobb-unit-damage-kiosztas')
SC.append({
    'id': 'tobb-unit-damage-kiosztas', 'title': 'Több unit harca', 'topic': 'Combat alapok', 'level': 'kezdo',
    'intro': 'Két attacker két defender ellen: Assault, Shield, Tank, és a damage kiosztás sorrendje.',
    'brief': 'A base-edben ready a [[Petty Officer]] (5, Assault) és a [[Laurent Duelist]] (3, Assault 2). Az ellenfél a Grove-ot tartja a [[Horns of the Dragon]] (6, Tank) és a [[Stalwart Poro]] (2, Shield) unittal. A Black Marketet a [[Vanguard Sergeant]] tartja. Egyik unitod sem nyer egyedül: vidd mindkettőt a Grove-ra, egyetlen Standard Move-val {{144.3}}.',
    'hint': 'Kattints egymás után mindkét base-ben álló unitodra, válaszd a Grove-ot, majd a Mozgás megerősítése gombot.',
    'rules': '144.3, 467.2.c.3, 467.2.c.4, 815.1.b, 807.1.c, 814.1.c, 142.4.b',
    'board': b,
    'optimal': 'A Petty Officer és a Laurent Duelist együtt lép a Grove-ra (6 + 5 Might az Assaulttal). A 11 damage-ből előbb a Tank Horns kap lethalt (6), utána a Poro (3), a maradék 2 bárkire mehet.',
    'fallback': 'o_fb',
    'steps': [
        free(need=['move:Petty Officer:bf0', 'move:Laurent Duelist:bf0'], partial='o_alone',
             acts={'move:Vanguard Sergeant:base': {'go': 'o_leave'}}, end={'go': 'o_skip'}),
        panel('COMBAT', 'Combat kezdődik, te vagy az Attacker {{466.2.c.1}}. Az Assault attackerként ad bónuszt {{807.1.c}}, a Shield defenderként {{814.1.c}}: Officer 6, Duelist 5, Poro 3, Horns 6. A showdownban senki nem játszik ki lapot {{347.2.a}}. Az összesített Mightod 11, az ellenfélé 9.', [B('Damage kiosztása', kind='gold')],
              pre=[{'op': 'tag', 'ref': r, 'add': ['Attacker']} for r in ('Petty Officer', 'Laurent Duelist')] + [{'op': 'tag', 'ref': r, 'add': ['Defender']} for r in ('Horns of the Dragon', 'Stalwart Poro')] +
              [{'op': 'might', 'ref': 'Petty Officer', 'set': 6}, {'op': 'might', 'ref': 'Laurent Duelist', 'set': 5}, {'op': 'might', 'ref': 'Stalwart Poro', 'set': 3}], st='showdown'),
        {'t': 'assign', 'tag': 'DAMAGE', 'side': 'me', 'bf': 0, 'amount': 11, 'first': {'Horns of the Dragon': 'next'},
         'text': 'Te kezded a kiosztást {{467.2.c}}. A Tank unitra kell elsőként lethal damage-et kiosztani {{815.1.b}}. Egy unit a teljes lethalt megkapja, mielőtt a következő jönne {{467.2.c.3}}, és lethal fölé csak akkor mehetsz, ha már mindenki megkapta a sajátját {{467.2.c.4}}. Kattints a unitokra a kiosztás sorrendjében.'},
        panel('OPP-ASSIGN', 'Most az ellenfél osztja ki a 9 damage-ét a két unitodra. A kiosztás még nem sebzés, a damage a végén, egyszerre érkezik {{467.2.c.1.a}}. Melyik kiosztás szabályos?', [
            B('6 a Petty Officerre, 3 a Duelistre', kind='gold', do=[{'op': 'dmg', 'ref': 'Petty Officer', 'n': 6}, {'op': 'dmg', 'ref': 'Laurent Duelist', 'n': 3}]),
            B('4 az Officerre, 5 a Duelistre, az Officerrel kezdve', 'o_a1'), B('Mind a 9 a Duelistre', 'o_a2')], st='showdown'),
        panel('COMBAT', 'A damage egyszerre megérkezik {{467.2.d}}. Kik halnak meg a cleanupban?', [
            B('A Horns, a Poro és a Petty Officer', kind='gold'), B('Csak a Horns, mert a Tank védi a Porót', 'o_d1'), B('Mind a négy unit', 'o_d2')], clash=0),
        panel('RESULT', 'Az a unit hal meg, amelyen a damage eléri a Mightját {{142.4.b}} {{323.4}}. A Duelist gyógyul {{468.1.a.1}}, egyedül neked maradt unitod: megnyerted a combatot {{468.3.a}}, conquer, 1 pont {{468.5.d}}. A combat végén az Attacker designation lekerül {{468.7.a}}. Mennyi most a Duelist Mightja?', [
            B('3', kind='gold'), B('5, a kör végéig', 'o_m1'), B('5, amíg a Grove-on áll', 'o_m2')],
              pre=[{'op': 'kill', 'ref': 'Horns of the Dragon'}, {'op': 'kill', 'ref': 'Stalwart Poro'}, {'op': 'kill', 'ref': 'Petty Officer'}, {'op': 'heal'}, {'op': 'ctrl', 'bf': 0, 'to': 'me'}, {'op': 'score', 'n': 1},
                   {'op': 'untagAll', 'tags': ['Attacker', 'Defender']}, {'op': 'might', 'ref': 'Laurent Duelist', 'set': 3}]),
        free(need=['end'], end={'go': 'o_good'}, hint='Fejezd be a kört az End Turn gombbal.'),
    ],
    'outcomes': {
        'o_good': good('Demó kész', 'Két unit egyetlen Standard Move-val {{144.3}}, Assault és Shield a combat designation alatt {{807.1.c}} {{814.1.c}}, Tank miatti kiosztási sorrend {{815.1.b}}. A Duelist túlélte, a Grove a tiéd.'),
        'o_alone': bad('Egyedül kevés', 'Egy unit egyedül nem nyer: a Petty Officer attackerként 6, a Duelist 5 Might, a Grove védőinek összege 9 (Horns 6, Poro a Shield miatt 3) {{814.1.c}}. Az azonos oldalon álló unitok Mightja összeadódik {{467.2.c}}, ezért mindkettőt egyszerre kell vinni {{144.3}}.'),
        'o_leave': bad('Elveszett battlefield', 'A Vanguard Sergeant a Black Marketet tartja. Ha elhagyná, a Black Market kontroll nélkül maradna {{190.4.c}}. Most a két base-ben álló unitod támad.'),
        'o_skip': SKIP('Két ready unitod volt, és együtt 11 Mighttal támadhattál volna 9 ellen.'),
        'o_a1': bad('Nem szabályos kiosztás', 'Az elsőként választott unitnak teljes lethal jár, mielőtt a következőre lépne {{467.2.c.3}}.'),
        'o_a2': bad('Nem szabályos kiosztás', 'A Duelist lethalja 5, efölé nem mehet, amíg az Officer még kaphat damage-et {{467.2.c.4}}.'),
        'o_d1': bad('A Tank nem véd', 'A Tank csak a kiosztás sorrendjét szabja meg {{815.1.b}}, a Poron is lethal damage van {{142.4.b}}.'),
        'o_d2': bad('Nem mindenki hal meg', 'A Duelist 5 Mightjához 3 damage nem lethal {{142.4.b}}.'),
        'o_m1': bad('Az Assault nem "this turn" hatás', 'Az Assault csak addig ad bónuszt, amíg a unit attacker {{807.1.d.1}}, a designation a combat végén megszűnik {{468.7.a}}.'),
        'o_m2': bad('A designationhöz kötött', 'A bónusz az Attacker designationhöz kötött {{807.1.d.1}}, ami a combat végén megszűnik {{468.7.a}}.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 4. Damage kiosztás védekezésben (új)
# =====================================================================
SC.append({
    'id': 'damage-kiosztas-vedekezesben', 'title': 'Damage kiosztás védekezésben', 'topic': 'Combat alapok', 'level': 'kezdo',
    'intro': 'Az ellenfél két unittal támad, a combatot nem nyerheted meg. A kiosztással döntöd el, melyik unitja éli túl.',
    'brief': 'Az ellenfél köre. A Kinkou Temple-t a [[Vanguard Sergeant]] (4 Might) tartja. Az ellenfél base-ében ready a [[Plundering Poro]] (2 Might, conquerkor Gold gear tokent kap) és a [[Shipyard Skulker]] (3 Might). Mindkettővel rád fog támadni: 5 Might a 4 ellen. Nézd meg, hogyan támad, aztán döntsd el, hova osztod a damage-edet.',
    'rules': '466.2.c.1, 467.2.c, 467.2.c.3, 468.3.a, 468.5.d',
    'board': {
        'turn': 'opp',
        'me': {'legend': 'Garen, Might of Demacia (Starter)', 'champion': 'Garen, Rugged', 'base': [], 'score': 4,
               'runes': [{'d': 'Order'}, {'d': 'Body'}, {'d': 'Order', 'ex': True}, {'d': 'Body', 'ex': True}, {'d': 'Order', 'ex': True}],
               'hand': ['Daring Poro', 'Cull the Weak']},
        'opp': {'legend': 'Diana, Scorn of the Moon', 'champion': None, 'score': 5, 'handCount': 3,
                'base': [{'n': 'Plundering Poro', 'm': 2}, {'n': 'Shipyard Skulker', 'm': 3}],
                'runes': [{'d': 'Mind', 'ex': True}, {'d': 'Mind', 'ex': True}, {'d': 'Chaos', 'ex': True}, {'d': 'Chaos', 'ex': True}]},
        'bfs': [{'name': 'Kinkou Temple', 'ctrl': 'me', 'me': [{'n': 'Vanguard Sergeant', 'm': 4}], 'opp': [], 'fd': None},
                {'name': 'Grove of the God-Willow', 'ctrl': None, 'me': [], 'opp': [], 'fd': None}],
        'chain': []},
    'optimal': 'Az első lethal damage a Plundering Porora menjen (2), a maradék 2 a Skulkerre. Így a conquer képességű unit hal meg, a túlélő Skulkernek nincs conquer hatása.',
    'fallback': 'o_fb',
    'steps': [
        {'t': 'auto', 'toast': 'Az ellenfél lép...', 'do': [{'op': 'move', 'ref': 'Plundering Poro', 'to': 'bf0'}, {'op': 'move', 'ref': 'Shipyard Skulker', 'to': 'bf0'},
                                                         {'op': 'tag', 'ref': 'Plundering Poro', 'add': ['Attacker']}, {'op': 'tag', 'ref': 'Shipyard Skulker', 'add': ['Attacker']}, {'op': 'tag', 'ref': 'Vanguard Sergeant', 'add': ['Defender']}]},
        panel('OPP-ATTACK', 'Az ellenfél mindkét unitjával a Kinkou Temple-re lépett. Ő tette Contesteddé, ezért ő az Attacker {{466.2.c.1}}, és nála a Focus {{466.2.c.1.a}}. 5 Might áll a te 4-ed ellen: a combatot nem nyerheted meg.', [B('Tovább', kind='gold')], st='showdown'),
        panel('PRIORITY', 'Az ellenfél passzol, a Focus hozzád kerül {{347.2.b}}. A kezedben nincs [Action] vagy [Reaction] lap, a rune-jaid nagy része exhausted.', [
            B('Spell kijátszása', dis='A [[Daring Poro]] és a [[Cull the Weak]] nem [Action] és nem [Reaction], showdownban nem játszható ki {{308.1.a}}.'), B('Passz', kind='gold')], st='showdown'),
        {'t': 'assign', 'tag': 'DAMAGE', 'side': 'me', 'bf': 0, 'amount': 4, 'first': {'Plundering Poro': 'next', 'Shipyard Skulker': 'o_wrong'},
         'text': 'Mindketten passzoltatok, a showdown véget ért {{347.2.a}}. Az ellenfél, az Attacker kezdi a kiosztást {{467.2.c}}: 5 damage-et oszt a Sergeantre. Most te osztod ki a 4 Mightodat. Egy unit a teljes lethalt megkapja, mielőtt a következő jönne {{467.2.c.3}}. Melyik unitra osztasz elsőként?'},
        panel('COMBAT', 'A damage egyszerre érkezik {{467.2.d}}: a Poro 2-t kapott, ez lethal {{142.4.b}}. A Skulkeren 2 van a 3 Mightjához. A Sergeant 5-öt kapott a 4 Mightjához.', [B('Combat feloldása', kind='gold')],
              clash=0, pre=[{'op': 'dmg', 'ref': 'Vanguard Sergeant', 'n': 5}]),
        panel('RESULT', 'A cleanupban a Poro és a Sergeant meghal {{323.4}}, a Skulker gyógyul {{468.1.a.1}}. Az ellenfél egyedül maradt, megnyerte a combatot {{468.3.a}}, és conquerrel 1 pontot kap {{468.5.d}}. A Poro Gold tokenje elmaradt.', [B('Tovább', 'o_good', kind='gold')],
              pre=[{'op': 'kill', 'ref': 'Plundering Poro'}, {'op': 'kill', 'ref': 'Vanguard Sergeant'}, {'op': 'heal'}, {'op': 'ctrl', 'bf': 0, 'to': 'opp'}, {'op': 'score', 'side': 'opp', 'n': 1},
                   {'op': 'untagAll', 'tags': ['Attacker', 'Defender']}]),
    ],
    'outcomes': {
        'o_good': good('Demó kész', 'A pontot nem tudtad megakadályozni, de a conquer képességű Plundering Porót leszedted. A túlélő Skulkernek nincs conquer hatása, így az ellenfél csak a pontot kapta, extra értéket nem.'),
        'o_wrong': bad('Extra érték az ellenfélnek', 'Ha elsőként a Skulker kap lethalt (3), a maradék 1 a Porora nem lethal {{142.4.b}}, ezért a Poro túléli. Conquer után a szövege szerint az ellenfél egy Gold gear tokent kap, ami később egy [A] Powert ad. A combatot így sem nyerhetted meg, de az extra értéket elvehetted volna.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 5. Spell használata
# =====================================================================
b = board_v1('spell-hasznalata')
NOT_BF = 'A base nem battlefield, ezért nem legális target {{355.9.b}}.'
SC.append({
    'id': 'spell-hasznalata', 'title': 'Spell használata', 'topic': 'Spellek', 'level': 'kezdo',
    'intro': 'Egy [Action] spell targetje, kifizetése és feloldása, utána a kiürült battlefield elfoglalása.',
    'brief': 'A Main Phase-edben vagy. A kezedben a [[Hextech Ray]] (1 Energy + 1 Fury Power, [Action]: 3 damage egy battlefielden álló unitnak) és az [[Incinerate]] (2 Energy: 2 damage). A Grove-on az ellenfél [[Shipyard Skulker]]-je áll (3 Might), a base-edben a [[Legion Rearguard]] (2 Might). Az ellenfél minden rune-ja exhausted.',
    'hint': 'Kattints a Hextech Ray-re a kezedben.',
    'rules': '355.5, 355.9.b, 164.2, 328.1, 337.4, 339.1, 309.1.a, 323.4, 323.5, 344.2, 348.2.a.1',
    'board': b,
    'optimal': 'Hextech Ray a Shipyard Skulkerre, passz, a Ray feloldódik és a Skulker meghal. Utána a Legion Rearguard a Grove-ra lép: conquer, 1 pont.',
    'fallback': 'o_fb',
    'steps': [
        free(need=['play:Hextech Ray'], end={'go': 'o_skip'},
             orderWhy='Ha a Rearguard most lép a Grove-ra, a Skulker még ott áll: combat lesz, és a 2 Mightú Rearguard a 3 Mightú Skulker ellen meghal {{142.4.b}}. Előbb a spell tisztítsa meg a battlefieldet.',
             acts={'play:Hextech Ray': {'target': {
                 'title': 'Target kiválasztása', 'text': 'A Hextech Ray 3 damage-et ad egy battlefielden álló unitnak. Kijátszáskor előbb a targetet választod {{355.5}}, utána fizetsz {{357}}.',
                 'max': 1, 'opts': ['Shipyard Skulker', 'Eager Drakehound', 'Bewitching Spirit', 'Legion Rearguard'],
                 'illegal': {'Bewitching Spirit': NOT_BF, 'Legion Rearguard': NOT_BF},
                 'correct': ['Shipyard Skulker'], 'wrong': {'Eager Drakehound': 'o_own'}}},
                 'play:Incinerate': {'go': 'o_incin'}}),
        panel('CHAIN-OPEN', 'A [[Hextech Ray]] a chainen van {{328.1}}, a targetje a Skulker. Az 1 Energyt egy rune exhaustolása adta {{164.2.a}}, a Fury Powert egy Fury rune recycle-je {{164.2.b}} {{164.2.b.1}}. A recycle-ölt rune a Rune Deck aljára került {{161.2.b}}. A finalizálás után te kapod a priorityt {{337.4}}.', [
            B('Még egy spell', dis='Amíg a chainen van valami, Closed State van: csak [Reaction] lap játszható ki {{309.1.a}}. Az Incinerate [Action].'), B('Passz', kind='gold')], chain=True, st='closed'),
        panel('CHAIN-OPP', 'Az ellenfél kapja a priorityt, de minden rune-ja exhausted, ezért passzol. Mindenki passzolt, a chain legfelső eleme resolve-ol {{339.1}} {{340.1}}.', [B('Chain feloldása', kind='gold')], chain=True, st='closed'),
        panel('RESOLVE', 'A Skulker 3 damage-et kapott, ez lethal, a cleanupban meghal {{323.4}}. A Grove-on nem maradt unitja, az ellenfél elveszíti a kontrollt {{323.5}}. Ha az ellenfélnek lett volna ready rune-ja és egy [Action] lapja, válaszolhatott volna vele a Ray-re?', [
            B('Nem, Closed Stateben csak [Reaction] játszható ki', kind='gold'), B('Igen, az [Action] bármikor kijátszható', 'o_act'), B('Igen, de csak a saját körében', 'o_act2')],
              pre=[{'op': 'chain-'}, {'op': 'kill', 'ref': 'Shipyard Skulker'}, {'op': 'ctrl', 'bf': 0, 'to': None}]),
        free(need=['move:Legion Rearguard:bf0'], end={'go': 'o_half'}, hint='Mozgasd a Legion Rearguardot a Grove-ra.'),
        panel('SHOWDOWN', 'A Rearguard Standard Move-val a Grove-ra lépett {{144.2}} {{144.4.a}}. A Grove Contested lett, ellenséges unit nincs ott, ezért showdown nyílik {{344.2}}. Mindketten passzoltok, csak a te unitod maradt: conquer, 1 pont {{348.2.a}} {{348.2.a.1}}.', [B('Tovább', kind='gold')],
              pre=[{'op': 'ctrl', 'bf': 0, 'to': 'me'}, {'op': 'score', 'n': 1}]),
        free(need=['end'], end={'go': 'o_good'}, hint='Fejezd be a kört az End Turn gombbal.'),
    ],
    'outcomes': {
        'o_good': good('Demó kész', 'A removal spellt a combat előtt játszottad ki, így a Rearguard harc nélkül foglalta el a Grove-ot. Target, fizetés, chain, priority, resolve: ez egy [Action] spell teljes útja.'),
        'o_own': bad('Saját unit', 'Szabályos target, mert battlefielden áll {{355.9.b}}, de a saját Drakehoundodat sebeznéd, és a Skulker a Grove-on maradna.'),
        'o_incin': bad('Nem elég damage', 'Az [[Incinerate]] 2 damage-et ad, a 3 Mightú Skulkerhez ez nem lethal {{142.4.b}}. A Hextech Ray 3 damage-e kell.'),
        'o_skip': SKIP('A Hextech Ray-jel leszedhetted volna a Skulkert, és a Rearguarddal elfoglalhattad volna a Grove-ot.'),
        'o_half': SKIP('A Grove kiürült, a Rearguard harc nélkül elfoglalhatta volna: conquer, 1 pont {{348.2.a.1}}.'),
        'o_act': bad('Closed Stateben nem', 'Az [Action] showdownban ad engedélyt {{806.1.c.1}}, chainre válaszolni csak [Reaction] lappal lehet {{309.1.a}}.'),
        'o_act2': bad('A saját körében sem', 'Closed Stateben csak [Reaction] játszható ki {{309.1.a}}, bárkinek a körében.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 6. Floating runes
# =====================================================================
b = board_v1('energy-lebegtetes-power-recycle')
SC.append({
    'id': 'energy-lebegtetes-power-recycle', 'title': 'Energy lebegtetés és Power recycle', 'topic': 'Erőforrások', 'level': 'kezdo',
    'intro': 'A rune-okat te kezeled: exhaust Energyért, recycle Powerért. A poolban maradt Energy a kör végéig vár.',
    'brief': '5 ready rune-od van: 3 Fury és 2 Chaos. A kezedben az [[Eager Drakehound]] (3 Energy + 1 Fury Power) és a [[Hextech Ray]] (1 Energy + 1 Fury Power). Mindkettőt ki akarod játszani, a Ray-jel a Grove-on álló [[Void Hatchling]]et leszedni, utána a Drakehounddal elfoglalni a Grove-ot. Kattints egy rune-ra, és válaszd az Energy (exhaust) vagy a Power (recycle) fizetést. Az Energy a Rune Poolba kerül {{166.1}}, onnan fizetsz.',
    'hint': 'Egy rune adhat Energyt és Powert is: előbb exhaustold, utána recycle-öld. A ready rune recycle-je elveszi az Energyjét.',
    'rules': '164.2, 163, 166.1, 167, 417.1.b, 344.2, 348.2.a',
    'pool': True,
    'board': b,
    'optimal': 'Exhaustolj 4 rune-t (4 Energy), recycle-ölj egy exhausted Fury rune-t (Fury Power): Drakehound. A poolban maradt 1 Energyhez recycle-ölj még egy exhausted Fury rune-t: Hextech Ray a Hatchlingre. Utána a ready lépő Drakehound elfoglalja a Grove-ot.',
    'fallback': 'o_fb',
    'steps': [
        free(mode='pay', need=['play:Eager Drakehound', 'play:Hextech Ray'], budget=['Eager Drakehound', 'Hextech Ray'], deadEnd='o_lost',
             sol=['energy:Fury', 'energy:Fury', 'energy:Fury', 'energy:Chaos', 'power:Fury', 'play:Eager Drakehound', 'power:Fury', 'play:Hextech Ray'],
             acts={'play:Eager Drakehound': {'go': 'stay', 'msg': 'A Drakehound a szövege miatt ready lép be. Ha a poolban maradt Energy, az a kör végéig elkölthető {{167}}.'},
                   'play:Hextech Ray': {'go': 'stay', 'msg': 'Az ellenfél nem válaszol, a Hextech Ray resolve-ol: a Hatchling 3 damage-et kap és meghal {{323.4}}, a Grove gazdátlan lett {{323.5}}.',
                                        'target': {'title': 'Target kiválasztása', 'text': 'A Hextech Ray 3 damage-et ad egy battlefielden álló unitnak {{355.9.b}}.', 'max': 1,
                                                   'opts': ['Void Hatchling', 'Bewitching Spirit', 'Chemtech Enforcer'], 'illegal': {'Bewitching Spirit': NOT_BF, 'Chemtech Enforcer': NOT_BF},
                                                   'correct': ['Void Hatchling']},
                                        'do': [{'op': 'chain-'}, {'op': 'kill', 'ref': 'Void Hatchling'}, {'op': 'ctrl', 'bf': 0, 'to': None}]},
                   'rpower:Fury': {'go': 'stay', 'msg': 'Ready rune-t recycle-öltél: az Energyje elveszett. Előbb exhaustold, utána recycle-öld {{164.2.a}} {{164.2.b}}.'},
                   'rpower:Chaos': {'go': 'o_chaos'}, 'power:Chaos': {'go': 'o_chaos'},
                   'play:Incinerate': {'go': 'o_incin'}}),
        panel('POOL', 'Mindkét lap kint van. Ha a fizetés után Energy marad a Rune Poolban, mi lesz vele?', [
            B('A kör végéig a poolban marad, később elköltheted', kind='gold'), B('Azonnal elveszik, mert a kijátszás lezárult', 'o_pool1'), B('Átviheted a következő körödbe', 'o_pool2')]),
        free(need=['move:Eager Drakehound:bf0'], acts={'move:Chemtech Enforcer:bf0': {'go': 'o_good2'}}, end={'go': 'o_half'}, hint='A Drakehound ready lépett be, ezért már most mozoghat.'),
        panel('SHOWDOWN', 'A Drakehound ready lépett be, így exhaustolva mozoghatott {{144.2}}, pedig ebben a körben játszottad ki: a unitok általában exhaustolva lépnek be {{143.4}}. Nincs ellenséges unit a Grove-on, non-combat showdown nyílik {{344.2}}, mindketten passzoltok: conquer, 1 pont {{348.2.a}} {{348.2.a.1}}. Hová kerültek a recycle-ölt Fury rune-ok?', [
            B('A Rune Deck aljára', kind='gold'), B('A trashbe', 'o_r1'), B('A kör végén visszakerülnek a boardra', 'o_r2')],
              pre=[{'op': 'ctrl', 'bf': 0, 'to': 'me'}, {'op': 'score', 'n': 1}]),
        free(need=['end'], end={'go': 'o_good'}, hint='Fejezd be a kört az End Turn gombbal.'),
    ],
    'outcomes': {
        'o_good': good('Lebegtetve, mindkét lap kint', 'Exhaustolt rune is recycle-ölhető {{164.2.b}}, így egy rune Energyt és Powert is adhat. A recycle-ölt rune a Rune Deck aljára kerül {{417.1.b}}, és csak akkor jön vissza, amikor a channel a Rune Deck tetejéről addig elfogyasztotta a többi rune-t {{431.1}}.'),
        'o_good2': good('Szintén jó', 'A Chemtech Enforcer is elfoglalja a gazdátlan Grove-ot: conquer, 1 pont {{348.2.a.1}}. A Drakehound ready maradt a base-ben.'),
        'o_lost': bad('Elfogyott az Energy', 'A maradék rune-okból már nem fizethető ki mindkét lap. Egy rune vagy Energyt ad exhaustolva {{164.2.a}}, vagy Powert recycle-lel {{164.2.b}}: ha ready rune-t recycle-ölsz, az Energyje elveszik. Előbb exhaust, utána recycle.'),
        'o_chaos': bad('Rossz domain', 'Chaos rune Chaos Powert ad {{164.2.b.1}}, a lapok Fury Powert kérnek {{163.2.a}}. A recycle-ölt rune feleslegesen hagyta el a boardot {{161.2.b}}.'),
        'o_incin': bad('Nem fér bele', 'Az Incinerate 2 Energy: a Drakehounddal és a Hextech Ray-jel együtt már nem fér bele az 5 rune-ba {{164.2.a}}.'),
        'o_pool1': bad('Nem veszik el', 'A Rune Pool csak a Main Phase elején és a kör végén ürül {{167}}.'),
        'o_pool2': bad('A kör végén elvész', 'A kör végén a pool kiürül, a maradék elveszik {{317.2.d}} {{167.1}}.'),
        'o_r1': bad('Nem a trashbe', 'Rune recycle a Rune Deckbe megy {{417.1.b}}.'),
        'o_r2': bad('Nem jön vissza magától', 'A recycle a Rune Deck aljára teszi a rune-t {{417.1.b}}, csak channellel jön vissza {{315.3.b}}.'),
        'o_half': SKIP('A Grove kiürült, a ready Drakehound harc nélkül elfoglalhatta volna: conquer, 1 pont {{348.2.a.1}}.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 7. When I move
# =====================================================================
b = board_v1('mozgas-es-tamadas-trigger')
SC.append({
    'id': 'mozgas-es-tamadas-trigger', 'title': 'When I move', 'topic': 'Triggerek', 'level': 'halado',
    'intro': 'Mikor kerül a chainre a "When I move" képesség, mikor kezdődik utána a combat, és mi lesz a Focusszal.',
    'brief': 'A base-edben ready a [[Stellacorn Herder]] (3 Might, "When I move, draw 1") és a [[Crackshot Corsair]] (3 Might, "When I attack, deal 1 to an enemy unit here"). A Kinkou Temple-t az ellenfél tartja: [[Vanguard Sergeant]] (4) és [[Watchful Sentry]] (1, Deathknell: húzás). Vidd mindkét unitodat egyetlen Standard Move-val a Kinkou Temple-re {{144.3}}.',
    'hint': 'Kattints egymás után a Herderre és a Corsairre, mindkettőnél a Kinkou Temple-t válaszd, majd erősítsd meg.',
    'rules': '448.3.c, 383.3, 462, 466.2.d, 383.4.e.2, 808.1.d.2, 346.1',
    'board': b,
    'optimal': 'Mindkét unit a Kinkou Temple-re lép. A Herder triggere a chainre kerül és feloldódik (húzás), utána kezdődik a combat. A Corsair támadás triggere a Watchful Sentryt célozza: 1 damage lethal, így az ellenfél kisebb Might összeggel oszt.',
    'fallback': 'o_fb',
    'steps': [
        free(need=['move:Stellacorn Herder:bf0', 'move:Crackshot Corsair:bf0'], partial='o_alone', end={'go': 'o_skip'}),
        panel('WHEN-I-MOVE', 'A mozgás azonnali, nem használja a chaint, és nem lehet rá reagálni {{448.3.c}}. A [[Stellacorn Herder]] mozgás triggere viszont a chainre került {{383.3}}. A Kinkou Temple Contested {{452}}, a combat staged {{463}}, de amíg a chainen elem van, combat nem kezdődik {{462}}. Válaszolhat az ellenfél erre a triggerre?', [
            B('Igen, [Reaction] lappal', kind='gold'), B('Nem, triggered abilityre nem lehet válaszolni', 'o_t1'), B('Csak [Action] lappal', 'o_t2')],
              chain=True, st='closed', pre=[{'op': 'chain+', 'card': 'Stellacorn Herder', 'note': 'When I move: draw 1'}]),
        panel('CHAIN-RESOLVE', 'Ha létezik chain, Closed State van {{309.1}}, ilyenkor [Reaction] játszható ki {{309.1.a}}. Az ellenfél most passzol, te is: a trigger resolve-ol {{339.1}}, húzol 1 lapot.', [B('Chain feloldása', kind='gold', do=[{'op': 'chain-'}, {'op': 'draw', 'card': 'Discipline'}])], chain=True, st='closed'),
        panel('WHEN-I-ATTACK', 'A chain kiürült, combat kezdődik {{462}}. Te vagy az Attacker {{466.2.c.1}}: a unitjaid megkapják az Attacker designationt {{466.2.c.3}}, és ekkor triggerel a [[Crackshot Corsair]] támadás képessége {{383.4.e.2}} {{466.2.d}}. A célpontot most választod, amikor a trigger a chainre kerül.', [
            B('Célpont kiválasztása', kind='gold', target={
                'title': 'Crackshot Corsair: 1 damage', 'text': '"Deal 1 to an enemy unit here": bármelyik ott álló ellenséges unit választható {{355.9.b}}.', 'max': 1,
                'opts': ['Vanguard Sergeant', 'Watchful Sentry', 'Stellacorn Herder', 'Crackshot Corsair'],
                'illegal': {'Stellacorn Herder': 'A Corsair triggere ellenséges unitot kér {{355.9.b}}.', 'Crackshot Corsair': 'A Corsair triggere ellenséges unitot kér {{355.9.b}}.'},
                'correct': ['Watchful Sentry'], 'wrong': {'Vanguard Sergeant': 'o_sgt'},
                'do': [{'op': 'chain+', 'card': 'Crackshot Corsair', 'note': '1 damage: Watchful Sentry'}]})],
              st='showdown', pre=[{'op': 'tag', 'ref': r, 'add': ['Attacker']} for r in ('Stellacorn Herder', 'Crackshot Corsair')] + [{'op': 'tag', 'ref': r, 'add': ['Defender']} for r in ('Vanguard Sergeant', 'Watchful Sentry')]),
        panel('CHAIN', 'A Corsair triggere a chainen. Mindketten passzoltok, resolve-ol {{339.1}}: a Sentry 1 damage-et kap, ez lethal {{142.4.b}}. A cleanupban meghal {{323.4}}, a Deathknell triggere a halála előtt kerül a chainre {{808.1.d.2}}, feloldódik: az ellenfél húz 1 lapot.', [
            B('Chain feloldása', kind='gold', do=[{'op': 'chain-'}, {'op': 'kill', 'ref': 'Watchful Sentry'}, {'op': 'draw', 'side': 'opp'}])], chain=True, st='sclosed'),
        panel('FOCUS', 'Ezt a chaint triggered ability nyitotta, ezért a Focus nem adódik tovább {{346.1}}: nálad marad. Te passzolsz, az ellenfél is, a showdown véget ér {{347.2.a}}.', [B('Damage kiosztása', kind='gold')], st='showdown'),
        {'t': 'assign', 'tag': 'DAMAGE', 'side': 'me', 'bf': 0, 'amount': 6, 'first': {'Vanguard Sergeant': 'next'},
         'text': 'Te kezded a kiosztást, mint Attacker {{467.2.c}}: a 6 damage-edet a Defenderek között osztod ki. Csak a Sergeant maradt.'},
        panel('OPP-ASSIGN', 'Az ellenfél a Sergeant 4 Mightját osztja ki a két unitodra. Melyik szabályos?', [
            B('3 a Herderre, 1 a Corsairre', kind='gold', do=[{'op': 'dmg', 'ref': 'Stellacorn Herder', 'n': 3}, {'op': 'dmg', 'ref': 'Crackshot Corsair', 'n': 1}]),
            B('2 a Herderre, 2 a Corsairre', 'o_a1'), B('Mind a 4 a Herderre', 'o_a2')], st='showdown'),
        panel('RESULT', 'A damage egyszerre érkezik {{467.2.d}}. A Sergeant és a Herder meghal {{323.4}}, a Corsair túléli, és a combat cleanup gyógyítja {{468.1.a.1}}. Megnyerted a combatot {{468.3.a}}: conquer, 1 pont {{468.5.d}}.', [B('Tovább', kind='gold')],
              clash=0, pre=[], ),
        free(need=['end'], end={'go': 'o_good'}, hint='Fejezd be a kört az End Turn gombbal.',
             pre=[{'op': 'kill', 'ref': 'Vanguard Sergeant'}, {'op': 'kill', 'ref': 'Stellacorn Herder'}, {'op': 'heal'}, {'op': 'ctrl', 'bf': 0, 'to': 'me'}, {'op': 'score', 'n': 1}, {'op': 'untagAll', 'tags': ['Attacker', 'Defender']}]),
    ],
    'outcomes': {
        'o_good': good('Demó kész', 'A "When I move" a mozgás után a chainre került és a combat előtt feloldódott {{462}}. A támadás trigger az Attacker designation után jött {{383.4.e.2}}, és a Sentry kiütésével az ellenfél kisebb összeggel osztott.'),
        'o_alone': bad('Egyedül kevés', 'Egy 3 Mightú unit egyedül nem bír a 4 + 1 Mightú védőkkel: az azonos oldalon álló unitok Mightja összeadódik {{467.2.c}}. Mindkét unitot egyszerre kell vinni {{144.3}}.'),
        'o_skip': SKIP('Két ready unitod volt, a Kinkou Temple elfoglalható volt ebben a körben.'),
        'o_t1': bad('Lehet válaszolni', 'A trigger ugyanúgy chain elem, mint egy activated ability {{383.3}}, és Closed Stateben [Reaction] kijátszható {{309.1.a}}.'),
        'o_t2': bad('Csak Reaction', 'Closed Stateben csak [Reaction] játszható ki {{309.1.a}}.'),
        'o_sgt': bad('Szabályos, de rossz cél', 'A célpontot a lethal nem korlátozza, a Sergeant is választható {{355.9.b}}. De a 4 Mightjához 1 damage nem lethal {{142.4.b}}, a Sentry életben marad, és az ellenfél 5 Mighttal oszt. A Sentry kiütésével kisebb lesz az ellenfél Might összege {{467.2.c}}.'),
        'o_a1': bad('Nem szabályos kiosztás', 'Mielőtt a következő unitra lép, az elsőnek teljes lethal jár {{467.2.c.3}}.'),
        'o_a2': bad('Nem szabályos kiosztás', 'Lethal fölé nem mehet, amíg a Corsair még kaphat damage-et {{467.2.c.4}}.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 8. When I attack, when I defend (új)
# =====================================================================
SC.append({
    'id': 'tamadas-es-vedekezes-trigger', 'title': 'When I attack, when I defend', 'topic': 'Triggerek', 'level': 'halado',
    'intro': 'Egy támadás és egy védekezés trigger egyszerre: ki teszi fel előbb, melyik oldódik fel előbb, és mi lesz a Mighttal.',
    'brief': 'A base-edben ready az [[Ahri, Inquisitive]] (3 Might, "When I attack or defend, give an enemy unit here -2 Might this turn, to a minimum of 1") és a [[Vanguard Sergeant]] (4 Might). A Kinkou Temple-t az ellenfél [[Draven, Vanquisher]] unitja tartja (4 Might, "When I attack or defend, you may pay [C] to give me +2 Might this turn"). Vidd mindkét unitodat a Kinkou Temple-re.',
    'hint': 'Kattints Ahrira és a Sergeantre, mindkettőnél a Kinkou Temple-t válaszd, majd erősítsd meg a mozgást.',
    'rules': '466.2.c.3, 466.2.d, 383.3.d.1, 340.1, 467.2.c',
    'board': {
        'turn': 'me',
        'me': {'legend': 'Lux, Lady of Luminosity (Starter)', 'champion': 'Lux, Crownguard', 'score': 3,
               'base': [{'n': 'Ahri, Inquisitive', 'm': 3}, {'n': 'Vanguard Sergeant', 'm': 4}],
               'runes': [{'d': 'Mind'}, {'d': 'Order'}, {'d': 'Mind', 'ex': True}, {'d': 'Order', 'ex': True}, {'d': 'Mind', 'ex': True}, {'d': 'Order', 'ex': True}],
               'hand': ['Daring Poro', 'Cull the Weak']},
        'opp': {'legend': 'Draven, Glorious Executioner', 'champion': 'Draven, Showboat', 'score': 4, 'handCount': 3, 'base': [],
                'runes': [{'d': 'Chaos'}, {'d': 'Fury', 'ex': True}, {'d': 'Fury', 'ex': True}, {'d': 'Chaos', 'ex': True}]},
        'bfs': [{'name': 'Kinkou Temple', 'ctrl': 'opp', 'me': [], 'opp': [{'n': 'Draven, Vanquisher', 'm': 4}], 'fd': None},
                {'name': 'Grove of the God-Willow', 'ctrl': None, 'me': [], 'opp': [], 'fd': None}],
        'chain': []},
    'optimal': 'Mindkét unit a Kinkou Temple-re lép. Te teszed fel elsőként Ahri triggerét (Dravenre), föle kerül Draven triggere. Draven +2 oldódik fel előbb (6), utána Ahri -2 (4). 7 Might a 4 ellen: conquer.',
    'fallback': 'o_fb',
    'steps': [
        free(need=['move:Ahri, Inquisitive:bf0', 'move:Vanguard Sergeant:bf0'], partial='o_alone', end={'go': 'o_skip'}),
        panel('TRIGGERS', 'A Kinkou Temple Contested lett, combat kezdődik. Te vagy az Attacker {{466.2.c.1}}, a designationök most kerülnek fel {{466.2.c.3}}. Egyszerre két trigger lett pending: Ahri támadás triggere és Draven védekezés triggere {{466.2.d}}. A Combat Chainre előbb az Attacker rakja fel a triggereit, a Defender utolsóként {{466.2.d.1}}. Ki teszi fel elsőként a triggerét a chainre?', [
            B('Én, a Turn Player', kind='gold'), B('Az ellenfél, mert ő védekezik', 'o_o1'), B('Egyszerre kerülnek fel', 'o_o2')],
              st='showdown', pre=[{'op': 'tag', 'ref': 'Ahri, Inquisitive', 'add': ['Attacker']}, {'op': 'tag', 'ref': 'Vanguard Sergeant', 'add': ['Attacker']}, {'op': 'tag', 'ref': 'Draven, Vanquisher', 'add': ['Defender']}]),
        {'t': 'target', 'tag': 'TARGET', 'title': 'Ahri, Inquisitive: -2 Might', 'text': 'Ahri triggere egy ott álló ellenséges unitot kér. A célpontot akkor választod, amikor a trigger a chainre kerül {{383.3}} {{355.5}}.', 'max': 1,
         'opts': ['Draven, Vanquisher', 'Ahri, Inquisitive', 'Vanguard Sergeant'],
         'illegal': {'Ahri, Inquisitive': 'A trigger ellenséges unitot kér {{355.9.b}}.', 'Vanguard Sergeant': 'A trigger ellenséges unitot kér {{355.9.b}}.'},
         'correct': ['Draven, Vanquisher'], 'do': [{'op': 'chain+', 'card': 'Ahri, Inquisitive', 'note': '-2 Might: Draven, Vanquisher'}]},
        panel('DEFEND-TRIGGER', 'Turn Order szerint ezután az ellenfél teszi fel a saját triggerét {{383.3.d.1}}: Draven triggere Ahri triggere fölé került. Melyik oldódik fel elsőként?', [
            B('Draven triggere, mert felül van', kind='gold'), B('Ahri triggere, mert az került fel előbb', 'o_lifo')],
              chain=True, st='sclosed', pre=[{'op': 'chain+', 'side': 'opp', 'card': 'Draven, Vanquisher', 'note': '+2 Might, ha fizet [C]'}]),
        panel('RESOLVE', 'Mindig a legújabb chain elem oldódik fel {{340.1}}. Mindketten passzoltok {{339.1}}: Draven triggere resolve-ol, az ellenfél egy Fury rune recycle-jével fizeti a [C] költséget {{164.2.b}}, Draven 6 Might. Utána Ahri triggere: -2 Might, Draven újra 4.', [
            B('Ahri triggere', kind='gold', do=[{'op': 'chain-'}, {'op': 'might', 'ref': 'Draven, Vanquisher', 'set': 4}])],
              chain=True, st='sclosed', pre=[{'op': 'chain-'}, {'op': 'recycle', 'side': 'opp', 'd': 'Fury'}, {'op': 'might', 'ref': 'Draven, Vanquisher', 'set': 6}]),
        panel('COMBAT', 'A chain kiürült. A showdownban mindketten passzoltok, a showdown véget ér {{347.2.a}}. A te Might összeged 7, az ellenfélé 4. Te kezded a kiosztást {{467.2.c}}.', [B('Damage kiosztása', kind='gold')], st='showdown'),
        {'t': 'assign', 'tag': 'DAMAGE', 'side': 'me', 'bf': 0, 'amount': 7, 'first': {'Draven, Vanquisher': 'next'},
         'text': 'Egyetlen defender maradt, ő kapja az összes damage-et: lethal fölé akkor mehetsz, ha nincs több unit, akire oszthatnál {{467.2.c.4}}.'},
        panel('OPP-ASSIGN', 'Az ellenfél 4 damage-et oszt ki: a 3 Mightú Ahri teljes lethalt kap, a maradék 1 a Sergeantre megy {{467.2.c.3}}. A damage egyszerre érkezik {{467.2.d}}.', [B('Combat feloldása', kind='gold')],
              clash=0, pre=[{'op': 'dmg', 'ref': 'Ahri, Inquisitive', 'n': 3}, {'op': 'dmg', 'ref': 'Vanguard Sergeant', 'n': 1}]),
        panel('RESULT', 'Draven és Ahri meghal {{323.4}}, a Sergeant gyógyul {{468.1.a.1}}. Egyedül neked maradt unitod: megnyerted a combatot {{468.3.a}}, conquer, 1 pont {{468.5.d}}.', [B('Tovább', kind='gold')],
              pre=[{'op': 'kill', 'ref': 'Draven, Vanquisher'}, {'op': 'kill', 'ref': 'Ahri, Inquisitive'}, {'op': 'heal'}, {'op': 'ctrl', 'bf': 0, 'to': 'me'}, {'op': 'score', 'n': 1}, {'op': 'untagAll', 'tags': ['Attacker', 'Defender']}]),
        free(need=['end'], end={'go': 'o_good'}, hint='Fejezd be a kört az End Turn gombbal.'),
    ],
    'outcomes': {
        'o_good': good('Demó kész', 'Az egyszerre triggerelő képességeket a Turn Player teszi fel elsőként {{383.3.d.1}}, ezért az ellenfél triggere kerül felülre, és az oldódik fel előbb {{340.1}}. Ahri -2-je így a +2 után jött, Draven 4 Mighttal harcolt.'),
        'o_alone': bad('Egyedül kevés', 'Ahri egyedül 3 Mighttal harcolna a 4 Mightú (a két trigger után is 4) Draven ellen, a Sergeant egyedül, Ahri triggere nélkül a 6 Mightú Draven ellen. Az azonos oldal Mightja összeadódik {{467.2.c}}: együtt 7.'),
        'o_skip': SKIP('Két ready unitod volt, együtt legyőzhették volna Dravent.'),
        'o_o1': bad('A Turn Player kezd', 'Ha több játékos triggerei egyszerre triggerelnek, a Turn Player kezdi, és Turn Order szerint haladnak {{383.3.d.1}}, combatban az Attacker kezd, a Defender az utolsó {{466.2.d.1}}. A védekező triggere ezért a te triggered fölé kerül.'),
        'o_o2': bad('Nem egyszerre', 'A chainre egyesével kerülnek fel, a Turn Playerrel kezdve {{383.3.d.1}}.'),
        'o_lifo': bad('A legújabb az első', 'A chain mindig a legújabb elemmel kezd {{340.1}}: Draven triggere került fel utoljára.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 9. Actions and Reactions
# =====================================================================
b = board_v1('showdown-action-reaction-ablakok')
SC.append({
    'id': 'showdown-action-reaction-ablakok', 'title': 'Action és Reaction ablakok', 'topic': 'Spell sebességek', 'level': 'halado',
    'intro': 'Mit játszhat ki a Focusos játékos showdownban, mit a priorityval rendelkező a chain alatt, és hogyan mented ki a unitodat Reactionnel.',
    'brief': 'A [[Shadowblade Lurker]] (5 Might) a Grove-ra lépett, ahol az ellenfél [[Profiteer]] unitja (4 Might) áll. Combat showdown van, te vagy az Attacker, nálad a Focus {{466.2.c.1.a}}. A kezedben: [[Incinerate]] (Action), [[Falling Star]] (nincs kulcsszava), [[Flash]] (Reaction). Sebezd meg a Profiteert.',
    'hint': 'Showdownban csak [Action] vagy [Reaction] lap játszható ki. Kattints a kezedben lévő lapokra.',
    'rules': '308.1.a, 309.1.a, 310, 312.2.d, 343.1.a, 346, 347, 467.1, 468.3',
    'board': b,
    'optimal': 'Incinerate a Profiteerre. Az ellenfél Discipline-nel válaszol, majd Punch Firsttel 11-re nő a Profiteer. A chainen a Punch First fölé a Flash kerül: a Lurker a base-be menekül.',
    'fallback': 'o_fb',
    'steps': [
        free(st='showdown', need=['play:Incinerate'], pass_={'go': 'o_pass0'}, acts={
            'play:Incinerate': {'target': {'title': 'Incinerate: 2 damage', 'text': 'Az Incinerate 2 damage-et ad egy battlefielden álló unitnak {{355.9.b}}.', 'max': 1,
                                           'opts': ['Profiteer', 'Shadowblade Lurker'], 'correct': ['Profiteer'], 'wrong': {'Shadowblade Lurker': 'o_own'}}},
            'play:Flash': {'go': 'o_flash'}}),
        panel('CHAIN', 'Az [[Incinerate]] a chainen, a Profiteert célozza. Te passzolsz, az ellenfél kapja a priorityt {{338.1.b.1}}. A kezében [[Discipline]] (Reaction) és [[Punch First]] (Action) van. Melyiket játszhatja ki most?', [
            B('A Discipline-t', kind='gold'), B('A Punch Firstöt', 'o_s1'), B('Egyiket sem, mert nem nála a Focus', 'o_s2')], chain=True, st='sclosed'),
        panel('OPP-REACTION', 'Létezik chain, Showdown Closed State van: csak [Reaction] játszható ki {{309.1.a}} {{310.4}}. Az ellenfél kijátssza a [[Discipline]] lapot a Profiteerre. A legújabb chain elem oldódik fel először {{340.1}}.', [
            B('Chain feloldása', kind='gold', do=[{'op': 'chain-'}, {'op': 'might', 'ref': 'Profiteer', 'set': 6}, {'op': 'draw', 'side': 'opp'}, {'op': 'chain-'}, {'op': 'dmg', 'ref': 'Profiteer', 'n': 2}])],
              chain=True, st='sclosed', pre=[{'op': 'chain+', 'side': 'opp', 'card': 'Discipline', 'note': '+2 Might: Profiteer', 'fromHand': True}, {'op': 'runesEx', 'side': 'opp', 'n': 2}]),
        panel('RESOLVED', 'Elsőként a Discipline: a Profiteer 6 Might, az ellenfél húz. Utána az Incinerate: 2 damage, ami a 6 Mighthoz nem lethal {{142.4.b}}. A chain kiürült, a Focus az ellenfélhez kerül {{346}}.', [B('Tovább', kind='gold')], st='showdown'),
        panel('OPP-ACTION', 'Az ellenfél a Focusszal kijátssza a [[Punch First]] lapot a Profiteerre: +5 Might a kör végéig, ez 11 lenne, és a Lurker a combatban meghalna. Előbb az ellenfél kap priorityt {{337.4}}, ő passzol, így te kapod {{312.2.d}}.', [B('Tovább', kind='gold')],
              chain=True, st='sclosed', pre=[{'op': 'chain+', 'side': 'opp', 'card': 'Punch First', 'note': '+5 Might: Profiteer', 'fromHand': True}, {'op': 'runesEx', 'side': 'opp', 'n': 3}]),
        free(st='sclosed', need=['play:Flash'], pass_={'go': 'o_pass'}, hint='Closed Stateben a priority számít, nem a Focus. Nézd meg, melyik lapod játszható ki.',
             acts={'play:Flash': {'target': {'title': 'Flash: mozgatás a base-be', 'text': 'A Flash legfeljebb 2 saját unitot mozgat a base-be.', 'min': 1, 'max': 1,
                                            'opts': ['Shadowblade Lurker', 'Profiteer'], 'illegal': {'Profiteer': 'A Flash saját (friendly) unitot mozgat, az ellenfél unitja nem lehet a targetje {{355.9.b}}.'},
                                            'correct': ['Shadowblade Lurker']}}}),
        panel('RESOLVE', 'A [[Flash]] oldódik fel elsőként {{340.1}}: a Lurker a base-be kerül {{451}}, és a cleanupban elveszíti az Attacker designationt {{323.2.c}}. Utána a Punch First: a Profiteer 11 Might. Mindketten passzoltok, a showdown véget ér {{347.2.a}}. Hogyan ér véget a combat?', [
            B('Nincs combat damage, a Grove az ellenfélé marad', 'o_good'), B('A Lurker visszatér és harcol', 'o_c1'), B('A Grove gazdátlan lesz', 'o_c2')],
              pre=[{'op': 'chain-'}, {'op': 'move', 'ref': 'Shadowblade Lurker', 'to': 'base'}, {'op': 'tag', 'ref': 'Shadowblade Lurker', 'rm': ['Attacker']}, {'op': 'chain-'}, {'op': 'might', 'ref': 'Profiteer', 'set': 11}]),
    ],
    'outcomes': {
        'o_good': good('Demó kész', 'Combat damage csak akkor van, ha attacker és defender is maradt {{467.1}}. Az ellenfél egyedül maradt, ő nyeri a combatot {{468.3.a}}. A Lurker életben maradt: a [Reaction] Closed Stateben is kijátszható, akkor is, ha a Focus nem nálad van {{309.1.a}} {{813.1.c.1}}.'),
        'o_own': bad('Saját unit', 'Szabályos target lenne, de a saját Lurkeredet sebeznéd.'),
        'o_pass0': bad('Elengedett Focus', 'Ha passzolsz, a Focus az ellenfélhez kerül {{347.2.b}}, és ő dönthet: a Profiteer egy pumpával fölébe nőhet a Lurkernek. Nálad a Focus, a Profiteert most sebezheted.'),
        'o_flash': bad('Szabályos, de nem sebez', 'A Flash is kijátszható lenne, mert [Reaction] {{813.1.b}}, de nem sebez: a Lurker visszamenne a base-be, és feladnád a támadást.'),
        'o_s1': bad('Closed Stateben nem', 'Az [Action] csak Showdown Open Stateben ad engedélyt, Closed Stateben csak [Reaction] játszható ki {{309.1.a}}.'),
        'o_s2': bad('A priority számít', 'Closed Stateben a priority számít, nem a Focus {{312.2.d}}, és [Reaction] lapot kijátszhat {{813.1.c.1}}.'),
        'o_pass': bad('A Lurker meghal', 'Ha passzolsz, a Punch First feloldódik, a Profiteer 11 Might lesz, és a Lurker a combatban meghal. Closed Stateben a priority számít {{312.2.d}}, és [Reaction] lapot kijátszhatsz {{813.1.c.1}}.'),
        'o_c1': bad('Nem tér vissza', 'A base-ben lévő unit elveszíti az Attacker designationt {{323.2.c}}, combat damage csak a battlefielden maradt unitok között van {{467.1}}.'),
        'o_c2': bad('Az ellenfélé marad', 'Az ellenfél unitja ott maradt, így megtartja a kontrollt {{468.5}}.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 10. Counter a counterre
# =====================================================================
b = board_v1('spell-chain-reaction')
SC.append({
    'id': 'spell-chain-reaction', 'title': 'Counter a counterre', 'topic': 'Chain', 'level': 'halado',
    'intro': 'Egy spell, egy counter és egy counter a counterre: a priority sorrendje és a chain feloldása.',
    'brief': 'A te köröd Main Phase-e, már kijátszottál egy [[Shadowblade Lurker]] lapot, 4 ready rune-od maradt. A Grove-on az ellenfél [[Wielder of Water]] unitja áll (2 Might). Az ellenfélnek 5 ready rune-ja van: Reactionre tartogathat. A kezedben a [[Hextech Ray]] (1 Energy + 1 Fury Power) és az [[Abandon]] (2 Energy, Reaction: counter).',
    'rules': '337.4, 338, 339.1, 340.1, 309.1.a, 426, 164.2',
    'board': b,
    'optimal': 'A Hextech Ray-t egy rune exhaustolásával és egy exhausted Fury rune recycle-jével fizeted, így 3 ready rune marad. A Wind Wallra Abandonnal válaszolsz, a chain fordított sorrendben oldódik fel, a Ray megöli a Wieldert.',
    'fallback': 'o_fb',
    'steps': [
        panel('PLAN', 'Hogyan fizeted ki a Hextech Ray-t, hogy az Abandonra (2 Energy) is maradjon?', [
            B('Egy rune-t exhaustolok Energyért, és egy exhausted Fury rune-t recycle-ölök', kind='gold'), B('Két rune-t exhaustolok, 2 Energyért', 'o_p1'), B('Egy Chaos rune-t recycle-ölök a Powerért', 'o_p2')]),
        free(need=['play:Hextech Ray'], end={'go': 'o_skip'}, hint='Kattints a Hextech Ray-re a kezedben.', acts={
            'play:Hextech Ray': {'target': {'title': 'Target kiválasztása', 'text': 'A Hextech Ray 3 damage-et ad egy battlefielden álló unitnak {{355.9.b}}.', 'max': 1,
                                            'opts': ['Wielder of Water', 'Shadowblade Lurker'], 'illegal': {'Shadowblade Lurker': NOT_BF}, 'correct': ['Wielder of Water']}},
            'play:Abandon': {'go': 'o_ab'}}),
        panel('PRIORITY', 'A [[Hextech Ray]] a chainre került {{328.1}}: egy rune exhaustolása adta az Energyt {{164.2.a}}, egy exhausted Fury rune recycle-je a Powert {{164.2.b}}, így 3 ready rune maradt. Finalizálás után te kapod a priorityt {{337.4}}.', [
            B('Abandon', dis='Az Abandon spellt counterel: most csak a saját Hextech Ray-ed van a chainen.'), B('Passz', kind='gold')], chain=True, st='closed'),
        panel('OPP-REACTION', 'Passzoltál {{338.1.b}}. Az ellenfél válaszul kijátssza a [[Wind Wall]] lapot a Hextech Ray-re: 3 rune-t exhaustol, kettőt recycle-öl a Calm Powerért. Te kapod a priorityt.', [B('Tovább', kind='gold')],
              chain=True, st='closed', pre=[{'op': 'chain+', 'side': 'opp', 'card': 'Wind Wall', 'note': 'counter: Hextech Ray', 'fromHand': True}, {'op': 'runesEx', 'side': 'opp', 'n': 3}, {'op': 'recycle', 'side': 'opp', 'd': 'Calm', 'n': 2}]),
        free(st='closed', need=['play:Abandon'], pass_={'go': 'o_pass'}, hint='Válaszolj a Wind Wallra: kattints az Abandonra.', acts={
            'play:Abandon': {'target': {'title': 'Abandon: counter', 'text': 'Az Abandon egy spellt counterel. A chainen lévő spellek közül választasz.', 'max': 1,
                                        'opts': ['Wind Wall', 'Hextech Ray', 'Wielder of Water'], 'illegal': {'Wielder of Water': 'Az Abandon spellt counterel, unit nem lehet a targetje {{355.9.b}}.'},
                                        'correct': ['Wind Wall'], 'wrong': {'Hextech Ray': 'o_self'}}}}),
        panel('CHAIN', 'Létezik chain, ez Closed State, itt [Reaction] játszható ki {{309.1.a}}, és az Abandon Reaction {{813.1.c.1}}. Te kapod a priorityt {{337.4}}, passzolsz, utána az ellenfél is {{339.1}}. Melyik oldódik fel először?', [
            B('Az Abandon', kind='gold'), B('A Hextech Ray, mert az került fel elsőként', 'o_l1'), B('Egyszerre mind a három', 'o_l2')], chain=True, st='closed'),
        panel('RESOLVE', 'Az Abandon counterli a Wind Wallt {{426.1.a}}, ami a lap szövege miatt a trash helyett az ellenfél kezébe kerül vissza {{002}}. A counter a költséget nem adja vissza {{426.1.c}}. A Predict során megnézed a Main Deck felső lapját {{437}}. Kijátszhatja az ellenfél újra a Wind Wallt a Ray-re?', [
            B('A szabály engedné, de nem tudja kifizetni: 2 ready rune legfeljebb 2 Energy', kind='gold'), B('Nem, egy lapot körönként csak egyszer lehet', 'o_w1'), B('Igen, ingyen, mert már ki volt fizetve', 'o_w2')],
              chain=True, st='closed', pre=[{'op': 'chain-'}, {'op': 'chain-'}, {'op': 'draw', 'side': 'opp'}]),
        panel('RESOLVE', 'Mindketten passzoltok, a [[Hextech Ray]] feloldódik: 3 damage a Wielderre, ami a 2 Mightjához lethal, a cleanupban meghal {{323.4}}. Kié most a Grove?', [
            B('Senkié', 'o_good'), B('Az enyém, mert a spellem ölte meg a unitot', 'o_g1'), B('Az ellenfélé a kör végéig', 'o_g2')],
              pre=[{'op': 'chain-'}, {'op': 'kill', 'ref': 'Wielder of Water'}, {'op': 'ctrl', 'bf': 0, 'to': None}]),
    ],
    'outcomes': {
        'o_good': good('Demó kész', 'Aki Open Stateben unit nélkül marad egy battlefielden, elveszíti a kontrollt {{190.4.c}} {{323.5}}. A chain fordított sorrendben oldódott fel {{340.1}}: Abandon, Wind Wall (counterelve), Hextech Ray.'),
        'o_p1': bad('Power nem jön Energyből', 'A Power költséget Energy nem fizeti {{163.1}} {{163.2.a}}: Fury Power egy Fury rune recycle-jéből jön {{164.2.b.1}}.'),
        'o_p2': bad('Rossz domain', 'Chaos rune Chaos Powert ad {{164.2.b.1}}, a Hextech Ray Fury Powert kér {{163.2.a}}.'),
        'o_ab': bad('Nincs mit counterelni', 'Az Abandon spellt counterel, most még nincs a chainen spell.'),
        'o_skip': SKIP('A Wielder a Grove-on áll, a Hextech Ray-jel leszedhetted volna.'),
        'o_pass': bad('A Ray-t counterelik', 'Ha most passzolsz, mindenki passzolt, és a Wind Wall feloldódik {{339.1}} {{340.1}}: counterli a Hextech Ray-t.'),
        'o_self': bad('Saját spell', 'A saját spelledet counterelnéd. Az Abandon targetje a Wind Wall legyen.'),
        'o_l1': bad('Fordított sorrend', 'A chain fordított sorrendben oldódik fel: a legújabb elem az első {{340.1}}.'),
        'o_l2': bad('Egyesével', 'Egyszerre egy elem oldódik fel, a legújabb {{340.1}}.'),
        'o_w1': bad('Nincs ilyen szabály', 'Reaction lap Closed Stateben bármikor kijátszható {{813.1.c.1}}, itt a költség a gát {{164.2.a}}.'),
        'o_w2': bad('Nem ingyen', 'A counter nem adja vissza a költséget {{426.1.c}}, az újbóli kijátszás teljes árat kér.'),
        'o_g1': bad('Unittal lehet kontrollálni', 'Kontrollt csak unittal lehet szerezni {{190.4}}.'),
        'o_g2': bad('A cleanupban elvész', 'A kontroll a következő cleanupban elvész {{190.4.c}} {{323.5}}.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 11. Hidden
# =====================================================================
b = board_v1('vedekezes-mit-tartasz-meg')
SC.append({
    'id': 'vedekezes-mit-tartasz-meg', 'title': 'Hidden és védekezés', 'topic': 'Védekezés', 'level': 'halado',
    'intro': 'Hidden unit elrejtése a saját körödben, és a kijátszása Reactionként az ellenfél támadásakor.',
    'brief': 'A köröd vége felé jársz. A Grove-ot egy [[Stalwart Poro]] tartja. Az ellenfél base-ében egy [[Petty Officer]] áll, ami a következő körében várhatóan rátámad a Grove-ra. A kezedben [[Pakaa Cub]] (Hidden) és [[Discipline]] (Reaction). 5 ready és 4 exhausted rune-od van. Rejtsd el a Cubot a Grove-nál.',
    'hint': 'Kattints a Pakaa Cubra, és válaszd az Elrejtés: Grove of the God-Willow menüpontot.',
    'rules': '811.1.b, 811.1.d.1, 811.6, 315.1.b, 347, 467.2.c, 468.5',
    'board': b,
    'optimal': 'Elrejted a Pakaa Cubot a Grove-nál. Az ellenfél támadásakor kijátszod facedownból, majd Discipline-nel erősíted: 8 Might a 6 ellen.',
    'fallback': 'o_fb',
    'steps': [
        free(need=['hide:Pakaa Cub:bf0'], end={'go': 'o_nohide'}, acts={'play:Pakaa Cub': {'go': 'o_playcub'}, 'play:Discipline': {'go': 'o_disc0'}}),
        free(need=['end'], end={'go': 'next'}, hint='A Cub rejtve vár. Fejezd be a köröd az End Turn gombbal.', toast='A Hidden költsége 1 tetszőleges domainű Power {{811.1.b}}, egy rune recycle-je fizette {{164.2.b}}. Az elrejtés nem nyit chaint {{811.1.c.2}}.'),
        {'t': 'auto', 'toast': 'Az ellenfél köre...', 'do': [{'op': 'turn', 'to': 'opp'}, {'op': 'move', 'ref': 'Petty Officer', 'to': 'bf0'}, {'op': 'score', 'side': 'opp', 'n': 1},
                                                          {'op': 'tag', 'ref': 'Petty Officer', 'add': ['Attacker']}, {'op': 'tag', 'ref': 'Stalwart Poro', 'add': ['Defender']},
                                                          {'op': 'might', 'ref': 'Petty Officer', 'set': 6}, {'op': 'might', 'ref': 'Stalwart Poro', 'set': 3}]},
        panel('OPP-ATTACK', 'Az ellenfél holdolta a Kinkou Temple-t, majd a [[Petty Officer]] lappal a Grove-ra lépett. Combat indul, ő az Attacker, nála a Focus {{466.2.c.1.a}}. A rune-jaid nem readyztek, mert az csak a saját Awaken Phase-edben történik {{315.1.b}}. A Poro a Shield miatt 3 Mighttal védekezik a 6 ellen {{814.1.c}}. A facedown Cub mostantól Reactiont kapott {{811.6}}. Az ellenfél passzol, a Focus hozzád kerül {{347.2.b}}.', [B('Tovább', kind='gold')], st='showdown'),
        free(st='showdown', fdReady=True, need=['playfd:0'], pass_={'go': 'o_pass1'}, acts={'play:Discipline': {'go': 'o_disc1'}}, hint='Kattints a Grove melletti facedown lapodra.'),
        panel('CUB', 'A Hidden lap a költsége figyelmen kívül hagyásával kijátszható {{811.1.b}}, arra a battlefieldre, ahol rejtve volt {{811.1.d.1}}. A Cub unitként azonnal feloldódik {{337.2}}, exhaustolva lép be {{143.4}}, és a következő cleanupban Defender lesz {{466.2.c.3.a}}. A Focus az ellenfélhez került {{347.1.b}}, ő passzol, a Focus újra nálad van {{347.2.b}}. Most 6 Might áll 6 ellen.', [B('Tovább', kind='gold')],
              st='showdown', pre=[{'op': 'tag', 'ref': 'Pakaa Cub', 'add': ['Defender']}]),
        free(st='showdown', need=['play:Discipline'], pass_={'go': 'o_pass2'}, hint='Erősítsd meg a védekezést a Discipline-nel.', acts={
            'play:Discipline': {'target': {'title': 'Discipline: +2 Might', 'text': 'A Discipline egy unitnak +2 Mightot ad a kör végéig, és húzol 1 lapot.', 'max': 1,
                                           'opts': ['Pakaa Cub', 'Stalwart Poro', 'Petty Officer'], 'correct': ['Pakaa Cub'], 'wrong': {'Stalwart Poro': 'o_poro', 'Petty Officer': 'o_officer'}},
                                'do': [{'op': 'chain-'}, {'op': 'might', 'ref': 'Pakaa Cub', 'set': 5}, {'op': 'draw', 'card': 'Stalwart Poro'}]}}),
        panel('SHOWDOWN-END', 'Showdownban a Focusos játékos játszhat ki [Action] vagy [Reaction] lapot {{347.1}} {{308.1.a}}: a Cub 5 Might. A Focus az ellenfélhez kerül, ő passzol, te is: a showdown véget ér {{347.2.a}}. Az Attacker kezdi a kiosztást {{467.2.c}}: 6 damage-et oszt. Melyik kiosztás szabályos?', [
            B('3 a Porora, 3 a Cubra', kind='gold', do=[{'op': 'dmg', 'ref': 'Stalwart Poro', 'n': 3}, {'op': 'dmg', 'ref': 'Pakaa Cub', 'n': 3}]),
            B('2 a Porora, 4 a Cubra', 'o_a1'), B('Mind a 6 a Porora', 'o_a2')], st='showdown'),
        {'t': 'assign', 'tag': 'DAMAGE', 'side': 'me', 'bf': 0, 'amount': 8, 'first': {'Petty Officer': 'next'},
         'text': 'Te a 8 Mightodat osztod ki (Cub 5 + Poro 3) az egyetlen attackerre.'},
        panel('RESULT', 'Minden damage egyszerre érkezik {{467.2.d}}. A cleanupban a Poro és az Officer meghal {{323.4}}, a Cub gyógyul {{468.1.a.1}}. Egyedül neked maradt unitod a Grove-on, megnyerted a combatot {{468.3.a}}. Kapsz pontot ezért a combatért?', [
            B('Nem, a Grove már az enyém volt', 'o_good'), B('Igen, 1 pontot conquerért', 'o_p1'), B('Igen, mert defenderként nyertem', 'o_p2')],
              pre=[{'op': 'kill', 'ref': 'Stalwart Poro'}, {'op': 'kill', 'ref': 'Petty Officer'}, {'op': 'heal'}, {'op': 'untagAll', 'tags': ['Attacker', 'Defender']}]),
    ],
    'outcomes': {
        'o_good': good('Demó kész', 'Kontrollt csak az alapít, aki még nem kontrollálta a battlefieldet, és csak ez lehet conquer {{468.5}} {{468.5.d}}. A hold a következő köröd Beginning Phase-ében jár {{471.2}}. A rejtett Cub és a visszatartott Reaction megtartotta a Grove-ot.'),
        'o_nohide': SKIP('A Hidden csak a saját körödben, Open Stateben rejthető el {{811.1.b}}. Az ellenfél körében már késő lesz.'),
        'o_playcub': bad('Az ellenfél látja', 'A Cub szabályosan kijátszható a base-be, de exhaustolva lép be {{143.4}}, és az ellenfél tudja, mire számíthat. Rejtve az ellenfél támadásakor Reactionként léphet be a Grove-ra {{811.6}}.'),
        'o_disc0': bad('Túl korán', 'A Discipline +2 Mightja a kör végéig tart: most elpazarolnád. Az ellenfél támadásakor kell.'),
        'o_disc1': bad('Előbb a Cub', 'A Discipline Reactionként most is kijátszható {{813.1.b}}, és a +2 a Poron is 8 összesített Mightot adna, ha a Cub utána belép. A terv mégis a Cubbal kezd: a Discipline-t érdemes a végére hagyni, hogy a targetet akkor válaszd, amikor már látod, mit lép az ellenfél.'),
        'o_pass1': bad('A Poro egyedül marad', 'Ha passzolsz, és az ellenfél is, a showdown véget ér {{347.2.a}}, és a 3 Mightú Poro egyedül védekezik a 6 Mightú Officer ellen.'),
        'o_pass2': bad('Elszalasztott ablak', 'Ha passzolsz, és az ellenfél is, a showdown véget ér {{347.2.a}}, a combat damage a showdown lezárásakor azonnal lefut {{467.2}}, nem nyit új ablakot: a Discipline-t később már nem játszhatod ki.'),
        'o_poro': bad('Ugyanannyi Might', 'A Poro erősítése is szabályos target, és a két védő összesített Mightja így is 8 lenne {{467.2.c}}: az ellenfél 6 damage-e egyik esetben sem öl meg mindkét unitot. A demó a Cubot erősíti.'),
        'o_officer': bad('Az ellenfelet erősítenéd', 'Az ellenfél attackerét erősítenéd.'),
        'o_a1': bad('Nem szabályos kiosztás', 'Az elsőként választott unitnak teljes lethal jár, mielőtt a következőre lép {{467.2.c.3}}.'),
        'o_a2': bad('Nem szabályos kiosztás', 'Lethal fölé nem mehet, amíg a Cub még kaphat damage-et {{467.2.c.4}}.'),
        'o_p1': bad('Nincs conquer', 'Conquer csak akkor van, ha megszerzed egy battlefield kontrollját {{471.1}}, a Grove pedig már a tiéd volt {{468.5}}.'),
        'o_p2': bad('A győzelem nem pont', 'A combat megnyerése önmagában nem ad pontot: pont conquerért vagy holdért jár {{471}}.'),
        'o_fb': FB,
    },
})

# =====================================================================
# 12. Final point
# =====================================================================
b = board_v1('hold-es-final-point')
SC.append({
    'id': 'hold-es-final-point', 'title': 'Hold és a Final Point', 'topic': 'Pontozás', 'level': 'halado',
    'intro': 'A köröd eleji hold hogyan nyitja meg a győztes conquert, és mi történik, ha nem holdoltál.',
    'brief': 'A 8. köröd eleje, az Awaken Phase után. 6 pontod van, az ellenfélnek 7, és a Kinkou Temple-t tartja: ha a következő körében holdol, nyer. A Grove-on a [[Wizened Elder]] áll, a base-edben a [[Playful Phantom]] (5 Might). Jön a Beginning Phase Scoring Stepje.',
    'rules': '315.2.b.2, 471.2, 472, 473.1.b.1, 323.1, 194.2',
    'board': b,
    'optimal': 'Holdolod a Grove-ot (7 pont), a Phantommal elfoglalod a Kinkou Temple-t: mivel ebben a körben minden battlefieldet pontoztál, a conquer megadja a 8. pontot.',
    'fallback': 'o_fb',
    'steps': [
        panel('SCORING', 'Mi történik a Scoring Stepben?', [
            B('Holdolom a Grove-ot: 1 pont, és a Grove miatt húzok 1-et', kind='gold', do=[{'op': 'score', 'n': 1}, {'op': 'draw', 'card': 'Discipline'}]),
            B('Semmi, pontot csak conquerért kapok', 'o_s1'), B('Csak akkor kapok pontot, ha a Wizened Elder ready', 'o_s2')]),
        panel('MAIN', 'A Turn Player holdolja a kontrollált battlefieldeket {{315.2.b.2}} {{471.2}}: 7 pontod van. A Channel Phase-ben nem kapsz rune-t, mert a Rune Deck üres {{315.3.b.1}}, a Draw Phase-ben húzol. Main Phase: a Phantommal a Kinkou Temple-re léphetsz, ahol a 3 Mightú [[Shipyard Skulker]] áll. Ha elfoglalod, megkapod a győztes pontot?', [
            B('Igen, mert ebben a körben a Grove-ot már pontoztam', kind='gold'), B('Nem, conquerrel az utolsó pont sosem szerezhető meg', 'o_f1'), B('Nem, holdot és conquert nem lehet egy körben kombinálni', 'o_f2')]),
        free(need=['move:Playful Phantom:bf1'], acts={'move:Wizened Elder:base': {'go': 'o_elder'}}, end={'go': 'o_skip'}, hint='Mozgasd a Playful Phantomot a Kinkou Temple-re.'),
        panel('COMBAT', 'Combat indul, te vagy az Attacker {{466.2.c.1}}. A showdownban mindketten passzoltok. A damage egyszerre érkezik {{467.2.c.1.a}}: a Skulker 5-öt, a Phantom 3-at kap.', [B('Combat feloldása', kind='gold')],
              clash=1, st='showdown', pre=[{'op': 'tag', 'ref': 'Playful Phantom', 'add': ['Attacker']}, {'op': 'tag', 'ref': 'Shipyard Skulker', 'add': ['Defender']}, {'op': 'dmg', 'ref': 'Shipyard Skulker', 'n': 5}, {'op': 'dmg', 'ref': 'Playful Phantom', 'n': 3}]),
        panel('FINAL-POINT', 'A Skulker meghal, a Phantom gyógyul {{468.1.a.1}}. Conquer {{468.5.d}}: mivel a Grove-ot ebben a körben már pontoztad, megkapod a 8. pontot {{473.1.b.1}}. A következő cleanup ellenőrzi: legalább 8 pontod van, és több, mint az ellenfélnek, tehát nyertél {{323.1}} {{194.2}}. Másik idővonal: tegyük fel, hogy 7 pontról indulsz, de ebben a körben a Grove-ot nem pontoztad (például gazdátlan). Mi történik a Kinkou Temple conquerjekor?', [
            B('A pont helyett húzok 1 lapot', 'o_good'), B('Megkapom a 8. pontot és nyerek', 'o_x1'), B('Nem kapok pontot és lapot sem', 'o_x2')],
              pre=[{'op': 'kill', 'ref': 'Shipyard Skulker'}, {'op': 'heal'}, {'op': 'ctrl', 'bf': 1, 'to': 'me'}, {'op': 'score', 'n': 1}, {'op': 'untagAll', 'tags': ['Attacker', 'Defender']}]),
    ],
    'outcomes': {
        'o_good': good('Győzelem', 'Az utolsó pont conquerrel csak akkor jár, ha ebben a körben minden battlefieldet pontoztál {{473.1.b.1}}, különben a pont helyett húzol. A hold is pontozás {{471.2}}, ezért nyitotta meg a győztes conquert.'),
        'o_s1': bad('A hold is pont', 'A hold is pontszerzés {{194.1.a}} {{471.2}}.'),
        'o_s2': bad('Csak a kontroll számít', 'A holdhoz csak a kontroll kell {{471.2}}, a unit állapota nem számít.'),
        'o_f1': bad('Megszerezhető', 'Az utolsó pont conquerrel megszerezhető, ha ebben a körben minden battlefieldet pontoztál {{473.1.b.1}}.'),
        'o_f2': bad('Kombinálható', 'Bármelyik út pontozásnak számít {{471}}, a feltétel csak az, hogy minden battlefieldet pontozz {{473.1.b.1}}.'),
        'o_elder': bad('Elveszett Grove', 'A Wizened Elder a Grove-on áll: ha a base-be lép, a Grove-on nem marad unitod, és a következő cleanupban elveszíted {{190.4.c}}.'),
        'o_skip': SKIP('Az ellenfél 7 ponton áll, és a következő körében holdolhat: ebben a körben kellett nyerni.'),
        'o_x1': bad('Nem minden battlefield', 'Az utolsó pont conquerrel csak akkor jár, ha minden battlefieldet pontoztál ebben a körben {{473.1.b.1}}.'),
        'o_x2': bad('Húzás jár', 'A pont helyett lapot húzol {{473.1.b.1}}.'),
        'o_fb': FB,
    },
})

# ---------------- kiírás ----------------
for s in SC:
    for st in s['steps']:
        if 'pass_' in st:
            p = st.pop('pass_')
            st['pass'] = p if p else {'go': 'next'}
order = ['abcd-kor-eleje', 'egyszeru-combat-conquer', 'tobb-unit-damage-kiosztas', 'damage-kiosztas-vedekezesben', 'spell-hasznalata',
         'energy-lebegtetes-power-recycle', 'mozgas-es-tamadas-trigger', 'tamadas-es-vedekezes-trigger', 'showdown-action-reaction-ablakok',
         'spell-chain-reaction', 'vedekezes-mit-tartasz-meg', 'hold-es-final-point']
SC.sort(key=lambda s: order.index(s['id']))
L = json.load(open(LEARN, encoding='utf-8'))
L['scenarios'] = SC
txt = json.dumps(L, ensure_ascii=False, indent=1)
assert '\u2013' not in txt and '\u2014' not in txt
open(LEARN, 'w', encoding='utf-8').write(txt + '\n')
print(len(SC), 'szituáció kiírva')
