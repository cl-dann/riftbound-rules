/* Chain sablonok: témánként kész kiinduló helyzet és lépések, valós lapokkal. A pályás építő "Sablonok" listája tölti be,
   a unit teszt (unit/sablonok.test.ts) mindegyikre lefuttatja az elemzést és ellenőrzi a leírásban állított eredményt. */

export type ChainTemplate = { id: string; title: string; desc: string; refs: string; cs: () => any };

const base = (o: any) => ({ lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], steps: [], hand: { A: [], B: [] }, ch: { A: '', B: '' }, ...o });
const card = (n: string, pl: 'A' | 'B', tg: string[] = [], x: any = {}) => ({ k: 'card', n, pl, from: 'hand', tg, ext: {}, ...x });

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
    desc: "Hidden Blade az ellenfél unitjára, de az ellenfél Zhonya's Hourglass-a helyettesíti a halált. A célpont legális marad, a kill más okból marad el, ezért Negated, a linked \"draws 2\" pedig végrehajtódik.",
    refs: '359.3.e.6, 359.3.e.14.b',
    cs: () => base({ turn: 'A',
      bd: [{ n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }, { n: "Zhonya's Hourglass", pl: 'B', loc: 'base', d: 0 }],
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
    id: 'endturn', title: 'Kör vége és Expiration Step',
    desc: 'A te körödben Sona battlefielden áll. Kör vége: a trigger a chainre kerül, az ellenfél válaszként Star-Crossed-dal a kezedbe küldi Sonát. A trigger ettől még lefut, mert a feltétele a triggereléskor teljesült; utána Expiration Step.',
    refs: '317.1, 383.2.a.1, 317.2',
    cs: () => base({ turn: 'A',
      bd: [{ n: 'Sona, Harmonious', pl: 'A', loc: 'bf0', d: 0 }, { n: 'Shipyard Skulker', pl: 'B', loc: 'bf0', d: 0 }],
      steps: [{ k: 'end' }, card('Star-Crossed', 'B', ['b1', 'b0'])] }),
  },
];
