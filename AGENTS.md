# Riftbound HU: áttekintés AI reviewernek

Ez a fájl annak szól, aki (ember vagy AI) először nézi át a projektet. Leírja, mi az oldal, hogyan épül fel, honnan jön az adat, milyen döntések kötik, és hogyan lehet ellenőrizni. A folyamatban lévő munka állapota a `tools/HANDOFF.md`-ben van.

## Mi ez

Riftbound HU: nem hivatalos, rajongói, magyar nyelvű kártya- és szabálykereső a Riftbound (League of Legends TCG) kártyajátékhoz. Készítő: Daneehunter. Élesben: GitHub Pages, repó: `cl-dann/riftbound-rules`, a `main` ág minden pushra deployol. Csak böngészős oldal: nincs backend, nincs PWA, nincs offline változat (döntés).

Célközönség: magyar játékosok, kezdőtől a versenyjátékosig. A felület magyar, a játék szakszavai angolul maradnak (unit, chain, resolve, Might, battlefield; a Hunglish szándékos).

Fülek (`web/src/router.ts`):

| Hash | Fül | Tartalom |
|---|---|---|
| `#kartyak` | Kártyák | 1101 lap rácsban; lapnál hivatalos szöveg, errata, "Röviden", Gyakori kérdések, lenyitható "Szabályi részletek", kapcsolódó Core Rules szakaszok |
| `#deck` | Deck | deck builder, élő legalitás (Core Rules 103), Cardmarket ár, PDF export, megosztható link (`#d=`) |
| `#szabalyok` | Szabályzat | teljes Core Rules kereshetően (`#r-<szám>`), versenyformátum oldalak (`#fmt-<id>`: Duel, Match, FFA3, FFA4, 2v2) |
| `#chain` | Chain | chain építő és elemző: pálya-alapú építés (zónánkénti "+" képes keresővel, lapra kattintva akció-menü legalitással és szabályszámmal, célpont a pályán, pályán kívüli unit vagy gear célpont a zóna + gombjával, Show Off és hatásból kijátszott lap a kézből), sablonok témánként (`web/src/legacy/chainTemplates.ts`: counter, Ignored, Negated, trigger sorrend 383.3.d.1, replacement 372, Hidden, kör vége; unit tesztelve), lépés beszúrása a chain közepére hivatkozás-átszámozással, kör és fázis a pálya fejlécében, élő elemzés, lépés-idővonal, lépésenkénti lejátszás Playmaton, mistarget és linked instructions, combat panel, "Haladó szerkesztés" a teljes űrlappal |
| `#hogyan` | How to Play | 10 fejezetes kezdő útmutató, a learnriftbound.gg felépítését követi |
| `#tanulas` | Practice | 12 interaktív szituáció (akció-menü, célpont modal, fázispanelek, OUTCOME jó és rossz kimenettel), haladó leckék szintenként (`#tanulas/lecke`) |
| `#kezikonyv` | Fogalomtár | fogalmak, kulcsszavak, játékmenet lépésábrák, szabályváltozások, errata előtte/utána |

## Könyvtárszerkezet

