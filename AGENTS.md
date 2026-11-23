# Riftbound HU: áttekintés AI reviewernek

Ez a fájl annak szól, aki (ember vagy AI) először nézi át a projektet. Leírja, mi az oldal, hogyan épül fel, honnan jön az adat, milyen döntések kötik, és hogyan lehet ellenőrizni. A folyamatban lévő munka állapota a `tools/HANDOFF.md`-ben van.

## Mi ez

Riftbound HU: nem hivatalos, rajongói, magyar nyelvű kártya- és szabálykereső a Riftbound (League of Legends TCG) kártyajátékhoz. Készítő: Daneehunter. Élesben: GitHub Pages, repó: `cl-dann/riftbound-rules`, a `main` ág minden pushra deployol (a teljes tesztkör után, `deploy.yml`). Csak böngészős oldal: nincs backend, nincs PWA, nincs offline változat (döntés).

Célközönség: magyar játékosok, kezdőtől a versenyjátékosig. A felület magyar, a játék szakszavai angolul maradnak (unit, chain, resolve, Might, battlefield; a Hunglish szándékos).

Fülek (`web/src/app/router.ts`):

| Hash | Fül | Tartalom |
|---|---|---|
| `#kartyak` | Kártyák | 1101 lap rácsban, a legolcsóbb nyomat normál árával (`#kartya/<slug>` a kártya-ablakot nyitja; megosztható lapoldal: `card/<slug>/`, a kártya-ablak "Link másolása" gombja erre mutat); lapnál hivatalos szöveg, nyomatok árral, Cardmarket keresés linkkel és ártörténet diagrammal (legalább 2 frissítés után), "Melyik legenddel játszható" (103.2.b, 103.3.a.2, 103.3.d, 103.4.a.1, 103.5.b), errata, "Röviden", Gyakori kérdések, lenyitható "Szabályi részletek", kapcsolódó Core Rules szakaszok |
| `#deck` | Deck | deck builder, élő legalitás (Core Rules 103), Cardmarket ár soronként választható nyomattal (alternatív kép, foil, normál; a decklista sorában `[kód foil]` jelöléssel, így a `#d=` link, a mentés és a PDF is látja; jelölés nélkül a legolcsóbb nyomat normál ára), PDF export, megosztható link (`#d=`) |
| `#szabalyok` | Szabályzat | teljes Core Rules kereshetően (`#r-<szám>`), versenyformátum oldalak (`#fmt-<id>`: Duel, Match, FFA3, FFA4, 2v2) |
| `#chain` | Chain | chain építő és elemző: pálya-alapú építés (zónánkénti "+" képes keresővel, lapra kattintva akció-menü legalitással és szabályszámmal, célpont a pályán, pályán kívüli unit vagy gear célpont a zóna + gombjával, Show Off és hatásból kijátszott lap a kézből; kéz, trash és deck tartalma "+" gombbal felvehető, és a lap szövege szerinti kéz-, trash- vagy deckválasztás a pályán vagy a Trash és Deck paklira kattintva, a legális lapok kiemelve), sablonok témánként (`web/src/domain/chain/templates.ts`: counter, Ignored, Negated, trigger sorrend 383.3.d.1, replacement 372, Hidden, lap a trashből, kör vége; unit tesztelve), lépés beszúrása a chain közepére hivatkozás-átszámozással, kör és fázis a pálya fejlécében, keskeny nézetben (max. 700 px) lépés-varázsló alulról felcsúszó panelben (lap, akció ugyanazzal a legalitással, célzás a pályán vékony sávval, extra mezők, Kész; Vissza és Mégse minden lépésnél, "Új lépés" gomb), azonos nevű lapok példányszáma (#1, #2: a board lapjai, majd a kijátszott unitok és gearek lépésrendben; jelvény a lapon, ugyanez a menüben, a célpont-választóban, az idővonalon és az elemzés szövegében, `instNos` a `domain/chain/cs.ts`-ben), élő elemzés, lépés-idővonal, lépésenkénti lejátszás Playmaton, mistarget és linked instructions, combat panel, "Haladó szerkesztés" a teljes űrlappal |
| `#hogyan` | How to Play | 10 fejezetes kezdő útmutató, a learnriftbound.gg felépítését követi |
| `#tanulas` | Practice | 12 interaktív szituáció (akció-menü, célpont modal, fázispanelek, OUTCOME jó és rossz kimenettel), haladó leckék szintenként (`#tanulas/lecke`) |
| `#kezikonyv` | Fogalomtár | fogalmak, kulcsszavak, játékmenet lépésábrák, szabályváltozások, errata előtte/utána |

## Könyvtárszerkezet

```
src/                    Python adat pipeline
  build_data.py         nyers kártya- és szabályadat összefésülése, override rétegek
  export_web.py         web/src/generated/*.json kiírása
  build.sh              teljes adatépítés
  tests/test_export.py  pytest: két futás azonos kimenet, 1101 lap, kötelező kulcsok, index és részletek
  data/                 forrásadatok (cards.json, rules.json, learn.json, formats.json, glossary.json, ...)
  data/audit/           ellenőrző körök kimenetei és javításai (lásd lent)
scripts/                check-dashes.mjs (U+2013/U+2014 tiltás, pre-commit és CI), check-dist.mjs (nincs abszolút /assets/ a dist-ben),
                        card-pages.mjs (a build után: dist/card/<slug>/index.html minden laphoz meta, Open Graph, Twitter card és
                        canonical taggel, átirányítás a #kartya/<slug> útvonalra; sitemap.xml, robots.txt; alap URL: SITE)
web/                    Vite + React 19 + TypeScript + Tailwind v4 frontend
  src/app/              main, App (Shell, lusta nézetek), router (hash -> nézet, régi linkek)
  src/domain/           React és DOM nélküli logika
    data/               store (generált adat, init, élő kötések), load (lusta chunkok: részletek, learn, fontok), schema (zod), cards
    text/               norm, esc, lev, b64
    rules/              szabályszám hivatkozások, fejezetcím, flag címkék
    chain/              Chain elemző: types (közös típusok), text, parser, conditions, actions, steps, cost, zones (lapszöveg értelmezés),
                        engine/ (runChain: ctx (GameObj, ChainItem, EngineCtx típusok), labels, objects, frames, state, triggers, zoneChange, replacement, damage,
                        tokens, execute, targeting, build, resolve (resolveItem0 és lépései), instr (egy utasítás a resolve-kor), endOfTurn,
                        analyze), cs (CS segédek), state (zod séma), link (#c=), templates, examples, overrides (laponkénti kézi hatásleírások), pairs
    combat/ deck/ practice/   combat kiosztás, deck (parse, legality, edit, prices, link), Practice szituáció-motor
  src/render/html/      HTML string kimenetek: card, rules, glossary, deck, knowledge, chainReport (a chain riport és az analyze())
  src/features/         fülek: cards, deck (+ pdf), rules, chain (ChainView, ChainEditor, StepPanel, ActionMenu, CardPicker,
                        PropsPanel, Arrows, MistargetBox, CombatPanel, chainBuild, legacyForm = a Haladó szerkesztés űrlapja,
                        store = zustand, hooks), learn (LearnView, PracticeBoard), knowledge
  src/shared/           ui (Html, CardModal, TipLayer, Printings), board (Playmat), content (Blocks, richText), lib (events, prices, storage)
  src/styles/           index.css, legacy.css, practice.css
  src/generated/        build termék, nincs verziókezelve
  public/prices.json    Cardmarket árak (commitolva, kézzel frissítve)
  unit/                 Vitest: unit tesztek (Core Rules példák, combat, esetek, felismerés, lefedettség, szabályszámok, invariánsok,
                        séma), golden/ (karakterizációs tesztek rögzített dátummal), bench/ (mérések)
  e2e/                  Playwright: funkcionális, a11y (axe), visual (képek CI-ban, __screenshots__), perf
  lint/                 ESLint és dependency-cruiser külön csomagban (TypeScript 6 API), rétegszabályok és baseline
tools/
  HANDOFF.md            munkaállapot, döntések naplója
  learn/scenarios_build.py  a Practice szituációk generátora (src/data/learn.json "scenarios"), kiinduló pályák: learn/scenarios_v1.json
  audit/                ellenőrző körök briefjei és szkriptjei (RBRIEF.md, gen2.py, lint.py, check.py)
  prices/fetch.py       Cardmarket árletöltő; history.py: ártörténet hozzáfűzése
.github/workflows/      tests.yml (teljes tesztkör, workflow_call), e2e.yml (PR és kézi indítás, update-snapshots bemenettel a vizuális
                        baseline-t commitolja), deploy.yml (a tests.yml után build és Pages), prices.yml (kézi árfrissítés)
```

Rétegszabályok (dependency-cruiser, `web/lint/.dependency-cruiser.cjs`, a CI-ban hiba): körkörös import nincs; a domain csak domaint és a
generált adatot importál, Reactot nem; a render csak domaint; a shared domaint és rendert; egy feature nem importál másik feature-t és az
appot; az app bármit. A sértések száma 0 (`lint/known-violations.json` üres).

## Adat pipeline

1. **Nyers adat:** `src/data/cards.json` (a hivatalos Card Gallery közösségi pillanatképe, 2026-11-12), `src/data/rules.json` (Core Rules 2026-10-09, angol eredeti, módosítás nélkül, `ex` mezőben a szabályok példái).
2. **Override rétegek a `build_data.py`-ban**, ebben a sorrendben érvényesülnek:
   - kézi rövid leírások és jegyzetek (notes, short), batch szinten;
   - ellenőrző körök javításai: `src/data/audit/r*_out.json`, numerikus sorrendben;
   - `notes_patch.json`: idempotens szövegcserék;
   - `src/data/audit/printed.json`: a nyomtatott lapképről leolvasott adatok (tagek, szövegjavítás, Equipment hatás), ahol a Riot adatfeed hibás;
   - Gyakori kérdések: `src/data/audit/qa_NN.json`.
3. **Export:** `export_web.py` a `web/src/generated/` alá: `cards.json` (index), `cards-detail.json` (`nt`, `qa`, `sh`, `pr`, azonos sorrendben, a frontend lustán tölti, `loadDetails()`), `rules.json`, `meta.json`, `learn.json`, `formats.json`, `fonts.json`. A sémák a `web/src/domain/data/schema.ts`-ben (zod), a `unit/sema.test.ts` ellenőrzi őket.

Kártyamezők a generált `cards.json` és `cards-detail.json` fájlban (rövid kulcsok): `n` név, `t` típus, `st` supertype, `d` domain, `tg` tagek, `e` Energy, `p` Power, `m` Might, `txt` hatályos szöveg, `old` nyomtatott szöveg (ha van errata), `err` errata cikk indexe, `sh` rövid magyar leírás, `nt` jegyzetek, `qa` Gyakori kérdések, `tp` kapcsolódó szabálytémák, `ban` tiltás.

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

`tools/prices/fetch.py` a Cardmarket publikus product catalog és price guide letöltéséből dolgozik (`downloads.s3.cardmarket.com`). A Riftbound `idGame` értéke 22, a szkript ismert lapnevekből detektálja. Névenként a legolcsóbb nyomat 1 és 7 napos átlaga (`avg1`, `avg7`) kerül a `web/public/prices.json`-ba. Signature lapoknál a Cardmarket a champion nevét elhagyja, a frontend erre visszaesik (`web/src/domain/deck/edit.ts`, `priceOf`).

Frissítés kézzel: GitHub, Actions, "Cardmarket árak", Run workflow. Ez commitolja az árfájlt és az ártörténetet, majd elindítja a deployt. Ártörténet: `web/public/price-history.json` (`tools/prices/history.py`): minden futás hozzáfűzi a napot (azonos napon felülír), nyomatonként a normál és a foil 7 napos átlagot euró centben, delta kódolva; frissítésenként kb. 6 és 8 KB (gzip kb. 3 KB), a kártya-ablak lustán tölti. A Cardmarket link keresésre mutat a lap nevével, mert az idProduct alapú termék-URL a nyilvános adatokból nem igazolható. A fejléc mutatja a dátumot, 7 nap után "frissítés esedékes" jelzéssel. Heti időzítés a `prices.yml`-ben kikommentezve.

## Futtatás és ellenőrzés

```
python3 -m pytest src/tests                   # adatépítés kétszer (determinisztikus), web/src/generated/*.json; ártörténet kódolás;
                                              # árletöltő párosítás mentett Cardmarket mintán (src/tests/fixtures/cardmarket)
ruff check src/ tools/
cd web && npm ci && npm run lint:install      # függőségek (a lint/ külön csomag)
npm run build                                 # tsc -b (a domain külön, strict tsconfiggal), vite build, lapoldalak, check-dist
npm run lint                                  # ESLint (bulk suppression baseline: eslint-suppressions.json) és dependency-cruiser
npx knip                                      # nem használt fájl és dependency (exportok csak figyelmeztetés)
npm run test:unit                             # Vitest: unit (457) és golden (66) projekt, 523 teszt
npm run test:e2e                              # Playwright, 43 teszt (34 funkcionális, 9 axe nézet)
VISUAL=1 npx playwright test --project=visual-1300 --project=visual-390   # 24 kép, csak CI-ban hasonlít (ubuntu)
npm run bench                                 # analyze(), tryStep, targetOpts, setupFrame, zoneCands, filterCards, glossify
npm run perf                                  # kezdő letöltés, első tile, long taskok (4x CPU)
npm run golden:capture                        # a unit tesztek analyze() bemeneteinek újragyűjtése (unit/golden/cases.json)
```

A golden tesztek (`unit/golden/`) a chain elemzés teljes kimenetét, a kártya HTML-t, a deck ellenőrzést, a régi linkeket és a határokat
(#c=, #d=, rb-deck, rb-view2, prices.json) rögzítik: refaktor után byte-azonosnak kell maradniuk; szándékos változásnál
`npx vitest run --project golden -u`. A vizuális baseline a CI-ban készül: GitHub, Actions, "Tesztek", Run workflow, update-snapshots.

Függvényméret: az engine-ben egyetlen függvény sem hosszabb 80 sornál; kivétel csak az install<Csoport>() modulkeret, ami a csoport
függvényeit rendeli az EngineCtx-hez.

Típusosság: egyik fájlban sincs `@ts-nocheck`, explicit `any` nincs (a domain strict tsconfiggal fordul), az ESLint baseline-ban 10
suppression marad (no-useless-assignment 6, no-unused-vars 2, no-constant-condition 1, no-constant-binary-expression 1). Új kódba ne
kerüljön any vagy suppression; a baseline csak fogyhat (`eslint src --prune-suppressions`).

Megjegyzés: `npx tsc --noEmit -p .` nem azonos a CI-vel, mindig `npm run build`-del ellenőrizz. Ahol a Playwright saját böngészője nem tölthető le, a rendszer Chrome-ja megadható: `PW_CHROME=/usr/bin/google-chrome npm run test:e2e`. A commit előtti hook (`.githooks/pre-commit`, a `npm ci` bekapcsolja) a kötőjel-ellenőrzést futtatja.

## Ismert korlátok

- **Chain elemzés:** a lapszöveg utasításokra bontása, a műveletfelismerés és a linked instruction felismerése szöveges heurisztika (`web/src/domain/chain/`: parser, actions, conditions, engine), amit laponkénti kézi hatásleírások egészítenek ki (`web/src/domain/chain/overrides.ts`: lapnév, illeszkedő utasítás, művelet, egymondatos leírás, szabályszámok, szükség esetén mező alapértékkel). Mind az 1101 lap utasításain mérve (`unit/lefedettseg.test.ts`, a teszt őrzi): 0 nem felismert és 0 bizonytalan utasítás (az előző commitban 17,6%, a legelső változatban 65%). 31 utasítás "adatot kér", csak rejtett információ miatt (kéz, deck, felfedett lap, builderen kívüli előzmény): ezeknél a lapnál kis mező jelenik meg, alapértékkel és kiírt feltételezéssel; közülük 29 a pályás építőben megadott lapokból is kiértékelődik (a deck felső lapjai, a kéz, az eldobott, felfedett, égetett vagy hatásból kijátszott lap), csak Jhin, Virtuoso (a korábban vele banishelt spellek, builderen kívüli előzmény) és Twisted Fate, Gambler (a Rune Deck felső rune-ja; a builder a Rune Decket csak darabszámként ismeri) marad mezős. Kéz, deck és trash: a lépés `zp` mezője az utasításonként választott lapokat tárolja (`domain/chain/zones.ts`: `zoneRefOf`, `zoneCheck`); a trashből választott lap célpont, a lerakáskor dől el (355.10.a, 355.9.a, 355.8), és ha a resolve előtt elhagyja a trasht vagy új objektumként tér vissza, Ignored (359.3.e.4, 359.3.e.5, 359.3.e.6); a kézből és a deckből választás nem célpont, a resolve-kor történik (355.10.a, 355.18), és ha a lap már nincs ott, az utasítás Negated (levezetés; ha a lap típust ír elő, nyitott kérdés, flag 2, mert a 128.6.a ezt "Ignored"-nak nevezi); a deck felső lapja a felhasználó feltételezése (108.4.e, 128.3). A kéz, trash és deck csak akkor kerül az elemzésbe, ha a helyzet megadja (a korábbi esetek eredménye változatlan, `unit/zonak.test.ts`). A kéz, trash és deck lapjai állandó azonosítót kapnak (`{id, n}`, új lapnál `z<zóna><játékos>_<sorszám>`, ami nem ismétlődik); a kiválasztás erre mutat, zónaváltáskor az azonosító követi a lapot, a 359.3.e.4 szerinti új objektumot generációszám jelzi. Törölt lapra mutató kiválasztásnál a lépés hiányos ("nincs megadva"), más lap nem kerül a helyére. A régi, névlistás és sorszámos (`zhA0`) helyzetek betöltéskor (`normZones`) ugyanazt az azonosítót kapják, az elemzés azonos (`unit/koltseg.test.ts`). Költségfeltétel (`costCondOf`, `costCheck`): a nyomtatott Energy és Power számít (131.2.a, 131.3.a, 206, 356.1.c), a költségcsökkentés, növelés, "ignoring its cost", az Accelerate és a Repeat nem (206, 805.1); a token költsége 0 (185.3.a.1); a hiányzó Power rész 0 (131.3.b, levezetés). Ellenőrzés: trash célpontnál és boardon vagy chainen lévő célpontnál a lerakáskor (nem szabályos lépés), kéznél, decknél és a név szerint megadott kijátszásnál a resolve-kor (Negated, 206); Show Off a kijátszáskor (832.1.c). Felismert alakok 20 lapon: Defy, Fate Weaver, Fizz, Glasc Mixologist, Heedless Resurrection, Hush, Jayce, Kai'Sa, Nasus, Noxian Demolitionist, Pickpocket, Rebuttal, Rell, Remember the Fallen, Rousing Display, Spectral Matron, Stalwart Goatherd, Tail-Cloaked Matriarch, Trifarian Captain, Undying Loyalty. A kijátszott lap költségére figyelő triggerek (Lux, Illuminated; Lux, Lady of Luminosity; Forbidden Technique; Meticulous Restorationist; Sanctum Conservator; Yordle Explorer; Nasus) csak a feltételnek megfelelő nyomtatott költségre triggerelnek, az indok a sorban (206, a Lux és Sky Splitter példa); a trashben lévő "play this/me from your trash" trigger is figyel, és a lap a trashből kerül kijátszásra. "From among them" (Fate Weaver, Trifarian Captain, Ornn, Rift Herald, Ivern, Double Trouble, Command: Attack, Lightning Rush, Stacked Deck, Reinforce, Wild Claw, Baited Hook, Rek'Sai, Blind Fury, Drakehound Packmaster): a megnézett lapok a Deck panelben megadott felső lapok (rejtett adat, 128.4, 108.4.e), a választás a resolve-kor (355.18) típus- és költségfeltétellel, a többi recycle a deck aljára (417) vagy a lapszöveg szerint a trashbe (108.2); lap megadása nélkül a korábbi viselkedés marad. Változó a feltételben: a forrás Mightja a végrehajtáskor nézendő (359.3.f.2), ha a forrás már nincs a boardon, null, az utasítás Ignored (359.3.e.12); a megölt unit költsége visszatekintéssel (359.3.e.13); a pontszám a Játékállapot mezőjéből, kiírt feltételezéssel (alap 0). Nasus az ability aktiválására is figyel, az ability alapköltségével (206.1); az Empower activated abilityként aktiválható (827.1, 827.1.b, a lista végén, a korábbi ability-indexek nem változnak). Baited Hook: a választott unit nyomtatott Mightja legfeljebb a megölt unit Mightja + 1, visszatekintéssel (359.3.e.13); ha nem elérhető, null (359.3.e.12). Többjátékos választás (355.10.e, 412.1): Promising Future (játékosonként egy banishelt lap a saját felső lapjai közül, utána a következő játékostól kezdve kijátszás Energy költség nélkül, 420.3, 356.1.b.2), Divine Judgment (játékosonként a megadott számú unit, gear és kézben lévő lap marad, a többi recycle, 417; a rune-ok választását a builder nem követi, mert csak rune-számot ismer), Mechanical Bandit (a két felfedett felső lap költsége dönt; egyenlő költségnél nyitott kérdés, flag 2, az elemzés igennel számol). Lap megadása nélkül a korábbi viselkedés marad. A "from among them" minden felismert lapra unit tesztelt (`unit/among.test.ts`). 6 utasítás nyitott kérdés (flag 2, judge dönt): az "excess damage" feltételek (Sivir, Ambitious; Trapping Grounds; Tryndamere, Barbarian; Vi, Piltover Enforcer; Yeti Brawler), mert a Core Rules a fogalmat nem definiálja, és Orianna, Lady of Clockwork lejárat utáni battlefield helyzete (391.5.b, 178.1.a.1, 143.5.b; levezetés: 323.6 recall). A feltételek játékállapotból értékelődnek ki: XP, pontszám, rune-ok, Rune Deck, korábbi kijátszások (a builder "Játékállapot" kezdőértékei plusz a lépésekből számolt változások), attacker jelölés, battlefield facedown lapja, Show Off, fázis. Követett: Choose one, Repeat (820.1.d.1, 820.2.a, második mód választható), Show Off (832.1.d.1), "for each" szorzó, Prevent, duplázás, replacement "instead", osztott damage (355.14), összesített Might részhalmaz (355.11.b, lapnál választható, alapból a legtöbb célpont), a célozhatatlanság chain közbeni megszűnése (758.2, 758.2.a), spell és ability is célpont (Repulse, 359.3.e.9.a számolással), token létrehozás (350.2, 440.2, Renata és "enter ready" hatások), a trigger feltételéből feljegyzett location (359.3.f.3), "each player chooses" választás játékosonként (412.1), kijátszás hatásból (420.3), újrakijátszás (359.3.e.4), reflexív trigger (388), kontrollváltás és visszaadás. Lépéstípusok: "Resolve" (a chain teteje most lefut, 340.1) és "Kör vége" (Ending Step a delayed "at end of turn" és "At the end of your turn" triggerekkel, 383.2.a.1 intervening if; utána Expiration Step a 323 sorrendjében: lethal halál, heal, a "this turn" hatások és a stun lejárnak (424.1.a.2), új chain elemnél újrakezdés (317.2.f)). A "When you play me, if X" és a "When you play me from face down" play triggerek feltétele a kijátszáskor dől el (383.2.a.1); a Repeat több költsége több végrehajtást ad (Curtain Call). Triggerek: a "When you play a spell" a spell resolve-jakor triggerel, counter esetén nem (420.4.a, 420.4.a.1); az egyszerre triggerelőket a turn player teszi fel először (383.3.d.1); a halálra figyelő triggerek közül a "When another/a (friendly/enemy) unit dies" alak követett. A pakli műveletek, XP és pont változások megnevezettek, a Playmaton nem látszanak. Nyitott kérdés, amit a felület így jelez: minden damage-et megelőző unit kötelező kiosztása combatban (467.2.c.10 példa).
- **Chain korlátleltár:** `unit/leltar.ts` minden lap minden utasításforrását egyszerű pályán lefuttatja, és összegyűjti, ahol az elemzés kimondja, hogy valamit nem követ; a `unit/korlatkorok.test.ts` a maradék listát rögzíti (körönként szűkül), és a javított korlátokat valós lapokkal teszteli. Feltétel-tagmondat ("if", "unless", "while" a mondatrész elején) kifejezése nem célpont (355.10.b, 355.10.c, levezetés): Hold 'Em, Spoils of War, Isolate, Shadow Dash, Crumbling Sands és a többi feltételes költségcsökkentés nem kér hamis célpontot; a régi `#c=` linkek hosszabb célpont-listáját betöltéskor a `migrateTg` (`domain/chain/cs.ts`) a régi felismerés feltétel-helyeinek kihagyásával írja át. Firelights' Hideout: a következő kijátszott unit Accelerate-et kap (805.1.b, 805.6), a kijátszáskor, nem a belépéskor; a builderben a conquer trigger a combat utáni lépés, ezért ugyanabban a helyzetben unit utána nem játszható ki. Copy effectek (446.1, 479.1.b, 479.1.b.1, 479.1.c; `copyOnto`, `equipCopy` a `engine/tokens.ts`-ben): a másolat a forrás nyomtatott (vagy maga is másolt, tokennél a létrehozáskori) jellemzőit kapja (név, Might, szöveg, keywordök), a forrás Might módosításai, buffja, damage-e és kapott keywordjei nem másolódnak; a token token marad, a play effect nem fut le. Mirror Image (a választott unit; mistargetnél a copy és a [Temporary] Ignored, 359.3.e.14.a), Keeper of Masks ("copies of me"; ha a forrás már nincs a boardon, Ignored, 359.3.f.2), LeBlanc, Deceiver (a token a conquer vagy hold battlefieldjén, 359.3.f.3, egy ott álló másik unit másolata; a "there" célpont-feltétel is a feljegyzett location), a "Give it [Temporary]" a másolattá vált tokené. Zilean, Time Mage: battlefielden körönként egyszer a token mellé egy további másolat (369.1, 446.3; "you may", az elemzés úgy számol, hogy él vele). Shady Spectacles: az Equip lépés 2. (választható) helye a másolandó másik friendly unit; a felcsatolt unit a másolata, amíg az Equipment rajta van, a cleanup a csatolás végén visszaállítja (a választás a lépésben adható meg, a resolve-kor ellenőrzött). Svellsongur: a csatolt unit szövege az Equipment Effect Textje, így a unit triggerei kétszer szerepelnek a trigger listában (435.1.d). Rejtett adat a megadott lapokból: Ivern ("revealed a Bird, Cat, Dog, or Poro": a felfedett unit tagjei), Ava Achiever és Rek'Sai, Swarm Queen ("If it's a unit, play it here": a hatásból kijátszott unit a forrás helyére kerül), Pakaa Protector és Apprentice Smith ("Otherwise": trash vagy recycle, az " and " folytatás is az ág része), Ravenbloom Conservatory, Forgotten Relic ([Burn 1] a felső lapot a trashbe teszi, a reflexív hatás csak unitnál, annak Mightjával), Teemo, Strategist (a felfedett 5 lap [Hidden] lapjai, utána recycle), Scrutinizing Scope (az ellenfél tippje a lapnál, a felfedett lap típusa dönt; a felfedés nem recycle-öl előre), Gutter Palace (a megadott kéz mérete, 128.4), Invert Timelines (mindkét játékos eldobja a megadott kezét, 423.1, majd mindkettő húz), Divine Judgment (a rune-ok száma a megtartottra csökken, a többi recycle, 417; a megtartott rune-ok domainjét a builder nem ismeri), Drakehound Packmaster és Clocktower Guardian (a banishelt felső lap kijátszása; a lépés nélküli, automatikus trigger is látja a deck megadott felső lapjait). A feltétel szövege egyszer jelenik meg (korábban a pályás építőben megadott lapnál kétszer).
- **Combat panel:** a feltételes vagy kapott keywordöket, a megelőzést és a helyettesítést javaslatként mutatja, ezeket a felhasználó kapcsolja be. A combat a chain modellen kívül fut.
- **Áthúzás a Playmaton:** érintőképernyőn koppintásos mozgatással működik, a HTML5 drag csak egérrel.
- **Cardmarket:** a legújabb kiadás lapjainak egy része még nincs a Cardmarket listájában, ezeknél nincs ár.
- **Kártyaadat:** közösségi pillanatkép, új kiadásnál frissíteni kell a `src/data/cards.json`-t, és az új lapok short, notes és Q&A tartalma ellenőrző körökön kell átmenjen.

## Jogi

Riot Games "Legal Jibber Jabber" policy alapján készült rajongói oldal, a Riot nem támogatja és nem hagyta jóvá. A kártyaképek a Riot hivatalos szerveréről töltődnek be. A lábléc megnevezi, hogy a kód és a magyarázatok AI segítségével készültek.
