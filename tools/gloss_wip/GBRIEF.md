# Érthetőségi és pontossági átnézés: kulcsszó-magyarázatok, fogalomtár, játékmenet

Fájlok (munkapéldányok, ezeket javítsd helyben): /home/claude/build/gl/glossary.json (kulcsszavak: kw, rule, kind, on, short, points [[szabályszám, szöveg]...]), /home/claude/build/gl/terms.json (fogalmak: t, m, r, d), /home/claude/build/gl/flow.json (játékmenet lépések). Mérvadó: /home/claude/riftbound-rules/web/src/generated/rules.json ([id, szöveg, példák]) és /home/claude/riftbound-rules/web/src/generated/cards.json.

A felhasználó panasza: "Amikor a permanent meghal, az [Effect] triggerel." érthetetlen: mi a permanent, mi az [Effect]? Cél: minden magyar szöveg legyen egy kezdő számára is érthető, közben 100%-ban pontos.

Szabályok:
- A "permanent" szót ne hagyd magyarázat nélkül: írd ki, mire vonatkozik az adott helyen (pl. "a lap (unit vagy gear)", vagy ha a kulcsszó csak unitokon szerepel, "a unit"). A 1xx szabályok szerint a permanent = unit vagy gear a boardon; a rune nem permanent.
- Placeholder jelölést ([Effect], [X], [Cost] stb.) ne hagyj megmagyarázatlanul: írd le, mi áll a helyén ("a kulcsszó utáni hatás", "a kulcsszó melletti szám").
- A többi szabálykifejezést (Game Object, Finalize, Pending Item, Open State, instruction, replacement effect, location stb.) első előfordulásnál egy rövid mellékmondattal magyarázd, vagy cseréld közérthető megfogalmazásra, ha a pontosság nem sérül. Angol játékkifejezések (unit, gear, Might, chain, trigger stb.) angolul maradnak.
- Közben ellenőrizd a tartalmat a szabályszöveggel: a hivatkozott szabályszám létezik és azt mondja. Ha hibát találsz, javítsd.
- Gondolatjel (U+2013, U+2014) TILOS. A JSON szerkezete, kulcsai és a szabályszámok formátuma nem változhat, csak a magyar szövegek.
- A végén pythonnal: a három fájl érvényes JSON, ugyanannyi elem, ugyanazok a kulcsok, nincs gondolatjel, minden szabályszám létezik.
Segédscript csak /tmp/gl_tools alá. Válaszként: hány szöveget írtál át érthetőség miatt, hány tárgyi hibát javítottál (listában röviden).
