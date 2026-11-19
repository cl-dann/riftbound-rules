# Teljes pontossági ellenőrzés, kör: lásd a fájlnévben (rK)

Egy Riftbound szabálykereső oldal minden kártyájához tartozik:
- `short`: rövid, kezdőknek szóló magyar összefoglaló,
- `notes`: részletes magyarázat pontokban, formátum `[szabályszámok vesszővel, flag, szöveg]`, ahol flag 0 = szabályból közvetlenül, 1 = levezetés, 2 = nyitott kérdés (judge dönt),
- kártyaadatok: type, supertypes, domain, tags, energy, power, might, text (hivatalos szöveg erratával), equip_effect_text.

A felhasználó 100%-os pontosságot kér. Te független ellenőr vagy. Minden lapnál MINDEN állítást ellenőrizz.

## Mérvadó források
- A kártya `text` és `equip_effect_text` mezője (ez a hivatalos szöveg).
- A Core Rules teljes szövege: `/home/claude/riftbound-rules/src/data/rules.json` (lista: id, t). Pythonnal keress benne szabályszámra és kulcsszóra. Minden szabályszám-hivatkozásnál nézd meg, hogy a szabály tényleg azt mondja-e.
- Domain jelek: [R] Fury, [G] Calm, [B] Mind, [O] Body, [P] Chaos, [Y] Order, [C] = a lap saját domainjének 1 Powere, [A] = bármely domain 1 Powere, [S]/[M] = Might, [T]/[E] = exhaust.

## Ismert, ellenőrzött tények (ezeket NE jelentsd hibának)
- A szabályok példái (bennük lapnevekkel) a rules.json `ex` mezőjében vannak, nem a `t` mezőben. Mielőtt egy "a szabályzat ezt a lapot hozza példának" állítást hamisnak mondasz, keress a `ex` mezőkben is (python: `[x['id'] for x in R if NÉV in ' '.join(x.get('ex',[]))]`). Ha a példa létezik, az állítás igaz.
- A Radiance (RAD) lapok domainje a bemenetben szándékosan eltér a nyers `cards.json`-tól: a Riot feed 27 lapnál hibás vagy üres domaint ad, ezt a nyomtatott lap alapján javítottuk (a szett domainenként 23-as blokkokban számozott). A bemenet `domain` mezője a helyes. Ha a short vagy a notes ennek ellentmond (például "domain nélküli lap, bármelyik deckbe betehető"), az HIBA, javítsd.
- A `tags` a lap összes nyomatának tagjeit tartalmazza (a későbbi nyomatok régió taget is kaptak).
- A tiltólista (ban) nem a Core Rules része; a short ne említse, a notes-ban lévő ban állítást ne ellenőrizd és ne tedd open-be.
- Az exhaust költségű képesség nem "körönként egyszer" használható, csak ready állapotban; ha egy hatás újra readyzi, ismét használható.

- Időzítés (310.1.a, 155, 145.2, 151.2, 411.1.a): keyword nélküli spell, activated ability és a Hide csak saját körben, showdownon kívül. Ha a short ezt az időzítést állítja, a showdown kizárásának benne kell lennie ("showdownon kívül"); ha hiányzik, javítsd.
- Activated ability időzítésnél a "saját körödben, showdownon kívül" és a "saját Main Phase-edben, showdownon kívül" egyenértékűnek tekintendő, ezt ne javítsd.
- Segédscripteket CSAK a saját könyvtáradba írj: /tmp/rK_NN_tools (más agentek párhuzamosan futnak).
- Ha egy állítás csak úgy hibás, hogy egy ritka, más lap által okozott kivétel létezik, de a short ezt nem tagadja kifejezetten (nincs benne "soha", "csak", "mindig", "körönként egyszer"), az nem hiba.

- Több domainű lapnál az adat csak a Power költség SZÁMÁT adja, a nyomtatott szimbólumot ([C] vagy konkrét domain) nem. Ha egy short vagy note azt állítja, hogy a Power bármelyik domainjéből tetszőleges arányban fizethető, vagy hogy konkrétan melyikből, azt javítsd úgy, hogy ne állítsa (vagy flag 2-vel jelölje), mert nem ellenőrizhető.

- A Radiance lapok tagjei a feedből hiányoznak (üres tags). Ezt NE tedd data_issue-ba, ismert. Ha egy short vagy note egy RAD lap tagjére épít (pl. 'nincs Mech tagje'), azt ne állítsa tényként.

