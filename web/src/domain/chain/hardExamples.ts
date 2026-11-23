/* "Nehéz példák": gyakori, nehéz szabálykérdések valós helyzetekben, a felhasználói tier list (2026-11-23) S és A legendjeihez.
   A lapok versenyen játszott decklistákból valók (a hivatalos Riot "Top Decks" cikkek, playriftbound.com; ahol nincs ilyen deck,
   a riftbound.gg guide), a példa leírása megnevezi a forrás decket, a linket és a dátumot. A 2026-11-23-án kitiltott lapok
   (Riven, Broken Blade; Zhonya's Hourglass; Stellacorn Herder; Nocturne, Horrifying; Rhasa the Sunderer; Brynhir Thundersong;
   Dazzling Aurora; Baited Hook; Emperor's Dais; Star Spring) nem szerepelnek, a deck legális lapja kerül a helyükre.
   A válasz forrása kizárólag a Core Rules (rules.json), szabályszámmal; ahol nem dönt, flag 2, és a válasz mindkét értelmezést leírja.
   Minden példát az elemző lefuttat; a unit teszt (unit/nehezpeldak.test.ts) a betöltést és az "expect" mezőben állított eredményt ellenőrzi. */
import type { ChainState, ChainStep } from './state';
import { TEMPLATES } from './templates';

/** Forrás: a deck, ahonnan a lapok valók (név, link, dátum). */
type HardSrc = { deck: string; url: string; date: string };
/** Ellenőrzött eredmény: a resolve-ok sorrendje (a chain elemeinek neve), elemenként a kimenet és az utasítások állapota,
    a nem szabályos lépések száma, a szövegben előforduló minták, objektum-mezők a végállapotban. */
type HardExpect = {
  items: string[]; res?: Record<string, string>; st?: Record<string, string[]>; illegal?: number;
  has?: string[]; obj?: Record<string, Record<string, unknown>>; flag2?: boolean;
};
export type HardExample = {
  id: string; cat: string; lg: string[]; q: string; a: string; refs: string; flag: 0 | 1 | 2;
  /** flag 2 esetén a két értelmezés eredménye */
  alt?: [string, string];
  src: HardSrc[]; note?: string; cs: () => ChainState; expect: HardExpect;
};

/** A felület fejléce: a legendek forrása. */
export const HARD_SOURCE = 'Legendek: felhasználói tier list, 2026-11-23';
/** A felhasználói tier list (2026-11-23), S és A szint; a példák jelvénye ebből. */
export const HARD_TIER: Record<string, string> = {
  'Azir, Emperor of the Sands': 'S', 'Vex, Gloomist': 'S', 'Ornn, Fire Below the Mountain': 'S', 'Master Yi, Wuju Bladesman (Starter)': 'S',
  "Kai'Sa, Daughter of the Void": 'S', 'Rengar, Pridestalker': 'S', "Rek'Sai, Void Burrower": 'S',
  'Nasus, Curator of the Sands': 'A', 'Irelia, Blade Dancer': 'A', 'Viktor, Herald of the Arcane': 'A', 'Kennen, Heart of the Tempest': 'A',
  'LeBlanc, Deceiver': 'A', 'Sett, The Boss': 'A', 'Diana, Scorn of the Moon': 'A', "Kha'Zix, Voidreaver": 'A', "Evelynn, Agony's Embrace": 'A',
  'Ezreal, Prodigal Explorer': 'A', 'Draven, Glorious Executioner': 'A',
};
/** Legendenkénti megjegyzés a jelvény mellé (formátum-tiltás). */
export const HARD_LG_NOTE: Record<string, string> = { 'Master Yi, Wuju Bladesman (Starter)': '2v2-ben tiltott' };
/** Jelvény: "Kennen · A" (a legend rövid neve és a tier). */
export const hardBadge = (lg: string) => lg.split(',')[0] + ' · ' + (HARD_TIER[lg] || '?');

export const HARD_CATS = ['Reakció-ablak', 'Triggerek sorrendje', 'Hidden és Ambush', 'Költség és erőforrás', 'Deathknell és replacement',
  'Mistarget: Ignored vagy Negated', 'Copy', 'Accelerate és Legion', 'Conquer', 'Level és XP', 'Legend saját interakciója'];

const base = (o: Partial<ChainState>): ChainState => ({ lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], steps: [], hand: { A: [], B: [] }, ch: { A: '', B: '' }, ...o });
const card = (n: string, pl: 'A' | 'B', tg: string[] = [], x: Partial<ChainStep> = {}): ChainStep => ({ k: 'card', n, pl, from: 'hand', tg, ext: {}, ...x });
const ab = (src: string, ai: number, n: string, pl: 'A' | 'B', tg: string[] = []): ChainStep => ({ k: 'ab', src, ai, n, pl, tg });
const R: ChainStep = { k: 'res' };

/* Forrás deckek: a hivatalos Riot "Top Decks" cikkek (Regional Qualifier) és a riftbound.gg guide */
const LA = 'https://playriftbound.com/en-us/news/organizedplay/los-angeles-top-decks/';
const ATL = 'https://playriftbound.com/en-us/news/organizedplay/atlantas-top-decks';
const HFD = 'https://playriftbound.com/en-us/news/hartfords-top-decks';
const la = (who: string): HardSrc => ({ deck: 'RQ Los Angeles, ' + who, url: LA, date: '2026-09-30' });
const atl = (who: string): HardSrc => ({ deck: 'RQ Atlanta, ' + who, url: ATL, date: '2026-05-01' });
const hfd = (who: string): HardSrc => ({ deck: 'RQ Hartford, ' + who, url: HFD, date: '2026-06-24' });
const S_KAISA = hfd("Flamekilla (Kai'Sa)");
const S_KENNEN = la('DSG AwesumRosum (Kennen)');
const S_AZIR = la('MICE Squirtle (Azir, 3.)');
const S_VEX = la('bsweitz (Vex)');
const S_ORNN = la('MICE TheManLand (Ornn, 8.)');
const S_YI = la('SWAGALISK (Master Yi, Wuju Bladesman, 6.)');
const S_RENGAR = la('DSG Prismaticism (Rengar, 1.)');
const S_REKSAI = la("Sinzari (Rek'Sai)");
const S_NASUS = la('Niguel (Nasus)');
const S_IRELIA = la('Xeno (Irelia, 2.)');
const S_VIKTOR = hfd('HTO Juicy (Viktor)');
const S_LEBLANC = la('MILL TwistedTCG (LeBlanc)');
const S_SETT = hfd('CTCG Collin K (Sett)');
const S_DIANA = la('ASC nalkpas (Diana)');
const S_KHAZIX = la("Cuoemrei (Kha'Zix)");
const S_EVE: HardSrc = { deck: "riftbound.gg guide: Evelynn, Agony's Embrace (versenydeck nem érhető el; a guide lapjai)", url: 'https://riftbound.gg/?p=4673', date: '2026-10-14' };
const S_EZREAL = la('KactusxKing (Ezreal)');
const S_DRAVEN = la('I Missed My Q (Draven)');