```
src/                    Python adat pipeline
  build_data.py         nyers kártya- és szabályadat összefésülése, override rétegek
  export_web.py         web/src/generated/*.json kiírása
  build.sh              teljes adatépítés
  data/                 forrásadatok (cards.json, rules.json, learn.json, formats.json, glossary.json, ...)
  data/audit/           ellenőrző körök kimenetei és javításai (lásd lent)
web/                    Vite + React 19 + TypeScript + Tailwind v4 frontend
  src/views/            fülenkénti nézetek
  src/components/       Playmat (pálya, Chain), PracticeBoard (Practice pálya), practiceEngine.ts (szituáció-motor, React nélkül), CombatPanel, CardModal, TipLayer
  src/legacy/           imperatív modulok (core.ts: kártya HTML, deck legalitás, PDF; chain.ts: chain builder (DOM) és lépésszerkesztő segédek; components/chainBuild.ts: pálya-alapú építés logikája (akció-menü, legalitás egy analyze() másolaton, hivatkozás-átszámozás); chainCore.ts: DOM nélküli chain elemző; knowledge.ts: Fogalomtár)
  src/components/combatCore.ts  combat damage kiosztás szabálylogikája (React nélkül)
  src/generated/        build termék, nincs verziókezelve
  public/prices.json    Cardmarket árak (commitolva, kézzel frissítve)
  e2e/app.spec.ts       Playwright tesztek
  unit/                 Vitest unit tesztek: Core Rules hivatalos példái (hivatalos.test.ts), combat (combat.test.ts), beépített és korábbi esetek, felismerés, lefedettség, szabályszám-ellenőrzés
tools/
  HANDOFF.md            munkaállapot, döntések naplója
  learn/scenarios_build.py  a Practice szituációk generátora (src/data/learn.json "scenarios"), kiinduló pályák: learn/scenarios_v1.json
  audit/                ellenőrző körök briefjei és szkriptjei (RBRIEF.md, gen2.py, lint.py, check.py)
  prices/fetch.py       Cardmarket árletöltő
.github/workflows/      deploy.yml (build és Pages), e2e.yml (Playwright), prices.yml (kézi árfrissítés)
```

## Adat pipeline

1. **Nyers adat:** `src/data/cards.json` (a hivatalos Card Gallery közösségi pillanatképe, 2026-11-12), `src/data/rules.json` (Core Rules 2026-10-09, angol eredeti, módosítás nélkül, `ex` mezőben a szabályok példái).
2. **Override rétegek a `build_data.py`-ban**, ebben a sorrendben érvényesülnek:
   - kézi rövid leírások és jegyzetek (notes, short), batch szinten;
   - ellenőrző körök javításai: `src/data/audit/r*_out.json`, numerikus sorrendben;
   - `notes_patch.json`: idempotens szövegcserék;
   - `src/data/audit/printed.json`: a nyomtatott lapképről leolvasott adatok (tagek, szövegjavítás, Equipment hatás), ahol a Riot adatfeed hibás;
   - Gyakori kérdések: `src/data/audit/qa_NN.json`.
3. **Export:** `export_web.py` a `web/src/generated/` alá: `cards.json`, `rules.json`, `meta.json`, `learn.json`, `formats.json`, `fonts.json`.

Kártyamezők a generált `cards.json`-ban (rövid kulcsok): `n` név, `t` típus, `st` supertype, `d` domain, `tg` tagek, `e` Energy, `p` Power, `m` Might, `txt` hatályos szöveg, `old` nyomtatott szöveg (ha van errata), `err` errata cikk indexe, `sh` rövid magyar leírás, `nt` jegyzetek, `qa` Gyakori kérdések, `tp` kapcsolódó szabálytémák, `ban` tiltás.

Jegyzet formátum (`nt`): `[szabályszámok vesszővel, flag, szöveg]`. Flag: 0 = a Core Rules kimondja, 1 = levezetés a szabályból és a lapszövegből, 2 = nyitott kérdés, judge dönt. A Q&A formátum: `[kérdés, válasz, szabályszámok]`.

## Tartalom minősége és ellenőrzési módszer

- **Kártya rövid leírás és jegyzetek:** 22 ellenőrző kör agentekkel, a briefek a `tools/audit/RBRIEF.md`-ben. Kész kritérium: két egymást követő kör nem talál hibát. Ez mind az 1101 lapra teljesült (a 22. kör 0 javítás).
- **Gyakori kérdések:** 3940 kérdés-válasz pár, generálva a már ellenőrzött short és notes alapján, utána egy ellenőrző kör (kb. 260 javítás, 0 törlés). Második ellenőrző kör még nem futott.
- **Practice szituációk:** adatvezérelt motor (`practiceEngine.ts`): a menüpontok legalitását a Core Rules szerint számolja (Standard Move 144, a lap sebessége és a turn állapota 308.1.a, 309.1.a, költség 164.2), a lépések sorrendjét őrzi, a rossz döntés OUTCOME panelt ad optimális sorral. A `unit/practice.test.ts` minden szituáció elvárt sorát végigjátssza, és ellenőrzi a kimeneteket, szabályszámokat, lapneveket.
- **How to Play, Practice, formátum oldalak:** saját szöveg a Core Rules alapján, minden állítás mellett szabályszám (`{{szám}}` jelölés). Minden hivatkozott szabályszám létezik a `rules.json`-ban (gépi ellenőrzés, 2026-11-19).
- Mérvadó forrás mindig a `rules.json` szövege és a lap hivatalos szövege. A `RBRIEF.md` "Ismert, ellenőrzött tények" része sorolja fel azokat a pontokat, amelyeket korábban tévesen hibának jelöltek.