- Nyomtatott kártyaképek alapján (2026-11-14) ellenőrzött: a több domainű lapok Power szimbóluma a nyomtatáson osztott színű általános rune ikon, vagyis [C], amely a 135.2.e.6.c szerint a lap bármelyik domainjének Powerével fizethető (Ntofo Strikes és On the Hunt hibrid ikon, ugyanez a jelentése). Ezt már ne jelöld nyitott kérdésnek; ha egy note emiatt flag 2, javítsd flag 0-ra a 135.2.e.6.c hivatkozással.
- A Radiance lapok tagjei mostantól a nyomtatott lapról jönnek (régió, champion, Mech, Dog stb.), a bemenet `tags` mezője ezért mérvadó. A "Device" tag csak a feedben szerepel, nyomtatva nincs; erre ne építs állítást.
- Bullet Time nyomtatott és szabálypéldás szövege "[A]" (bármely domain), Elnuk Herd nyomtatva "another friendly unit", Nazuman Ntofo equipment sávjában Shield 2 áll. Siphoning Strike és Dominus Power költsége nyomtatva is üres. Wraith of Echoes nyomtatva "a friendly unit" (a 383.1.b példa "another"-t ír; ez eltérés, flag 2).

- Nyomtatott kártyaképek alapján (2026-11-15) a feed [C]-je helyett [A] áll ezeken: Teemo, Swift Scout; Kai'Sa, Daughter of the Void; Sett, The Boss; Danger Zone; Shurelya's Requiem; Spinning Axe; Bullet Time. A bemenet szövege már a javított. Ha a short vagy a notes ezeknél a lap saját domainjét írja a Power költséghez, javítsd "bármilyen Power"-re (135.2.e.5.a).
- Ha egy trigger célpont vagy választás hiányában nem futhat le, a 403.4 szerint chainre kerül, majd lekerül; a "nem kerül chainre" pontatlan. Intervening "if" feltételnél viszont valóban nem triggerel.

- Érthetőség: a short kezdőknek szól. Ha a short magyarázat nélkül használ szabályzati belső kifejezést (permanent, Game Object, Finalize, Pending Item, instruction, location, Open State) vagy placeholdert ([Effect], [X]), írd át közérthetően (pl. permanent helyett "unit vagy gear"), a pontosság megtartásával. A notes lehet technikaibb.

- A szempontlista lezárva: csak a fenti szempontok szerint javíts. Ne javíts olyat, ami helyes és érthető, csak mert máshogy is meg lehetne fogalmazni; a shortban a [A], [C], [n] jelek ki vannak írva, a notes-ban maradhatnak.

- Kompakt köteg (17. körtől): minden lapnál a "rules" mező tartalmazza a notes által hivatkozott szabályok szövegét (t) és példáit (ex). Elsőként ezt használd. A teljes rules.json-hoz és cards.json-hoz csak akkor nyúlj, ha egy szükséges szabály vagy másik lap nincs benne, és akkor is csak célzott pythonos kereséssel, ne olvasd be egészben.

## Mit ellenőrizz
1. `short`: minden állítás igaz, nincs túlzás, kitalált vagy elhagyott feltétel (may, up to, this turn, friendly/enemy, here, another, controller/owner), időzítés pontos (Action: saját kör vagy showdown; Reaction: bármikor; activated ability keyword nélkül csak saját Main Phase-ben, showdownon kívül), keywordök lényege pontos, költségek kiírva (Energy; Power a domain nevével), minden képesség lényege szerepel, érthető.
2. `notes`: minden pont igaz a szabályszöveg szerint, a hivatkozott szabályszám létezik és azt mondja, a flag megfelelő (ami nyitott kérdés, ne legyen 0 vagy 1-es tényállítás; ami szabályból közvetlenül jön, lehet 0). Nincs ellentmondás a pontok és a short között.
3. Kártyaadatok: a domain, típus, költség és Might konzisztens a szöveggel (például a [C] költségű lapnak van domainje; Equip költség a szövegben). Ha adatot gyanúsnak találsz, a `data_issues`-be írd, ne a fixes-be.

## Kimenet
`rK_NN_out.json`:
`{"fixes": {"<name>": {"short": "<csak ha javítani kell>", "notes": [[refs, flag, szöveg], ...] (csak ha javítani kell; ekkor a TELJES javított notes listát add meg), "why": "<mi volt a hiba, szabályszámmal>"}}, "checked": <db>, "data_issues": ["<lap: leírás>"], "open": ["<lap: amit nem tudtál biztosan eldönteni és miért>"]}`
- Csak tényleges hibát javíts (tárgyi hiba, pontatlanság, félreérthetőség, hiányzó lényeges rész). Stilisztikát ne.
- Ha bizonytalan vagy, ne találj ki semmit: tedd az `open` listába.
- Magyar szöveg, angol szakszavak. Gondolatjel (em-dash, en-dash) TILOS. short 60-420 karakter.
- Validátor: `python3 /home/claude/build/r/check.py rK_NN_out.json rK_NN_cards.json`. Addig javíts, amíg OK.
- Kb. 25 lapként mentsd a fájlt (meglévő tartalmat megtartva).

A végén válaszként csak: hány lapot ellenőriztél, hány javítás (short / notes), hány data_issue és open, és a hibák típusai röviden.
