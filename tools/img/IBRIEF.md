# Kártyakép-olvasás (adatpótlás a nyomtatott lapról)

Bemenet: /home/claude/work/img_NN.json, lista: n (név), code, img (fájlnév), t, d (domain), tg (tags), e (Energy), p (Power), m (Might), txt (feed szöveg). A képek: /home/claude/work/img/<img>. Minden képet nyiss meg a Read eszközzel és nézd meg ténylegesen.

Minden lapnál olvasd le a nyomtatott lapról:
- tags: a típussor tagjei (pl. "UNIT • MECH", "GEAR • EQUIPMENT"), pontosan ahogy nyomtatva vannak, Title Case-ben (pl. ["Mech"], ["Dog"], ["Equipment"]). Ha nincs tag, [].
- domain: a lap domain ikonja(i) a nyomtatáson (Fury, Calm, Mind, Body, Chaos, Order), ha nincs, [].
- energy, might: a nyomtatott számok.
- power: a Power költség szimbólumai sorban, pl. ["Fury"], ["Calm","Calm"], ["Any"] (szürke/színtelen rune ikon), vagy [] ha nincs. Ha a szimbólum a lap saját domainjét jelző általános ikon, írd "C"-nek és magyarázd a note-ban.
- text_diff: ha a nyomtatott szabályszöveg érdemben eltér a txt mezőtől (szavak, számok, "friendly"/"another", költségikonok a szövegben), add meg pontosan a nyomtatott mondatot. Reminder text és formázás eltérése nem számít. A szöveg költségikonjainál (Power, exhaust, Might) írd le, milyen ikont látsz (konkrét domain színe, vagy általános).
Ha valamit nem tudsz biztosan leolvasni, írd a "unsure" listába, ne találgass.

Kimenet: /home/claude/work/img_NN_out.json: {"<név>": {"code":..., "tags":[...], "domain":[...], "energy":N, "power":[...], "might":N|null, "text_diff": "<nyomtatott mondat vagy üres>", "note": "<rövid megjegyzés vagy üres>"}, ..., "unsure": ["<név: mi>"]}. Kb. 8 laponként mentsd.
Válaszként csak: hány lap, hány tag kitöltve, eltérések a bemenethez képest (domain, power, energy, might, text) listában.