## Stílus és tartalmi szabályok (a megrendelő kéri, reviewnál ezt is nézd)

- Em-dash és en-dash TILOS mindenhol: UI szövegben, adatban, kódkommentben. Kivétel: a lapok hivatalos angol szövege (`txt`), mert az szó szerinti idézet.
- Nincs marketinges cím vagy szöveg ("Tanuld meg...", "Gyakorolj és mélyülj el" jellegű címek tilosak).
- How to Play és Practice: nincs kvíz, nincs "Elolvastam" gomb, nincs haladásszámláló. A "4 / 10" pozíciójelző megengedett.
- Nem szükséges funkciók (döntés, ne javasold újra): PWA, kártyakvíz, napi feladvány, húzási valószínűség, mintakéz, szabályzat verziódiff, könyvjelzők, Chainből szituáció.
- Árak EUR-ban.

## Fontosabb szabályértelmezési döntések

- Mistarget: illegális célpont miatt elmaradó utasítás Ignored, más okból elmaradó Negated (359.3.e.6). Ignored után a későbbi linked instruction is Ignored, Negated után végrehajtódik (359.3.e.14.a, 359.3.e.14.b).
- Weaponmaster [C] Equip költség csökkenthetősége: nyitott kérdés (821.1.c.3, flag 2).
- Általános "[A] less" csökkentés a [C] költséget is csökkenti (356.4.f.1 példa).
- Célpont nélküli trigger chainre kerül, majd lekerül (403.4); intervening "if" esetén nem triggerel.
- Keyword nélküli spell, activated ability és Hide csak saját körben, showdownon kívül (310.1.a, 411.1.a).

## Cardmarket árak

`tools/prices/fetch.py` a Cardmarket publikus product catalog és price guide letöltéséből dolgozik (`downloads.s3.cardmarket.com`). A Riftbound `idGame` értéke 22, a szkript ismert lapnevekből detektálja. Névenként a legolcsóbb nyomat 1 és 7 napos átlaga (`avg1`, `avg7`) kerül a `web/public/prices.json`-ba. Signature lapoknál a Cardmarket a champion nevét elhagyja, a frontend erre visszaesik (`web/src/views/deckEdit.ts`, `priceOf`).

Frissítés kézzel: GitHub, Actions, "Cardmarket árak", Run workflow. Ez commitolja az árfájlt és elindítja a deployt. A fejléc mutatja a dátumot, 7 nap után "frissítés esedékes" jelzéssel. Heti időzítés a `prices.yml`-ben kikommentezve.

## Futtatás és ellenőrzés

```
cd src && python3 build_data.py && python3 export_web.py; rm -f data.json
cd ../web && npm ci && npm run build          # tsc -b szigorú: a nem használt változó is hiba
npx vite preview --port 4173                  # előnézet
npm run test:unit                             # Vitest, a chain elemző és a combat kiosztás (a generált adatot használja)
npm run test:e2e                              # Playwright, 21 teszt
```

Megjegyzés: `npx tsc --noEmit -p .` nem azonos a CI-vel, mindig `npm run build`-del ellenőrizz. Ahol a Playwright saját böngészője nem tölthető le, a rendszer Chrome-ja megadható: `PW_CHROME=/usr/bin/google-chrome npm run test:e2e`.

## Ismert korlátok

