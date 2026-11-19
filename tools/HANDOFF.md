# Folytatás (állapot: 2026-11-15 03:20)

## Élesben
- 16 ellenőrző kör a kártya shortokon és notes-on (src/data/audit/r*_out.json, notes_patch.json), nyomtatott lapokból leolvasott adatok (src/data/audit/printed.json: Radiance tagek, [A] költségek, Equipment hatások).
- Menü: Kártyák (rács alapból, hover nagyítás) | Deck | Szabályzat | Chain | How to Play (#hogyan, kezdő fejezetek) | Tanulás (#tanulas, haladó leckék és szituációk) | Kézikönyv.
- src/data/learn.json szándékosan üres, amíg a tartalom ellenőrzése nem kész ("hamarosan" üzenet látszik).

## Félbemaradt munka
1. Kártya ellenőrzés: 17. kör (tools/audit/r17_*_cards.json kész, agentek nem futottak le). Cél: egy teljes kör 0 javítással. Az utolsó körök: 15, 34, 31 javítás; a szempontlista lezárva (RBRIEF.md vége).
2. How to Play tartalom (tools/learn/beginner.json, 10 fejezet, 45 kvíz): 8 ellenőrző kör, az utolsó kettő 1-1 apró javítás. Kell még 1 hibátlan kör.
3. Tanulás tartalom (tools/learn/advanced.json, 3 haladó fejezet, 8 szituáció): 3 ellenőrző kör (18, 3, 7 javítás). Nyitott: a 0,1,2,3,5,7 indexű szituációk lapszámai (deck, kéz, trash) legyenek levezethetők a körszámból.
4. Fogalomtár érthetőségi átírás: KÉSZ, élesítve (glossary, terms, flow: 271 szöveg átírva, a permanent és a placeholderek magyarázva).
5. Opcionális: teljes nyomtatott-szöveg ellenőrzés a maradék kb. 650 lapra (eddig 446 lapot néztünk képről).

## Indítás
- A briefek abszolút útvonalai: /home/claude/build/r, /home/claude/build/learn, /home/claude/build/gl, /home/claude/work. Új sessionben: `mkdir -p /home/claude/build/{r,learn,gl} /home/claude/work && cp tools/audit/* /home/claude/build/r/ && cp tools/learn/* /home/claude/build/learn/ && cp src/data/{glossary,terms,flow}.json tools/gloss_wip/GBRIEF.md /home/claude/build/gl/ && cp tools/img/* /home/claude/work/`
- Kör: 12 agent, prompt: "Olvasd el és hajtsd végre: /home/claude/build/r/RBRIEF.md. Kör: K=NN, köteg NN=XX. Bemenet: .../rK_XX_cards.json, kimenet: .../rK_XX_out.json." Utána check.py, másolás src/data/audit alá, src/build.sh, commit.
- Új kör batch: `python3 gen.py K offset` (a web/src/generated/cards.json-ból).
- Tartalom élesítése: `python3 tools/learn/merge.py` (útvonalakat igazítani), majd src/build.sh és web build.
- Képek: a cmsassets.rgpub.io a környezet Custom network allowlistjén van.

## Döntés: menüszerepek (2026-11-15)
- How to Play (#hogyan): végigolvasós, sorrendben haladó 10 fejezet, fejezetvégi kvíz, haladásjelző, interaktív pálya a 2. fejezetben.
- Tanulás (#tanulas): gyakorlás: szituációk, haladó leckék (Tempo, Decképítés, Showdown).
- Kézikönyv (#kezikonyv): kereshető referencia: Fogalmak (a tooltipek forrása), Kulcsszavak, Játékmenet ábrák, Szabályváltozások és errata összefoglaló. A "Tudástár" név megszűnt.

## Kérés (2026-11-15): kérdés-válasz magyarázat minden lapnál, és logika a Chainben
- Lapnál új "Gyakori kérdések" blokk, 2-4 rövid kérdés-válasz a tipikus félreértésekre: kit célozhat (bármelyik unit, csak itt, csak saját), mikor játszható, mi van ha a célpont elmozdul vagy meghal, költség vagy célpont (pl. Sacrifice ölése cost, kijátszáskor), Hidden/facedown megkötések (811.1.d.3), passzív bónusz hatóköre ("here"). Forrás: a meglévő notes (már ellenőrzött) átfogalmazva, szabályszámmal. Ellenőrzés ugyanazzal a körös módszerrel.
- Chain elemző: "Mi történik?" magyarázat lépésenként, szabályszámmal: priority sorrend (337.4), költségként megölt unit azonnal (355.10.c), mistarget és linked instructions (359.3.e.14.a, Hidden Blade példa), LIFO feloldás, delayed kontroll vége (391.5.b), leváló Equipment (719.5). Példa a felhasználótól: ellenfél Akshan, Hidden Blade rá, válaszul Sacrifice (csak ha Akshan Mighty, 5+).
- Döntés (2026-11-15): a lapnál a közérthető "Gyakori kérdések" (kérdés-válasz) látszik elöl; a mostani technikus "Hogyan érinti ezt a lapot" jegyzetek egy lenyitható "Szabályi részletek" alá kerülnek, nem törlődnek. Ok: a technikus szöveg többféleképpen érthető a felhasználó szerint.

## Kérés (2026-11-15): interaktív Chain építő a pályával
- Bal oldal: űrlap (legendek, championök, rune-ok ready/exhausted, battlefieldek, unitok helye, Equipment, kéz, kijátszandó lapok és célpontjaik).
- Jobb oldal: a meglévő Playmat komponens kirajzolja a valódi pályát (lapképek, címkék).
- Léptetés: Tovább/Vissza a chain minden lépésén (kijátszás, költség, priority, válasz, feloldás LIFO), lépésenként "Mi változott?" lista és szabályszám.
- Számolás: Might (alap + buff, Assault/Shield csak támadó/védő szerepben, Equipment), damage, "még ennyi kell a halálhoz" = aktuális Might minus damage (Riftboundban nincs külön HP), lethal és combat damage kiosztás (467.2.c, Tank, Backline), halál (143.2.b), stun (nem oszt combat damage-et), mistarget (359.3.e.12), linked instructions (359.3.e.14.a).
- Első tesztesetek: Akshan + Hidden Blade + Sacrifice; Kennen, Keeper of Balance stun + "here" bónusz.

## Technikai irány (2026-11-15, javaslat, még nincs jóváhagyva lib szinten)
- Szabálymotor külön, tiszta TypeScript modulban (UI nélkül): állapot + akciók reducerrel, undo/redo; Vitest tesztek, a rules.json "ex" példáiból és a felhasználói esetekből (Akshan/Hidden Blade/Sacrifice, Kennen).
- Állapotkezelés: Zustand (időutazás a lépések között).
- Animáció: Motion (framer-motion): lap mozgás, exhaust forgatás, damage és +Might felugrás, halál.
- Drag and drop pályaépítés: dnd-kit (unit húzása battlefieldre, Equipment rádobása).
- Célzó nyilak: SVG réteg a forrás és a célpont között.
- Teljesítmény: TanStack Virtual a 1100 lapos rácshoz; fuzzy keresés (Fuse.js) magyar és angol kulcsszavakra.
- Routing: TanStack Router típusos URL-ekkel (a régi #hash linkek átirányítva).
- Minőség: Playwright e2e (a /home/claude/test/tweb.py mintájára), Storybook a pálya komponenseihez.
- Döntés: nincs PWA, nincs telepíthető vagy offline változat; a projekt csak böngészőben, a GitHub Pages oldalon fut.
- Elfogadott bónuszok (2026-11-15): megosztható szituáció-link (pálya és chain a linkben, Discordra); gyors rács (TanStack Virtual); hibatűrő magyar és angol keresés. A PWA továbbra sincs a tervben (előző döntés).

## Összesített ütemterv fülenként (2026-11-15), alapelv: interaktív, vizuális, automatikus magyarázat
0. Befejezendő: kártya ellenőrzés 17. kör-tól 0 javításig; How to Play tartalom 1 hibátlan kör; Tanulás tartalom (szituációk lapszámai) ellenőrzés; utána élesítés.
1. Kártyák: Gyakori kérdések (Q&A) elöl, technikus jegyzetek lenyithatóan; gyors rács (TanStack Virtual); hibatűrő HU/EN keresés; (megvan: rács alapból, hover nagyítás, tooltip).
2. Deck: saját deck építő (lapok hozzáadása a rácsból, élő legalitás-ellenőrzés a deckszabályokkal, a deck lapjaira vonatkozó szabályok és Gyakori kérdések egy helyen); Cardmarket árak: lapnként és deckre összesítve az utolsó 1 napos és 7 napos átlagár (avg1, avg7) EUR-ban, a forrás és a frissítés dátuma kiírva. Adat: a Cardmarket nyilvános price guide és product catalog letöltése (minden felhasználónak elérhető), napi GitHub Actions job süti bele a site adatába; a sandbox proxy a downloads.s3.cardmarket.com-ot blokkolja, ezt az environment allowlistjére kell tenni vagy csak Actionsben futtatni. A Riftbound idGame és a pontos URL még ellenőrizendő.
3. Szabályzat: külön formátum-oldalak a versenyformátumokhoz: 1v1 (Duel és Match), 2v2, 1v1v1 (több játékos), mindegyikhez a rá vonatkozó Core Rules szakaszok (pl. 487 Duel, 488 Match, 491 2v2, a több játékos szabályai) összefoglalva, Victory Score, setup, battlefieldek, első kör kiegyenlítés. A korábbi ötletek (verziódiff, könyvjelzők) NEM kellenek.
4. Chain: interaktív építő (bal űrlap, jobb Playmat), drag and drop, célzó nyilak, léptetés Mi változott listával és szabályszámmal, Might/damage/hátralévő számolás, combat kiosztás, mistarget és linked instructions, animációk, megosztható link; szabálymotor külön TS modul tesztekkel.
5. How to Play: 10 fejezet + kvíz + interaktív pálya (tartalom ellenőrzés után élesít).
6. Tanulás: szituációk a Playmaton (nagy nézet, Mi változott, unit részletek), haladó leckék. Kártyakvíz, napi feladvány és Chain építőből szituáció NEM kell.
7. Kézikönyv: Fogalmak (tooltip forrás, közérthetőre átírva, kész), Kulcsszavak, Játékmenet ábrák interaktívvá (kör, chain, combat folyamat kattintható lépésekkel), Szabályváltozások és errata összefoglaló előtte/utána nézettel.
8. Közös: Playwright e2e tesztek élesítés előtt; nincs PWA.

## Takarékos módszer (2026-11-19-től)
- Lapállapot: egy lap kész, ha két egymást követő ellenőrzés hibátlannak találta. Csak a javított vagy még nem kész lapok mennek újra (tools/audit/need17.json: 116 lap a 17. körre).
- Kompakt köteg: tools/audit/gen2.py K lista.json kötegszám; a köteg tartalmazza a hivatkozott szabályok szövegét és példáit.
- Szkriptes előszűrés: tools/audit/lint.py az agent-körök előtt.
- Ellenőrző agentek kisebb modellen (sonnet), egyszerre legfeljebb 4-6.

## Állapot 2026-11-19 délután
- KÉSZ: kártya ellenőrzés (mind az 1101 lap két egymást követő hibátlan ellenőrzésen átment, 22. kör: 0 javítás).
- KÉSZ és élesben: How to Play (10 fejezet, 45 kvíz), Tanulás (3 haladó lecke, 8 szituáció).
- Következő: deck építő + Cardmarket árak (allowlist: www.cardmarket.com, downloads.s3.cardmarket.com kell, vagy Actions autodetect), Chain szabálymotor.
