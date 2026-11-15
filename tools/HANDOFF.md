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