- **Chain elemzés:** a lapszöveg utasításokra bontása, a műveletfelismerés és a linked instruction felismerése szöveges heurisztika (`chainCore.ts`), amit laponkénti kézi hatásleírások egészítenek ki (`src/legacy/cardRules.ts`: lapnév, illeszkedő utasítás, művelet, egymondatos leírás, szabályszámok, szükség esetén mező alapértékkel). Mind az 1101 lap utasításain mérve (`unit/lefedettseg.test.ts`, a teszt őrzi): 0 nem felismert és 0 bizonytalan utasítás (az előző commitban 17,6%, a legelső változatban 65%). 32 utasítás "adatot kér", csak rejtett információ miatt (kéz, deck, felfedett lap, builderen kívüli előzmény): ezeknél a lapnál kis mező jelenik meg, alapértékkel és kiírt feltételezéssel. 6 utasítás nyitott kérdés (flag 2, judge dönt): az "excess damage" feltételek (Sivir, Ambitious; Trapping Grounds; Tryndamere, Barbarian; Vi, Piltover Enforcer; Yeti Brawler), mert a Core Rules a fogalmat nem definiálja, és Orianna, Lady of Clockwork lejárat utáni battlefield helyzete (391.5.b, 178.1.a.1, 143.5.b; levezetés: 323.6 recall). A feltételek játékállapotból értékelődnek ki: XP, pontszám, rune-ok, Rune Deck, korábbi kijátszások (a builder "Játékállapot" kezdőértékei plusz a lépésekből számolt változások), attacker jelölés, battlefield facedown lapja, Show Off, fázis. Követett: Choose one, Repeat (820.1.d.1, 820.2.a, második mód választható), Show Off (832.1.d.1), "for each" szorzó, Prevent, duplázás, replacement "instead", osztott damage (355.14), összesített Might részhalmaz (355.11.b, lapnál választható, alapból a legtöbb célpont), a célozhatatlanság chain közbeni megszűnése (758.2, 758.2.a), spell és ability is célpont (Repulse, 359.3.e.9.a számolással), token létrehozás (350.2, 440.2, Renata és "enter ready" hatások), a trigger feltételéből feljegyzett location (359.3.f.3), "each player chooses" választás játékosonként (412.1), kijátszás hatásból (420.3), újrakijátszás (359.3.e.4), reflexív trigger (388), kontrollváltás és visszaadás. Lépéstípusok: "Resolve" (a chain teteje most lefut, 340.1) és "Kör vége" (Ending Step a delayed "at end of turn" és "At the end of your turn" triggerekkel, 383.2.a.1 intervening if; utána Expiration Step a 323 sorrendjében: lethal halál, heal, a "this turn" hatások és a stun lejárnak (424.1.a.2), új chain elemnél újrakezdés (317.2.f)). A "When you play me, if X" és a "When you play me from face down" play triggerek feltétele a kijátszáskor dől el (383.2.a.1); a Repeat több költsége több végrehajtást ad (Curtain Call). Triggerek: a "When you play a spell" a spell resolve-jakor triggerel, counter esetén nem (420.4.a, 420.4.a.1); az egyszerre triggerelőket a turn player teszi fel először (383.3.d.1); a halálra figyelő triggerek közül a "When another/a (friendly/enemy) unit dies" alak követett. A pakli műveletek, XP és pont változások megnevezettek, a Playmaton nem látszanak. Nyitott kérdés, amit a felület így jelez: minden damage-et megelőző unit kötelező kiosztása combatban (467.2.c.10 példa).
- **Combat panel:** a feltételes vagy kapott keywordöket, a megelőzést és a helyettesítést javaslatként mutatja, ezeket a felhasználó kapcsolja be. A combat a chain modellen kívül fut.
- **Áthúzás a Playmaton:** érintőképernyőn koppintásos mozgatással működik, a HTML5 drag csak egérrel.
- **Cardmarket:** a legújabb kiadás lapjainak egy része még nincs a Cardmarket listájában, ezeknél nincs ár.
- **Kártyaadat:** közösségi pillanatkép, új kiadásnál frissíteni kell a `src/data/cards.json`-t, és az új lapok short, notes és Q&A tartalma ellenőrző körökön kell átmenjen.

## Jogi

Riot Games "Legal Jibber Jabber" policy alapján készült rajongói oldal, a Riot nem támogatja és nem hagyta jóvá. A kártyaképek a Riot hivatalos szerveréről töltődnek be. A lábléc megnevezi, hogy a kód és a magyarázatok AI segítségével készültek.
