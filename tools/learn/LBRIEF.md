# Tanulás modul tartalom (Riftbound szabálykereső, magyar)

Egy kezdőknek szóló, fejezetekre bontott, lapozós Riftbound útmutatót írsz magyarul, angol szakszavakkal (unit, battlefield, rune, Energy, Power, Might, chain, showdown, combat, conquer, hold, exhaust, ready, recycle stb. angolul marad). A learnriftbound.gg ötlet-referencia, de SEMMIT ne vegyél át onnan szövegben: minden állítás a hivatalos Core Rules-ból jön.

Források (csak ezek):
- Core Rules: /home/claude/riftbound-rules/web/src/generated/rules.json (lista: [id, szöveg, példák]). Pythonnal keress. Minden szabályállításhoz adj szabályszámot, és ellenőrizd, hogy a szabály tényleg azt mondja.
- Kártyák: /home/claude/riftbound-rules/web/src/generated/cards.json (n név, t típus, d domain, e Energy, p Power, m Might, txt szöveg, sh rövid magyar leírás). Példaként csak létező lapnevet használj, pontos névvel, és az adatai (Might, költség, szöveg) egyezzenek.
- A meglévő kezdő útmutató vázlata: /home/claude/riftbound-rules/src/data/guide.json (9 fejezet, átdolgozhatod, bővítheted).

Stílus: rövid bekezdések, egy bekezdés egy gondolat, kezdőnek érthető, mégis pontos. Szakkifejezés első előfordulásánál egy mondatos magyarázat. Gondolatjel (em-dash, en-dash) TILOS, helyette vessző, kettőspont vagy új mondat. Ne legyen "Amit ez jelent:" típusú sablon, ne kezdődjön bekezdés félkövér lead-innel. Ha egy állítás csak levezetés vagy stratégiai tanács (nem szabály), a callout kind legyen "strategy", és ne állítsd szabályként.

Inline jelölések a szövegben: [[Kártya pontos neve]] kártyalink (hoverre kép), {{123.4}} szabályhivatkozás. Más markup nincs.

## JSON séma (kimenet egy fájl)
{
 "chapters": [
  {"id": "kebab-id", "level": "kezdo|halado", "title": "Fejezetcím", "lead": "1-2 mondatos összefoglaló, mit tanulsz itt",
   "rules": "fő szabályszámok vesszővel",
   "blocks": [
     {"type": "p", "text": "..."},
     {"type": "callout", "kind": "tip|warn|rule|strategy", "title": "rövid cím", "text": "..."},
     {"type": "steps", "title": "opcionális", "items": [{"title": "...", "text": "..."}]},
     {"type": "cards", "names": ["Pontos név", "..."], "caption": "mire figyelj a lapokon"},
     {"type": "table", "head": ["...", "..."], "rows": [["...", "..."]]}
   ],
   "quiz": [{"q": "kérdés", "options": ["A", "B", "C"], "correct": 0, "why": "magyarázat {{szabály}} hivatkozással"}]
  }
 ],
 "scenarios": [ ... csak ha a feladatod kéri ... ]
}
Kvíz: fejezetenként 3-5 kérdés, 3-4 opció, pontosan egy helyes, a téves opciók hihetőek. Minden "why" tartalmazzon szabályhivatkozást.

A végén validáld pythonnal: érvényes JSON, minden [[név]] létezik a cards.json-ban, minden {{szám}} létezik a rules.json-ban, nincs U+2013 és U+2014 karakter, minden quiz correct index érvényes.
Válaszként csak: fejezetek és kvízkérdések száma, és amit nem tudtál szabállyal alátámasztani.
