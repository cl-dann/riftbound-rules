/* Chain sablonok: témánként kész kiinduló helyzet és lépések, valós lapokkal. A pályás építő "Sablonok" listája tölti be,
   a unit teszt (unit/sablonok.test.ts) mindegyikre lefuttatja az elemzést és ellenőrzi a leírásban állított eredményt. */

import type { ChainState, ChainStep } from './state';

export type ChainTemplate = { id: string; title: string; desc: string; refs: string; cs: () => ChainState };

const base = (o: Partial<ChainState>): ChainState => ({ lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], steps: [], hand: { A: [], B: [] }, ch: { A: '', B: '' }, ...o });
const card = (n: string, pl: 'A' | 'B', tg: string[] = [], x: Partial<ChainStep> = {}): ChainStep => ({ k: 'card', n, pl, from: 'hand', tg, ext: {}, ...x });

export const TEMPLATES: ChainTemplate[] = [
  {
    id: 'counter', title: 'Counter egy spellre',
    desc: 'Te Void Seekert játszol ki az ellenfél unitjára, az ellenfél Wind Wall-lal counterolja. A Void Seeker nem fut le, ezért a Ravenbloom Student "When you play a spell" triggere sem triggerel.',
    refs: '426.1, 420.4.a.1',
    cs: () => base({ turn: 'A', bf: [{ n: '', c: 'B' }, { n: '', c: '' }],
      bd: [{ n: 'Ravenbloom Student', pl: 'A', loc: 'base', d: 0 }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }],
      steps: [card('Void Seeker', 'A', ['b1']), card('Wind Wall', 'B', ['s0'])] }),
  },
  {
    id: 'ignored', title: 'Mistarget: Ignored',
    desc: 'Hidden Blade az ellenfél unitjára, az ellenfél Flash-sel a base-be menti. A célpont már nem "unit at a battlefield", ezért a kill Ignored, és a rá hivatkozó "Its controller draws 2" is Ignored.',
    refs: '359.3.e.6, 359.3.e.14.a',
    cs: () => base({ turn: 'A',
      bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }],
      steps: [card('Hidden Blade', 'A', ['b0']), card('Flash', 'B', ['b0'])] }),
  },
  {
    id: 'negated', title: 'Mistarget nélkül: Negated',
    desc: "Hidden Blade az ellenfél unitjára, de a unitra csatolt Guardian Angel helyettesíti a halált (\"If I would die, kill Guardian Angel instead\"). A célpont legális marad, a kill más okból marad el, ezért Negated, a linked \"draws 2\" pedig végrehajtódik.",
    refs: '359.3.e.6, 359.3.e.14.b',
    cs: () => base({ turn: 'A',
      bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }, { n: 'Guardian Angel', pl: 'B', loc: 'bf0', d: 0, on: 0 }],
      steps: [card('Hidden Blade', 'A', ['b0'])] }),
  },
  {
    id: 'trigorder', title: 'Egyszerre triggerelő abilityk sorrendje',
    desc: 'A The Ruination minden unitot megöl, mindkét Watchful Sentry Deathknellje egyszerre triggerel. A turn player (te) teszi fel először a sajátját, ezért az ellenfélé resolve-ol előbb.',
    refs: '383.3.d.1, 808.1',
    cs: () => base({ turn: 'A',
      bd: [{ n: 'Watchful Sentry', pl: 'A', loc: 'bf0', d: 0 }, { n: 'Watchful Sentry', pl: 'B', loc: 'bf0', d: 0 }],
      steps: [card('The Ruination', 'A')] }),
  },
  {
    id: 'replacement', title: 'Duplázás és Prevent sorrendje',
    desc: 'Void Seeker 4 damage a Mountain Drake-re; Lotus Trap duplázza, Ki Barrier megelőz 7-et. A két helyettesítő hatás sorrendjéről a unit irányítója dönt; az elemzés mindkét sorrend eredményét kiírja.',
    refs: '372, 467.2.c.5',
    cs: () => base({ turn: 'A',
      bd: [{ n: 'Mountain Drake', pl: 'B', loc: 'bf0', d: 0 }],
      steps: [card('Void Seeker', 'A', ['b0']), card('Lotus Trap', 'A', ['b0']), card('Ki Barrier', 'B', ['b0'])] }),
  },
  {
    id: 'hidden', title: 'Hidden lap kijátszása facedown-ból',
    desc: 'Az ellenfél elrejtette a Hidden Blade-et az általa kontrollált battlefielden. Te Void Seekert játszol ki az unitjára, ő válaszként facedown-ból játssza ki a Hidden Blade-et, ami így [Reaction]-ként jöhet.',
    refs: '811.1.b, 811.1.d.3, 813.1.c.1',
    cs: () => base({ turn: 'A', bf: [{ n: '', c: 'B', fd: 'B', fdn: 'Hidden Blade' }, { n: '', c: '' }],
      bd: [{ n: 'Yasuo, Remorseful', pl: 'A', loc: 'bf0', d: 0 }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }],
      steps: [card('Void Seeker', 'A', ['b1']), card('Hidden Blade', 'B', ['b0'], { from: 'facedown', loc: 'bf0' })] }),
  },
  {
    id: 'trash', title: 'Lap a trashből',
    desc: 'Morbid Return a trashedben lévő Shipyard Skulkert választja: a trash nyilvános, ezért ez célpont, a lerakáskor kell kiválasztani. Az ellenfél Disposal Order-rel recycle-öli ugyanazt a lapot, így a Morbid Return célpontja a resolve-kor már nincs a trashben: Ignored.',
    refs: '355.10.a, 355.9.a, 359.3.e.5, 359.3.e.6',
    cs: () => base({ turn: 'A', trash: { A: ['Shipyard Skulker'], B: [] },
      steps: [card('Morbid Return', 'A', [], { zp: { 0: ['ztA0'] } }), card('Disposal Order', 'B', [], { mode: 0, zp: { 0: ['ztA0'] } })] }),
  },
  {
    id: 'endturn', title: 'Kör vége és Expiration Step',
    desc: 'A te körödben Sona battlefielden áll. Kör vége: a trigger a chainre kerül, az ellenfél válaszként Star-Crossed-dal a kezedbe küldi Sonát. A trigger ettől még lefut, mert a feltétele a triggereléskor teljesült; utána Expiration Step.',
    refs: '317.1, 383.2.a.1, 317.2',
    cs: () => base({ turn: 'A',
      bd: [{ n: 'Sona, Harmonious', pl: 'A', loc: 'bf0', d: 0 }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }],
      steps: [{ k: 'end' }, card('Star-Crossed', 'B', ['b1', 'b0'])] }),
  },
  {
    id: 'reksai-sanctum', title: "Rek'Sai, Void Burrower és The Candlelit Sanctum: két conquer trigger",
    desc: "Gem Jammer Standard Move-val (144) a senki által nem irányított, üres Sanctumra megy: nincs showdown, Establish Control és conquer (468.5, 468.5.d, 471.1), mindkét conquer trigger a tiéd (473.2.a). A sorrendet te választod (383.3.d): előbb a Rek'Sai legend, fölé a Sanctum, így a Sanctum resolve-ol előbb. A Rek'Sai \"you may\" döntése és az exhaust költség már a chainre tételkor, a finalizáláskor eldől (383.3.a, 383.3.b), még a Sanctum előtt. Minden resolve előtt mindkét játékos kap priority-t (340.1). A Sanctum: megnézed a felső 2 lapot (128.4, privát), a Chemtech Enforcert recycle-ölöd (417; kettőnél véletlen sorrendben, 417.5), a Bilgewater Tracker marad felül. A Rek'Sai: felfedi a Trackert és a Dangerous Duót (a \"You may banish one\" a resolve-kor dől el, 383.3.a.3), a Trackert banisheled (428.1) és kijátszod a Sanctumra (420.3, 420.3.b, 355.2.a); Rek'Sai, Breacher Accelerate-et ad a nem kézből kijátszott unitnak (805.1.b), ezért ready lép be. Unitként a finalizálás után azonnal resolve-ol (337.2), itt nincs reakció-ablak; a maradék recycle (417.4). A Tracker play triggere a chain tetejére kerül (420.4.a), erre az ellenfél [Reaction] lapot játszhat (309.1.a, 340.4): Ki Barrier az Amateur Demolitionistre. Előbb a Ki Barrier, utána a Tracker trigger resolve-ol: a Demolitionist damage-ét megelőzi, a Fallen Feline 1 damage-et kap. Fordított sorrendben (Sanctum alul) a Rek'Sai fedne fel előbb, és a Sanctum a megmaradt deck tetejét rendezné.",
    refs: '468.5.d, 471.1, 473.2.a, 383.3.d, 383.3.a, 383.3.b, 383.3.a.3, 128.4, 417.4, 417.5, 428.1, 420.3.b, 355.2.a, 805.1.b, 337.2, 420.4.a, 309.1.a, 340.4',
    cs: () => base({ turn: 'A', lg: { A: "Rek'Sai, Void Burrower", B: '' }, bf: [{ n: 'The Candlelit Sanctum', c: '' }, { n: '', c: 'B' }],
      bd: [{ n: "Rek'Sai, Breacher", pl: 'A', loc: 'base', d: 0 }, { n: 'Gem Jammer', pl: 'A', loc: 'bf0', d: 0, ex: true }, { n: 'Amateur Demolitionist', pl: 'B', loc: 'bf1', d: 0 }, { n: 'Fallen Feline', pl: 'B', loc: 'bf1', d: 0 }],
      hand: { A: [], B: [{ id: 'zhB_1', n: 'Ki Barrier' }] }, trash: { A: [], B: [] },
      deck: { A: [{ id: 'zdA_1', n: 'Bilgewater Tracker' }, { id: 'zdA_2', n: 'Chemtech Enforcer' }, { id: 'zdA_3', n: 'Dangerous Duo' }], B: [] }, zseq: 3,
      steps: [
        { k: 'tr', n: "Rek'Sai, Void Burrower", src: 'LA', pl: 'A', eff: 'you may exhaust me to reveal the top 2 cards of your Main Deck. You may banish one, then play it. Recycle the rest.', why: 'When you conquer', tg: [], ext: {}, zp: { 1: ['zdA_1'] }, pll: { 2: 'bf0' }, accel: true, ptg: ['b2', 'b3'], cb: { bf: 'bf0', dead: [], recall: [], ctrl: 'A', label: 'Gem Jammer conquer' } },
        { k: 'tr', n: 'The Candlelit Sanctum', pl: 'A', eff: "look at the top two cards of your Main Deck. You may recycle one or both of them. Put those you don't back in any order.", why: 'When you conquer here', tg: [], ext: {}, zp: { 1: ['zdA_2'] } },
        { k: 'res' }, { k: 'res' },
        card('Ki Barrier', 'B', ['b2']),
        { k: 'res' }, { k: 'res' }] }),
  },
  {
    id: 'reksai-queen', title: "Rek'Sai, Swarm Queen: \"play it here\" a támadott battlefieldre",
    desc: "Rek'Sai, Swarm Queen megtámadja az ellenfél battlefieldjét, a \"When I attack\" trigger a chainre kerül. A \"you may reveal\" a finalizáláskor dől el (383.3.a), a többi \"you may\" a resolve-kor (383.3.a.3). Felfedi a felső 2 lapot, a Shipyard Skulkert banisheli (428.1) és kijátssza (420.3.b); unitként \"here\", a támadott battlefieldre kerül, bár azt az ellenfél irányítja, mert a lap erre engedélyt ad (355.2.b; a helyet a lap a kijátszáskor, a finalizáláskor nézi, 420.3.b.2). A maradék recycle (417.4).",
    refs: '383.3.a, 383.3.a.3, 428.1, 420.3.b, 420.3.b.2, 355.2.b, 417.4',
    cs: () => base({ turn: 'A', bf: [{ n: '', c: '' }, { n: '', c: 'B' }],
      bd: [{ n: "Rek'Sai, Swarm Queen", pl: 'A', loc: 'bf1', d: 0, atk: 'a' }, { n: 'Mega-Mech', pl: 'B', loc: 'bf1', d: 0, atk: 'd' }],
      trash: { A: [], B: [] }, deck: { A: [{ id: 'zdA_1', n: 'Shipyard Skulker' }, { id: 'zdA_2', n: 'Flash' }], B: [] }, zseq: 2,
      steps: [{ k: 'tg', src: 'b0', ti: 0, pl: 'A', n: "Rek'Sai, Swarm Queen", tg: [], ext: {}, zp: { 1: ['zdA_1'] } }, { k: 'res' }] }),
  },
];