const tplCs = (id: string) => () => TEMPLATES.find((t) => t.id === id)!.cs();

export const HARD_EXAMPLES: HardExample[] = [
  /* ---------- Reakció-ablak ---------- */
  {
    id: 'kaisa-add', cat: 'Reakció-ablak', lg: ["Kai'Sa, Daughter of the Void", "Rek'Sai, Void Burrower"], flag: 0,
    q: "Az ellenfél Falling Starral lő két unitodra. Reagálhat a Kai'Sa legend Add-jára, és válaszolhatsz vele Retreattel?",
    a: "Az Add ability nem kerül a chainre: a finalizálás után azonnal resolve-ol, ezért rá nem lehet reagálni (401.2, 430.2). A kapott Power a Retreathez használható, mert az spell (a legend szövege: \"Use only to play spells\"). A Retreat a Ravenbloom Studentet a kézbe viszi és 1 rune-t channelöl exhausted állapotban; a Falling Star erre szóló utasítása Ignored, a Kai'Sa, Survivorra szóló végrehajtódik (359.3.e.2, 359.3.e.6, 359.3.e.8).",
    refs: '401.2, 430.2, 359.3.e.2, 359.3.e.6, 359.3.e.8', src: [S_KAISA, S_REKSAI],
    cs: () => base({ turn: 'B', lg: { A: "Kai'Sa, Daughter of the Void", B: "Rek'Sai, Void Burrower" },
      bd: [{ n: "Kai'Sa, Survivor", pl: 'A', loc: 'bf0' }, { n: 'Ravenbloom Student', pl: 'A', loc: 'bf0' }],
      steps: [card('Falling Star', 'B', ['b0', 'b1']), ab('LA', 0, "Kai'Sa, Daughter of the Void", 'A'), card('Retreat', 'A', ['b1'])] }),
    expect: { items: ['Retreat', 'Falling Star'], st: { 'Falling Star': ['executed', 'ignored'] }, has: ['Erőforrást ad: azonnal resolve-ol, nem kerül a chainre'] },
  },
  {
    id: 'vex-nsf', cat: 'Reakció-ablak', lg: ['Vex, Gloomist', "Kai'Sa, Daughter of the Void"], flag: 0,
    q: 'Falling Star két célponttal, az egyik a Vex, Apathetic. Counterelheti a Not So Fast, és mennyibe kerül a Falling Star?',
    a: 'A Not So Fast "an enemy spell or ability that chooses a friendly unit or gear" spellt counterel: elég, ha a Falling Star egyik célpontja friendly unit, ezért az egész spell counterelve, egyik damage sem jön (426.1, 426.1.a). A Vex Deflectje miatt a Falling Star kijátszója a Vex kiválasztásáért plusz Powert fizet, és ez countereléskor sem jár vissza (809.1.c, 426.1.c).',
    refs: '426.1, 426.1.a, 426.1.c, 809.1.c', src: [S_VEX, S_KAISA],
    cs: () => base({ turn: 'A', lg: { A: "Kai'Sa, Daughter of the Void", B: 'Vex, Gloomist' },
      bd: [{ n: 'Vex, Apathetic', pl: 'B', loc: 'bf0' }, { n: 'Astral Heron', pl: 'B', loc: 'bf0' }],
      steps: [card('Falling Star', 'A', ['b0', 'b1']), card('Not So Fast', 'B', ['s0'])] }),
    expect: { items: ['Not So Fast', 'Falling Star'], res: { 'Falling Star': 'countered' }, has: ['Deflect: Vex, Apathetic'] },
  },
  {
    id: 'kennen-defy', cat: 'Reakció-ablak', lg: ['Kennen, Heart of the Tempest', 'Azir, Emperor of the Sands'], flag: 1,
    q: 'Kennen Flow-val a trashből játssza ki a Lightning Rusht, az Azir játékos Defy-jal counterli. Empowered lesz Kennen legendje, és hová kerül a lap?',
    a: 'Nem lesz Empowered: a "When you play a card" triggerek akkor triggerelnek, amikor a kijátszás a lap resolve-jával befejeződik (420.4.a), a counterelt lap pedig nem számít kijátszottnak (420.4.a.1, 426.1.b). A Defy legális, mert a Lightning Rush nyomtatott költsége 1 Energy, Power nélkül; a Flow költség ezt nem változtatja meg (206). A counterelt lap a trashbe kerül (426.1.a.1); a Flow "Then banish it" része nem fut le, mert a lap nem resolve-olt (levezetés: 426.1.a, 829.1.b).',
    refs: '420.4.a, 420.4.a.1, 426.1.a, 426.1.a.1, 426.1.b, 206, 829.1.b', src: [S_KENNEN, S_AZIR],
    cs: () => base({ turn: 'A', lg: { A: 'Kennen, Heart of the Tempest', B: 'Azir, Emperor of the Sands' }, trash: { A: [{ id: 'ztA_1', n: 'Lightning Rush' }], B: [] }, zseq: 1,
      bd: [{ n: 'Kennen, Storm of Shuriken', pl: 'A', loc: 'bf0' }],
      steps: [card('Lightning Rush', 'A', [], { from: 'trash' }), card('Defy', 'B', ['s0'])] }),
    expect: { items: ['Defy', 'Lightning Rush'], res: { 'Lightning Rush': 'countered' }, has: ['Ezért nem triggerel: Kennen, Heart of the Tempest triggere'] },
  },
  {
    id: 'khazix-star', cat: 'Reakció-ablak', lg: ["Kha'Zix, Voidreaver", 'Diana, Scorn of the Moon'], flag: 0,
    q: "A Diana játékos Rebuke-kal visszaküldené a Kha'Zix-et. Mentheted a legend \"Spend 2 XP, [T]: Move an exhausted friendly unit ... to its base\" abilityjével?",
    a: "Nem: a legend abilityjén nincs [Reaction], ezért zárt állapotban, a chainen lévő Rebuke-ra válaszként nem aktiválható (338.1.a.1, 310.1.a). Válaszként a [Reaction] lapod jöhet: a Star-Crossed a Kha'Zix-et és Diana, Lunarit a tulajdonosuk kezébe adja, a Rebuke célpontja zónát vált, ezért a Rebuke Ignored (359.3.e.2, 359.3.e.6).",
    refs: '338.1.a.1, 310.1.a, 813.1.c.2, 359.3.e.2, 359.3.e.6', src: [S_KHAZIX, S_DIANA],
    cs: () => base({ turn: 'B', lg: { A: "Kha'Zix, Voidreaver", B: 'Diana, Scorn of the Moon' }, ps: { A: { xp: 2 } },
      bd: [{ n: "Kha'Zix, Mutating Horror", pl: 'A', loc: 'bf0', ex: true }, { n: 'Diana, Lunari', pl: 'B', loc: 'bf0' }],
      steps: [card('Rebuke', 'B', ['b0']), ab('LA', 1, "Kha'Zix, Voidreaver", 'A', ['b0']), card('Star-Crossed', 'A', ['b0', 'b1'])] }),
    expect: { items: ['Star-Crossed', 'Rebuke'], st: { Rebuke: ['ignored'] }, illegal: 1, obj: { b0: { zone: 'hand' }, b1: { zone: 'hand' } } },
  },
  {
    id: 'draven-axe', cat: 'Reakció-ablak', lg: ['Draven, Glorious Executioner', "Rek'Sai, Void Burrower"], flag: 0,
    q: 'Falling Star a Draven, Showboatra. A Spinning Axe Quick-Draw-val jöhet válaszként, és a Falling Star előtt csatolódik?',
    a: 'Igen: a Quick-Draw [Reaction]-t ad, és "When you play this, attach it to a unit you control" trigger (819.1.b, 819.1.d). A gear azonnal a boardra kerül (337.2), a csatoló trigger a Falling Star fölé kerül, ezért előbb resolve-ol (340.1). A felcsatolt Spinning Axe Might bónusza már él, amikor a 3 damage megérkezik (435.1.c).',
    refs: '819.1.b, 819.1.d, 337.2, 340.1, 435.1.c', src: [S_DRAVEN, S_REKSAI],
    cs: () => base({ turn: 'B', lg: { A: 'Draven, Glorious Executioner', B: "Rek'Sai, Void Burrower" },
      bd: [{ n: 'Draven, Showboat', pl: 'A', loc: 'bf0' }, { n: "Kai'Sa, Survivor", pl: 'A', loc: 'bf0' }],
      steps: [card('Falling Star', 'B', ['b0', 'b1']), card('Spinning Axe', 'A', ['b0'])] }),
    expect: { items: ['Spinning Axe (play trigger)', 'Falling Star'], st: { 'Falling Star': ['executed', 'executed'] }, obj: { b0: { zone: 'board' } } },
  },
  /* ---------- Triggerek sorrendje ---------- */
  {
    id: 'vex-sett', cat: 'Triggerek sorrendje', lg: ['Vex, Gloomist', 'Sett, The Boss'], flag: 0,
    q: 'A Sett játékos kijátssza a Pit Rookie-t, az ellenfél Vex, Apathetic-je egy battlefielden áll. Melyik trigger resolve-ol előbb?',
    a: 'A unit kijátszása a resolve-jával fejeződik be, ekkor triggerel a Pit Rookie play effectje és a Vex "When an opponent plays a unit" triggere (337.2, 420.4.a). Egyszerre triggerelt, különböző controllerű abilityknél először a turn player teszi fel a sajátját, utána az ellenfél (383.3.d.1); ami később kerül fel, előbb resolve-ol (340.1). Ezért a Vex stunja fut le előbb, a buff utána.',
    refs: '337.2, 420.4.a, 383.3.d.1, 340.1', src: [S_VEX, S_SETT],
    cs: () => base({ turn: 'A', lg: { A: 'Sett, The Boss', B: 'Vex, Gloomist' },
      bd: [{ n: 'Sett, Kingpin', pl: 'A', loc: 'bf0' }, { n: 'Vex, Apathetic', pl: 'B', loc: 'bf0' }],
      steps: [card('Pit Rookie', 'A', ['b0'], { loc: 'bf0' })] }),
    expect: { items: ['Vex, Apathetic triggere', 'Pit Rookie (play trigger)'], has: ['383.3.d.1', 'Pit Rookie Stunned lesz'], obj: { b0: { bu: true } } },
  },
  {
    id: 'nasus-watcher', cat: 'Triggerek sorrendje', lg: ['Nasus, Curator of the Sands', 'Kennen, Heart of the Tempest'], flag: 0,
    q: 'Thousand-Tailed Watcher Accelerate-tel: triggerel a Nasus legend, és milyen sorrendben fut a két trigger?',
    a: 'A Nasus a kijátszott lap nyomtatott költségét nézi, ami 7 Energy, a költségmódosítás és az Accelerate nem számít (206). Mindkét trigger a te abilityd, a sorrendet te választod (383.3.d). A "you may exhaust me" a chainre tételkor dől el (383.3.a). A Watcher "-3, to a minimum of 1" hatása minden enemy unitra vonatkozik, nem célzás (355.10.d).',
    refs: '206, 383.3.d, 383.3.a, 355.10.d, 805.1.b', src: [S_NASUS, S_KENNEN],
    cs: () => base({ turn: 'A', lg: { A: 'Nasus, Curator of the Sands', B: 'Kennen, Heart of the Tempest' },
      bd: [{ n: 'Fizz, Trickster', pl: 'B', loc: 'bf0' }, { n: 'Kennen, Storm of Shuriken', pl: 'B', loc: 'bf0' }],
      steps: [card('Thousand-Tailed Watcher', 'A', [], { accel: true })] }),
    expect: { items: ['Nasus, Curator of the Sands triggere', 'Thousand-Tailed Watcher (play trigger)'], has: ['nyomtatott költsége 7 Energy', '383.3.d'] },
  },
  {
    id: 'irelia-choose', cat: 'Triggerek sorrendje', lg: ['Irelia, Blade Dancer'], flag: 0,
    q: 'Discipline az exhausted Irelia, Fervent-re. Mi triggerel, milyen sorrendben, és mekkora lesz a Mightja?',
    a: 'A célpont kiválasztása Targeting Effectet indít: az Irelia, Fervent "When you choose or ready me" és a legend "When you choose a friendly unit" triggere a Discipline fölé kerül (383.4.b, 383.4.b.2); a sorrendet te választod (383.3.d). A legend "you may exhaust me and pay [A]" része a chainre tételkor dől el (383.3.a, 383.3.b). Ha a legend triggere fut előbb, a ready újabb Fervent triggert ad. Az eredmény: 4 + 1 + 1 + 2 = 8 Might.',
    refs: '383.4.b, 383.4.b.2, 383.3.d, 383.3.a, 383.3.b', src: [S_IRELIA],
    cs: () => base({ turn: 'A', lg: { A: 'Irelia, Blade Dancer', B: '' },
      bd: [{ n: 'Irelia, Fervent', pl: 'A', loc: 'bf0', ex: true }],
      steps: [card('Discipline', 'A', ['b0'])] }),
    expect: { items: ['Irelia, Blade Dancer triggere (Irelia, Fervent kiválasztva)', 'Irelia, Fervent triggere (ready lett)', 'Irelia, Fervent triggere (Irelia, Fervent kiválasztva)', 'Discipline'], has: ['Mightja 6 → 8'], obj: { LA: { ex: true }, b0: { ex: false } } },
  },
  {
    id: 'irelia-dd', cat: 'Triggerek sorrendje', lg: ['Irelia, Blade Dancer', 'Sett, The Boss'], flag: 0,
    q: 'Defiant Dance egy saját és egy enemy unitra. Hányszor triggerel az Irelia legend?',
    a: 'Egyszer: a "When you choose a friendly unit" csak a saját unit kiválasztására triggerel, az enemy unitra nem (383.4.b, 383.4.b.3). A trigger a Defiant Dance fölé kerül, ezért a ready előbb történik meg, mint a +2 és a -2 (383.4.b.2, 340.1).',
    refs: '383.4.b, 383.4.b.2, 383.4.b.3, 340.1', src: [S_IRELIA, S_SETT],
    cs: () => base({ turn: 'A', lg: { A: 'Irelia, Blade Dancer', B: 'Sett, The Boss' },
      bd: [{ n: 'Tideturner', pl: 'A', loc: 'bf0', ex: true }, { n: 'Sett, Kingpin', pl: 'B', loc: 'bf0' }],
      steps: [card('Defiant Dance', 'A', ['b0', 'b1'])] }),
    expect: { items: ['Irelia, Blade Dancer triggere (Tideturner kiválasztva)', 'Defiant Dance'], obj: { b0: { ex: false } } },
  },
  /* ---------- Hidden és Ambush ---------- */
  {
    id: 'kaisa-kennen', cat: 'Hidden és Ambush', lg: ["Kai'Sa, Daughter of the Void", 'Kennen, Heart of the Tempest'], flag: 0,
    q: 'Kai\'Sa Falling Starral lő Kennenre és a Tideturnerre; Kennen facedown-ból Switcheroo-t játszik ki. Empowered lesz a Kennen legend, és túléli a Tideturner?',
    a: 'A facedown lap [Reaction]-t kap, és facedown-ból kijátszva válaszként jöhet (811.6); a célpontjait csak azon a battlefielden választhatja, ahol el volt rejtve (811.1.d.2). A facedown-ból kijátszás "anywhere other than your hand", ezért a Switcheroo resolve-jakor a Kennen legend Empowered lesz (420.4.a). A Mightok cseréje után a Tideturner 4 Mightú, így a 3 damage nem öli meg (434.1).',
    refs: '811.6, 811.1.d.2, 420.4.a, 434.1', src: [S_KAISA, S_KENNEN],
    cs: () => base({ turn: 'A', lg: { A: "Kai'Sa, Daughter of the Void", B: 'Kennen, Heart of the Tempest' }, bf: [{ n: '', c: 'B', fd: 'B', fdn: 'Switcheroo' }, { n: '', c: '' }],
      bd: [{ n: "Kai'Sa, Survivor", pl: 'A', loc: 'bf0' }, { n: 'Kennen, Storm of Shuriken', pl: 'B', loc: 'bf0' }, { n: 'Tideturner', pl: 'B', loc: 'bf0' }],
      steps: [card('Falling Star', 'A', ['b1', 'b2']), card('Switcheroo', 'B', ['b0', 'b2'], { from: 'facedown', loc: 'bf0' })] }),
    expect: { items: ['Switcheroo', 'Kennen, Heart of the Tempest triggere', 'Falling Star'], obj: { LB: { emp: true }, b2: { zone: 'board' } } },
  },
  {
    id: 'evelynn-once', cat: 'Hidden és Ambush', lg: ["Evelynn, Agony's Embrace", 'Sett, The Boss'], flag: 0,
    q: 'Evelynn az ellenfél körében két facedown Switcheroo-t játszik ki egymás után. Hányszor húz, és el kell dobnia?',
    a: 'A legend "Once each turn" trigger: csak az első facedown kijátszásra triggerel (383.3.e.1). A trigger a Switcheroo resolve-jakor jön (420.4.a): húz 1-et, és mivel nem az ő köre, utána eldob 1-et. A második Switcheroo-ra már nem triggerel. A facedown lap a kijátszás körében [Reaction]-ként jön (811.6).',
    refs: '383.3.e.1, 420.4.a, 811.6', src: [S_EVE, S_SETT],
    cs: () => base({ turn: 'B', lg: { A: "Evelynn, Agony's Embrace", B: 'Sett, The Boss' }, bf: [{ n: '', c: 'A', fd: 'A', fdn: 'Switcheroo' }, { n: '', c: 'A', fd: 'A', fdn: 'Switcheroo' }],
      bd: [{ n: 'Sett, Kingpin', pl: 'B', loc: 'bf0' }, { n: 'Evelynn, In Control', pl: 'A', loc: 'bf0' }, { n: 'Pit Rookie', pl: 'B', loc: 'bf1' }, { n: 'First Mate', pl: 'B', loc: 'bf1' }],
      hand: { A: [{ id: 'zhA_1', n: "Hold 'Em" }, { id: 'zhA_2', n: 'Demon Shade' }], B: [] }, zseq: 2,
      steps: [card('Switcheroo', 'A', ['b0', 'b1'], { from: 'facedown', loc: 'bf0' }), R, R, card('Switcheroo', 'A', ['b2', 'b3'], { from: 'facedown', loc: 'bf1' })] }),
    expect: { items: ['Switcheroo (1.)', "Evelynn, Agony's Embrace triggere", 'Switcheroo (4.)'], has: ['most nem triggerel, mert ebben a körben már egyszer triggerelt'] },
  },
  {
    id: 'rengar-ambush', cat: 'Hidden és Ambush', lg: ['Rengar, Pridestalker', "Kai'Sa, Daughter of the Void"], flag: 0,
    q: 'Az ellenfél Hextech Rayt lő a Pit Rookie-ra. Jöhet válaszként az Inferna [Ambush]-sal, és hová?',
    a: 'Az Ambush [Reaction]-t ad, de csak amíg olyan battlefieldre játszod ki, ahol unitod van (822.1.b); oda, ahol nincs unitod, válaszként nem jöhet (822.3). A Pit Rookie mellé kijátszva legális, és a Rengar legend "When you play a unit, give a unit +1" triggere a Hextech Ray fölé kerül (420.4.a, 340.1).',
    refs: '822.1.b, 822.3, 420.4.a, 340.1', src: [S_RENGAR, S_KAISA],
    cs: () => base({ turn: 'B', lg: { A: 'Rengar, Pridestalker', B: "Kai'Sa, Daughter of the Void" },
      bd: [{ n: 'Pit Rookie', pl: 'A', loc: 'bf0' }, { n: "Kai'Sa, Survivor", pl: 'B', loc: 'bf0' }],
      steps: [card('Hextech Ray', 'B', ['b0']), card('Inferna', 'A', [], { loc: 'bf1' }), card('Inferna', 'A', [], { loc: 'bf0' })] }),
    expect: { items: ['Rengar, Pridestalker triggere', 'Hextech Ray'], illegal: 1, has: ['822.1.b'] },
  },
  /* ---------- Költség és erőforrás ---------- */
  {
    id: 'azir-weaponmaster', cat: 'Költség és erőforrás', lg: ['Azir, Emperor of the Sands'], flag: 2,
    q: 'Doran\'s Shield után az Azir legend Sand Soldiert hoz. A Weaponmaster miatt ingyen felcsatolható a Doran\'s Shield ([Equip] [C])?',
    a: 'A Sand Soldier a legendtől kapja a Weaponmastert, ez play effect: a választott Equipment Equip költsége [A]-val csökken (821.1.c). Ha a költség nem tartalmaz [A]-t, kifizethető, de nem csökken (821.1.c.3). A [C] a lap domainjének Powere (135.2.e.6), és a Core Rules nem dönti el, hogy egy [C] költség "tartalmaz-e" [A]-t. Ez nyitott kérdés, judge dönt.',
    alt: ['Ha a [C] tartalmaz [A]-t: a költség [A]-val csökken, a Doran\'s Shield ingyen csatolódik.', 'Ha nem: a teljes [C] fizetendő, csökkentés nélkül (821.1.c.3); a csatolás így is megtörténik.'],
    refs: '821.1.c, 821.1.c.3, 135.2.e.6', src: [S_AZIR],
    cs: () => base({ turn: 'A', lg: { A: 'Azir, Emperor of the Sands', B: '' },
      steps: [card("Doran's Shield", 'A'), R, ab('LA', 0, 'Azir, Emperor of the Sands', 'A'), R] }),
    expect: { items: ['Azir, Emperor of the Sands abilityje', 'Sand Soldier token Weaponmaster triggere'], has: ['nyitott kérdés'], flag2: true, obj: { s0: { on: 'k1' } } },
  },
  {
    id: 'ornn-sterak', cat: 'Költség és erőforrás', lg: ['Ornn, Fire Below the Mountain', "Kai'Sa, Daughter of the Void"], flag: 0,
    q: 'Falling Star az Ornn, Blacksmithre és a Pit Crew-ra. Az Ornn legend Add-jával kijátszott Sterak\'s Gage megmenti a Pit Crew-t?',
    a: 'Az Ornn legend Add-ja azonnal resolve-ol, nem lehet rá reagálni (401.2, 430.2), és a Power gear kijátszására használható. A Sterak\'s Gage Quick-Draw-val [Reaction] (819.1.b), a gear azonnal a boardra kerül, a csatoló trigger és a Pit Crew "When you play a gear, ready me" triggere egyszerre triggerel; a sorrendet te választod (383.3.d). Mindkettő a Falling Star előtt resolve-ol, a Pit Crew 6 Mightú lesz, a 3 damage nem öli meg.',
    refs: '401.2, 430.2, 819.1.b, 819.1.d, 383.3.d, 435.1.c', src: [S_ORNN, S_KAISA],
    cs: () => base({ turn: 'A', lg: { A: "Kai'Sa, Daughter of the Void", B: 'Ornn, Fire Below the Mountain' },
      bd: [{ n: 'Ornn, Blacksmith', pl: 'B', loc: 'bf0' }, { n: 'Pit Crew', pl: 'B', loc: 'bf0', ex: true }],
      steps: [card('Falling Star', 'A', ['b0', 'b1']), ab('LB', 0, 'Ornn, Fire Below the Mountain', 'B'), card("Sterak's Gage", 'B', ['b1'])] }),
    expect: { items: ['Pit Crew triggere', "Sterak's Gage (play trigger)", 'Falling Star'], obj: { b1: { zone: 'board', ex: false } } },
  },
  {
    id: 'yi-defy', cat: 'Költség és erőforrás', lg: ['Master Yi, Wuju Bladesman (Starter)', "Kai'Sa, Daughter of the Void"], flag: 0,
    q: 'Falling Star a két Master Yi-ra. Counterelheted Defy-jal? Ha nem, mi menti meg a Tempered-et?',
    a: 'Nem: a Defy csak "no more than [4] and no more than [A]" költségű spellt counterel, a Falling Star nyomtatott költsége 2 Energy és 2 Power, a 2 Power több, mint [A] (206, 131.3.a). A Discipline (+2 Might) legális válasz, a Tempered 6 Mightú lesz és túléli. A Master Yi, Tempered Deflectje [Level 6] feltételhez kötött, 6 XP alatt nem él, ezért nem kell érte plusz Powert fizetni (824.1.c).',
    refs: '206, 131.3.a, 824.1.c, 809.1.c', src: [S_YI, S_KAISA], note: 'Master Yi, Wuju Bladesman (Starter): 2v2-ben tiltott legend.',
    cs: () => base({ turn: 'B', lg: { A: 'Master Yi, Wuju Bladesman (Starter)', B: "Kai'Sa, Daughter of the Void" },
      bd: [{ n: 'Master Yi, Tempered', pl: 'A', loc: 'bf0' }, { n: 'Rengar, Trophy Hunter', pl: 'A', loc: 'bf0' }],
      steps: [card('Falling Star', 'B', ['b0', 'b1']), card('Defy', 'A', ['s0']), card('Discipline', 'A', ['b0'])] }),
    expect: { items: ['Discipline', 'Falling Star'], illegal: 1, has: ['Power költsége 2, a feltétel legfeljebb 1', '824.1.c'], obj: { b0: { zone: 'board' } } },
  },
  {
    id: 'ezreal-twice', cat: 'Legend saját interakciója', lg: ['Ezreal, Prodigal Explorer', "Kai'Sa, Daughter of the Void"], flag: 0,
    q: 'Mikor aktiválható az Ezreal legend "Use only if you\'ve chosen enemy units and/or gear twice this turn" feltétellel?',
    a: 'A választás célzást jelent (355.7): spellel vagy unit abilityvel kétszer kell enemy unitot vagy geart választanod ebben a körben. Egy Stupefy után még nem aktiválható, a második után igen; a legend [Reaction], ezért válaszként is jöhet (813.1.c.2). Ha egyetlen spell választ két enemy célpontot, a Core Rules nem mondja meg, hogy ez egy vagy két választás; ezt az elemzés nyitott kérdésként jelzi.',
    refs: '355.7, 813.1.c.2', src: [S_EZREAL, S_KAISA],
    cs: () => base({ turn: 'A', lg: { A: 'Ezreal, Prodigal Explorer', B: "Kai'Sa, Daughter of the Void" },
      bd: [{ n: "Kai'Sa, Survivor", pl: 'B', loc: 'bf0' }, { n: 'Ravenbloom Student', pl: 'B', loc: 'bf0' }],
      steps: [card('Stupefy', 'A', ['b0']), R, ab('LA', 0, 'Ezreal, Prodigal Explorer', 'A'), card('Stupefy', 'A', ['b1']), R, ab('LA', 0, 'Ezreal, Prodigal Explorer', 'A')] }),
    expect: { items: ['Stupefy (1.)', 'Stupefy (4.)', 'Ezreal, Prodigal Explorer abilityje'], illegal: 1, has: ['eddig 1 spell vagy unit ability', 'ebben a körben 2 spell vagy unit ability'] },
  },
  /* ---------- Deathknell és replacement ---------- */
  {
    id: 'ornn-ga', cat: 'Deathknell és replacement', lg: ['Ornn, Fire Below the Mountain', "Kai'Sa, Daughter of the Void"], flag: 0,
    q: 'A Guardian Angel megmenti a Scuttle Crabet. Lefut a Scuttle Crab Deathknellje?',
    a: 'Nem: a halál helyett a Guardian Angel replacement effectje fut le, a Scuttle Crab gyógyulva, exhausted a base-be kerül (369.1, 457). A Deathknell trigger feltétele, hogy a lap a trashbe kerüljön; ha a kill helyettesítve van, a trigger lekerül a chainről (808.1.d, 808.1.d.1). A Guardian Angel maga a trashbe kerül.',
    refs: '369.1, 457, 808.1.d, 808.1.d.1', src: [S_ORNN, S_KAISA],
    cs: () => base({ turn: 'A', lg: { A: "Kai'Sa, Daughter of the Void", B: 'Ornn, Fire Below the Mountain' },
      bd: [{ n: 'Scuttle Crab', pl: 'B', loc: 'bf0' }, { n: 'Guardian Angel', pl: 'B', loc: 'bf0', on: 0 }, { n: 'Pit Crew', pl: 'B', loc: 'bf0' }],
      steps: [card('Falling Star', 'A', ['b0', 'b2'])] }),
    expect: { items: ['Falling Star'], has: ['808.1.d.1'], obj: { b0: { zone: 'board', loc: 'base' }, b1: { zone: 'trash' }, b2: { zone: 'trash' } } },
  },
  {
    id: 'leblanc-karthus', cat: 'Deathknell és replacement', lg: ['LeBlanc, Deceiver', 'Viktor, Herald of the Arcane'], flag: 0,
    q: 'Karthus, Eternal mellett meghal a Black Rose Dignitary. Hányszor channelölsz?',
    a: 'Kétszer: a Karthus miatt a Deathknell még egyszer triggerel (a lap szövege: "Your [Deathknell] effects trigger an additional time"). A triggerek a kill közben, a lap trashbe kerülése előtt kerülnek a chainre (808.1.d.2); több Deathknell külön triggerel, a sorrendet a controller választja (808.2, 808.2.a).',
    refs: '808.1.d.2, 808.2, 808.2.a', src: [S_LEBLANC, S_VIKTOR],
    cs: () => base({ turn: 'B', lg: { A: 'LeBlanc, Deceiver', B: 'Viktor, Herald of the Arcane' },
      bd: [{ n: 'Karthus, Eternal', pl: 'A', loc: 'base' }, { n: 'Black Rose Dignitary', pl: 'A', loc: 'bf0' }],
      steps: [card('Hidden Blade', 'B', ['b1'])] }),
    expect: { items: ['Hidden Blade', 'Black Rose Dignitary triggere (Deathknell)', 'Black Rose Dignitary triggere (Deathknell)'], has: ['Karthus, Eternal miatt'] },
  },
  {
    id: 'sett-boss', cat: 'Deathknell és replacement', lg: ['Sett, The Boss', 'Viktor, Herald of the Arcane'], flag: 0,
    q: 'Hidden Blade a buffolt Sett, Kingpinre, a Sett legend megmenti. A Hidden Blade "Its controller draws 2" része lefut?',
    a: 'A legend replacement effectje a halál helyett fut le: a buff elfogy, a unit gyógyulva, exhausted a base-be kerül, a legend exhausted lesz (369.1, 457). A kill így Negated, nem Ignored, mert a célpont legális maradt (359.3.e.6). Negated linked instruction után a későbbi utasítás végrehajtódik, ezért a Sett játékos húz 2-t (359.3.e.14.b).',
    refs: '369.1, 457, 359.3.e.6, 359.3.e.14.b', src: [S_SETT, S_VIKTOR],
    cs: () => base({ turn: 'B', lg: { A: 'Sett, The Boss', B: 'Viktor, Herald of the Arcane' },
      bd: [{ n: 'Sett, Kingpin', pl: 'A', loc: 'bf0', bu: true }],
      steps: [card('Hidden Blade', 'B', ['b0'])] }),
    expect: { items: ['Hidden Blade'], st: { 'Hidden Blade': ['negated', 'executed'] }, obj: { b0: { zone: 'board', loc: 'base', bu: false }, LA: { ex: true } } },
  },
  /* ---------- Mistarget ---------- */
  {
    id: 'diana-gust', cat: 'Mistarget: Ignored vagy Negated', lg: ['Diana, Scorn of the Moon', "Kai'Sa, Daughter of the Void"], flag: 0,
    q: 'Falling Star Diana, Lunarira és a Ravenbloom Studentre; Diana Gusttal a kezébe menti Lunarit. Mi lesz a Falling Starral és a Studenttel?',
    a: 'A Gust resolve-ja után a Ravenbloom Student "When you play a spell" triggere +1-et ad (420.4.a). A Falling Star első utasítása Ignored, mert a célpontja zónát váltott (359.3.e.2, 359.3.e.6); a második végrehajtódik, mert az utasítások külön célpontot választanak (359.3.e.8). A Student 3 Mightú, a 3 damage megöli.',
    refs: '420.4.a, 359.3.e.2, 359.3.e.6, 359.3.e.8', src: [S_DIANA, S_KAISA],
    cs: () => base({ turn: 'A', lg: { A: "Kai'Sa, Daughter of the Void", B: 'Diana, Scorn of the Moon' },
      bd: [{ n: "Kai'Sa, Survivor", pl: 'A', loc: 'bf0' }, { n: 'Diana, Lunari', pl: 'B', loc: 'bf0' }, { n: 'Ravenbloom Student', pl: 'B', loc: 'bf0' }],
      steps: [card('Falling Star', 'A', ['b1', 'b2']), card('Gust', 'B', ['b1'])] }),
    expect: { items: ['Gust', 'Ravenbloom Student triggere', 'Falling Star'], st: { 'Falling Star': ['ignored', 'executed'] }, obj: { b1: { zone: 'hand' }, b2: { zone: 'trash' } } },
  },
  {
    id: 'rengar-thrill', cat: 'Mistarget: Ignored vagy Negated', lg: ['Rengar, Pridestalker', "Kai'Sa, Daughter of the Void"], flag: 0,
    q: 'Falling Star a Rengar, Trophy Hunterre; Rengar Thrill of the Hunttal banisheli és újra kijátssza. Mi éri a Falling Starból?',
    a: 'A banish és az újrakijátszás után a Rengar új objektum, ezért a Falling Star rá szóló utasítása Ignored (359.3.e.4, 359.3.e.6); a másik célpontra szóló végrehajtódik (359.3.e.8). Az újrakijátszás nem kézből történik (420.3), a Rengar legend "When you play a unit" triggere így is triggerel (420.4.a).',
    refs: '359.3.e.4, 359.3.e.6, 359.3.e.8, 420.3, 420.4.a', src: [S_RENGAR, S_KAISA],
    cs: () => base({ turn: 'B', lg: { A: 'Rengar, Pridestalker', B: "Kai'Sa, Daughter of the Void" },
      bd: [{ n: 'Rengar, Trophy Hunter', pl: 'A', loc: 'bf0' }, { n: 'Inferna', pl: 'A', loc: 'bf0' }],
      steps: [card('Falling Star', 'B', ['b0', 'b1']), card('Thrill of the Hunt', 'A', ['b0'], { dest: 'bf0' })] }),
    expect: { items: ['Thrill of the Hunt', 'Rengar, Pridestalker triggere', 'Falling Star'], st: { 'Falling Star': ['ignored', 'executed'] } },
  },
  {
    id: 'viktor-cull', cat: 'Mistarget: Ignored vagy Negated', lg: ['Viktor, Herald of the Arcane', 'Vex, Gloomist'], flag: 0,
    q: 'Viktor Recruit tokent hoz, aztán Cull the Weak. Kiválaszthatja a Recruitot, és célzás-e ez (Deflect)?',
    a: 'A "Each player kills one of their units" nem célzás, minden játékos a resolve-kor választ a saját unitjai közül (355.10.e, 355.18), ezért a Deflect sem számít. A Recruit token kijátszása kijátszás (350.2), így a Vex, Apathetic stun triggere is triggerel rá. A Cull the Weak csak a stun trigger lefutása után jöhet, mert nem [Reaction] (338.1.a.1).',
    refs: '355.10.e, 355.18, 350.2, 338.1.a.1', src: [S_VIKTOR, S_VEX],
    cs: () => base({ turn: 'A', lg: { A: 'Viktor, Herald of the Arcane', B: 'Vex, Gloomist' },
      bd: [{ n: 'Viktor, Leader', pl: 'A', loc: 'bf0' }, { n: 'Vex, Apathetic', pl: 'B', loc: 'bf1' }],
      steps: [ab('LA', 0, 'Viktor, Herald of the Arcane', 'A'), R, R, card('Cull the Weak', 'A', [], { mp: { 0: { A: 'k1', B: 'b1' } } })] }),
    expect: { items: ['Viktor, Herald of the Arcane abilityje', 'Vex, Apathetic triggere', 'Cull the Weak'], obj: { k1: { zone: 'trash' }, b1: { zone: 'trash' }, b0: { zone: 'board' } } },
  },
  /* ---------- Copy ---------- */
  {
    id: 'leblanc-mirror', cat: 'Copy', lg: ['LeBlanc, Deceiver', 'Master Yi, Wuju Bladesman (Starter)'], flag: 0,
    q: 'Mirror Image a Disciplinetől 6 Mightú Master Yi, Tempered-re. Hány Mightú a Reflection?',
    a: '4 Mightú: a másolat a nyomtatott (copyable) jellemzőket kapja, a "this turn" Might módosítás, a buff és a damage nem másolódik (446.1, 479.1.b). A token token marad, a play effectje nem fut le, és [Temporary]-t kap.',
    refs: '446.1, 479.1.b', src: [S_LEBLANC, S_YI],
    cs: () => base({ turn: 'A', lg: { A: 'LeBlanc, Deceiver', B: 'Master Yi, Wuju Bladesman (Starter)' },
      bd: [{ n: 'Master Yi, Tempered', pl: 'B', loc: 'bf0' }],
      steps: [card('Discipline', 'B', ['b0']), R, card('Mirror Image', 'A', ['b0'])] }),
    expect: { items: ['Discipline', 'Mirror Image'], has: ['Mightja 4 \\(a nyomtatott érték'] },
  },
  /* ---------- Accelerate és Legion ---------- */
  {
    id: 'reksai-voidrush', cat: 'Accelerate és Legion', lg: ["Rek'Sai, Void Burrower"], flag: 1,
    q: 'Void Rush felfedi a Noxus Hopefult és a Falling Start. A banishből kijátszott Noxus Hopeful kap Legiont és Accelerate-et?',
    a: 'A Legion él, mert ebben a körben már finalizáltál egy másik lapot, a Void Rusht (812.1.c); a Void Rush és a Legion csökkentése összeadódik. A Rek\'Sai, Breacher a nem kézből kijátszott friendly unitnak Accelerate-et ad, ezért a Noxus Hopeful readyként léphet be, ha kifizeted (805.1.b, 805.6). A nem banishelt Falling Start a kezedbe húzod ("Draw any you didn\'t banish").',
    refs: '812.1.c, 805.1.b, 805.6, 420.3', src: [S_REKSAI],
    cs: () => base({ turn: 'A', lg: { A: "Rek'Sai, Void Burrower", B: '' }, deck: { A: [{ id: 'zdA_1', n: 'Noxus Hopeful' }, { id: 'zdA_2', n: 'Falling Star' }], B: [] }, zseq: 2,
      bd: [{ n: "Rek'Sai, Breacher", pl: 'A', loc: 'base' }],
      steps: [card('Void Rush', 'A', [], { zp: { 1: ['zdA_1'] }, pll: { 2: 'base' }, accel: true })] }),
    expect: { items: ['Void Rush'], has: ['ready lép be', 'Falling Star a kézbe kerül'] },
  },
  /* ---------- Conquer ---------- */
  {
    id: 'reksai-sanctum', cat: 'Conquer', lg: ["Rek'Sai, Void Burrower"], flag: 0,
    q: 'Rek\'Sai conquer és a The Candlelit Sanctum conquer triggere egyszerre: melyik fut előbb, és mi jön a deck tetejéről?',
    a: 'Mindkét trigger a tiéd, a sorrendet te választod (383.3.d). A Rek\'Sai "you may exhaust me" költsége a chainre tételkor dől el (383.3.a, 383.3.b). A Sanctum fölül futva előbb rendezi a deck tetejét, a Rek\'Sai utána ezt a két lapot fedi fel; a hatásból kijátszott unit Accelerate-et kap a Breachertől (805.1.b). A triggerek között reakció-ablak van (340.1).',
    refs: '383.3.d, 383.3.a, 383.3.b, 805.1.b, 340.1', src: [atl("Rischster (Rek'Sai, The Candlelit Sanctum)")],
    note: 'A felhasználó kérésére készült sablon (Gem Jammer, Ki Barrier, Bilgewater Tracker); a The Candlelit Sanctum battlefield a forrás deckből való.',
    cs: tplCs('reksai-sanctum'),
    expect: { items: ['The Candlelit Sanctum triggere (When you conquer here)', "Rek'Sai, Void Burrower triggere (When you conquer)", 'Ki Barrier', 'Bilgewater Tracker play triggere'] },
  },
  /* ---------- Level és XP ---------- */
  {
    id: 'azir-yi-level', cat: 'Level és XP', lg: ['Master Yi, Wuju Bladesman (Starter)', 'Azir, Emperor of the Sands'], flag: 0,
    q: '6 XP-vel Hidden Blade a Master Yi, Tempered-re: kell plusz Power a Deflect miatt?',
    a: 'Igen: a [Level 6] képesség akkor aktív, ha a controllernek legalább 6 XP-je van (824.1.c), ekkor a Tempered Deflectet kap, és az ellenfélnek plusz Powert kell fizetnie a kiválasztásáért (809.1.c). 6 XP alatt nem kell (lásd a Defy példát).',
    refs: '824.1.c, 809.1.c', src: [S_YI, S_AZIR],
    cs: () => base({ turn: 'B', lg: { A: 'Master Yi, Wuju Bladesman (Starter)', B: 'Azir, Emperor of the Sands' }, ps: { A: { xp: 6 } },
      bd: [{ n: 'Master Yi, Tempered', pl: 'A', loc: 'bf0' }],
      steps: [card('Hidden Blade', 'B', ['b0'])] }),
    expect: { items: ['Hidden Blade'], has: ['Deflect: Master Yi, Tempered \\(1\\)'] },
  },
];
