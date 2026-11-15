# Költségikon ellenőrzés a nyomtatott lapon

Bemenet: /home/claude/work/c_NN.json (n név, img fájlnév, d domain, txt feed szöveg). Képek: /home/claude/work/img2/<img>. Minden képet nyiss meg a Read eszközzel (ha kell, vágd ki a szövegdobozt PIL-lel a /tmp/cNN alá és azt nézd meg nagyítva).

A feedben a [C] a lap saját domainjének Powerét jelenti (a nyomtatáson a domain színes ikonja, több domainű lapnál osztott színű ikon), az [A] bármely domain Powerét (a nyomtatáson szivárványszínű, többszínű ikon). Ismert, hogy a feed néha [C]-t ír, ahol a nyomtatáson [A] (szivárvány) áll.
Feladat: minden lapnál a szövegben szereplő MINDEN [C] és [A] jelet vesd össze a nyomtatott ikonnal, sorrendben. Ha eltér, add meg a pontos javítást. Ha a nyomtatott szöveg máshol is érdemben eltér a feedtől (szavak, számok), azt is jelezd. Reminder text és formázás eltérése nem számít.

Kimenet: /home/claude/work/c_NN_out.json: {"fixes": {"<név>": [["<feed részlet pontosan, egyedi>", "<javított részlet>"]]}, "text_diffs": {"<név>": "<mi tér el>"}, "unsure": ["<név: mi>"], "checked": N}. Ne találgass: ami bizonytalan, az unsure.
Válaszként csak: hány lap, hány javítás, felsorolva.
