# Időzítés-egységesítő sweep (egyszeri)

Bemenet: /home/claude/build/r/t2_cards.json (name, type, text, short). Kimenet: /home/claude/build/r/t2_out.json, formátum: {"fixes": {"<name>": {"short": "<teljes javított short>", "why": "<szabályszám>"}}, "checked": N}.

Szabályok (rules.json: /home/claude/riftbound-rules/web/src/generated/rules.json, lista [id, t, ex]):
- 310.1.a: alapból lapot kijátszani és képességet aktiválni csak a saját körödben, Neutral Open állapotban lehet (nincs showdown, nincs combat, nincs chain).
- 155: keyword nélküli spell: saját kör, showdownon kívül.
- 145.2, 151.2: unit és gear activated ability (Equip, Empower is, ha activated ability): saját Main Phase, Open State, nem showdown közben.
- 411.1.a, 422.2.a: a Hide Discretionary Action, tehát csak saját kör, Neutral Open (showdownon kívül).
- Action keyword: saját kör vagy bármely showdown; Reaction: bármikor (Hiddenből játszva a lap Reactiont kap, 811.6).

Feladat: minden lapnál, ahol a short időzítést állít (saját körödben, Main Phase-edben, harcon kívül, Hiddennél elrejtés), és ez a fenti szabály szerint hiányos (nem zárja ki a showdownt) vagy hibás, javítsd a shortot a lehető legkisebb módosítással. Kanonikus formák: "Csak a saját körödben, showdownon kívül játszható ki." / "a saját Main Phase-edben, showdownon kívül" / "Hidden: a saját körödben, showdownon kívül 1 [domain vagy bármilyen] Powerért elrejtheted ...". A "harcon kívül" csak akkor maradhat, ha mellette a showdown is ki van zárva.
Ne javíts, ha az időzítés-mondat nem a lap saját kijátszására vagy aktiválására vonatkozik (pl. "a saját köröd elején" trigger, "az első három saját körödben", legend triggerek, battlefield hatások, Action/Reaction lapok, ha a short helyes). Minden más tartalmat hagyj érintetlenül.
Magyar szöveg, gondolatjel (em-dash, en-dash) TILOS, short legfeljebb 420 karakter. A végén ellenőrizd pythonnal a hosszt és a gondolatjelet.
Válaszként: hány lapot néztél, hány javítás.

Ebben a kötegben a short egyáltalán nem mondja ki a lap időzítését. Minden lapnál egészítsd ki a shortot egy rövid időzítés-mondattal a szövege alapján: keyword nélkül "Csak a saját körödben, showdownon kívül játszható ki." ({155}), [Action] esetén "A saját körödben vagy showdownban játszható ki." (806), [Reaction] esetén "Bármikor kijátszható, ha nálad a priority." (813). A short maradjon legfeljebb 420 karakter; ha kell, rövidíts máshol, de tartalmat ne veszíts.
