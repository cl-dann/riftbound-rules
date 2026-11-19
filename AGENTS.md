# Riftbound szabálykereső: áttekintés AI reviewernek

Ez a fájl annak szól, aki (ember vagy AI) először nézi át a projektet. Leírja, mi az oldal, hogyan épül fel, honnan jön az adat, milyen döntések kötik, és hogyan lehet ellenőrizni. A folyamatban lévő munka állapota a `tools/HANDOFF.md`-ben van.

## Mi ez

Nem hivatalos, rajongói, magyar nyelvű szabálykereső a Riftbound (League of Legends TCG) kártyajátékhoz. Készítő: Daneehunter. Élesben: GitHub Pages, repó: `cl-dann/riftbound-rules`, a `main` ág minden pushra deployol. Csak böngészős oldal: nincs backend, nincs PWA, nincs offline változat (döntés).

Célközönség: magyar játékosok, kezdőtől a versenyjátékosig. A felület magyar, a játék szakszavai angolul maradnak (unit, chain, resolve, Might, battlefield; a Hunglish szándékos).

Fülek (`web/src/router.ts`):

| Hash | Fül | Tartalom |
|---|---|---|
| `#kartyak` | Kártyák | 1101 lap rácsban; lapnál hivatalos szöveg, errata, "Röviden", Gyakori kérdések, lenyitható "Szabályi részletek", kapcsolódó Core Rules szakaszok |
| `#deck` | Deck | deck builder, élő legalitás (Core Rules 103), Cardmarket ár, PDF export, megosztható link (`#d=`) |
| `#szabalyok` | Szabályzat | teljes Core Rules kereshetően (`#r-<szám>`), versenyformátum oldalak (`#fmt-<id>`: Duel, Match, FFA3, FFA4, 2v2) |
| `#chain` | Chain | chain építő és elemző: lépésenkénti lejátszás Playmaton, mistarget és linked instructions, combat panel |
| `#hogyan` | How to Play | 10 fejezetes kezdő útmutató, a learnriftbound.gg felépítését követi |
| `#tanulas` | Practice | szituációk a Playmaton, haladó leckék szintenként |
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
  src/components/       Playmat (pálya), CombatPanel, CardModal, TipLayer
  src/legacy/           imperatív modulok (core.ts: kártya HTML, deck legalitás, PDF; chain.ts: chain elemző; knowledge.ts: Fogalomtár)
  src/generated/        build termék, nincs verziókezelve
  public/prices.json    Cardmarket árak (commitolva, kézzel frissítve)
  e2e/app.spec.ts       Playwright tesztek
tools/
  HANDOFF.md            munkaállapot, döntések naplója
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
npm run test:e2e                              # Playwright, 10 teszt
```

Megjegyzés: `npx tsc --noEmit -p .` nem azonos a CI-vel, mindig `npm run build`-del ellenőrizz. Ahol a Playwright saját böngészője nem tölthető le, a rendszer Chrome-ja megadható: `PW_CHROME=/usr/bin/google-chrome npm run test:e2e`.

## Ismert korlátok

- **Chain elemzés:** a lapszöveg utasításokra bontása és a linked instruction felismerése szöveges heurisztika. A felhasználó a "Így értelmezem a lapot" blokkban felülírhatja, de szokatlan szövegezésnél a felismerés tévedhet. A kontrollváltást az elemző nem követi.
- **Combat panel:** a feltételes vagy kapott keywordöket, a megelőzést és a helyettesítést javaslatként mutatja, ezeket a felhasználó kapcsolja be. A combat a chain modellen kívül fut.
- **Áthúzás a Playmaton:** érintőképernyőn koppintásos mozgatással működik, a HTML5 drag csak egérrel.
- **Cardmarket:** a legújabb kiadás lapjainak egy része még nincs a Cardmarket listájában, ezeknél nincs ár.
- **Kártyaadat:** közösségi pillanatkép, új kiadásnál frissíteni kell a `src/data/cards.json`-t, és az új lapok short, notes és Q&A tartalma ellenőrző körökön kell átmenjen.

## Jogi

Riot Games "Legal Jibber Jabber" policy alapján készült rajongói oldal, a Riot nem támogatja és nem hagyta jóvá. A kártyaképek a Riot hivatalos szerveréről töltődnek be. A lábléc megnevezi, hogy a kód és a magyarázatok AI segítségével készültek.
