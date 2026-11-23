/* A chain elemzés kimenete és közös állapota. */
import type { ChainState, ChainStep } from '../state';
import type { Card } from '../../data/schema';
import type { CardLike, Cond, EachCnt, Instr, StepInfo, TargetParam } from '../types';
import type { ZoneRef } from '../zones';
import type { CostCtx } from '../cost';
import type { allScope } from '../actions';

/** Might módosító (layer-egyszerűsítés): n a változás, min az alsó korlát, dbl a duplázás. */
export type Mod = { n: number; min?: number | null; dbl?: boolean };
/** A boardot elhagyó lap utolsó ismert adatai (last known information). */
export type LastKnown = { m?: number | null; ctrl?: string | null; loc?: string; kws?: string[]; alone?: boolean | null };
/** Egy objektum a helyzetben: board lapja, legend, kijátszott lap, célpont, token, zónás lap (zc). */
export type GameObj = {
  id: string; name: string; card?: CardLike | null; ctrl: string | null; own: string | null; zone: string; type: string;
  loc?: string; baseOf?: string | null; m?: number | null; dmg?: number; dealt?: boolean; atk?: string; ex?: boolean; st?: boolean;
  bu?: boolean; emp?: boolean; mods?: Mod[]; kws?: string[]; board?: boolean; lk?: LastKnown | null; shields?: { n: number; next?: boolean; used?: boolean }[] | null;
  save?: { pay: boolean; src: string } | null; dbl?: boolean | null; dieTo?: string | null; baseSet?: number | null; untgt?: boolean | null; prev?: unknown;
  until?: { src: string; prev: string | null } | null; ord?: number; gen?: number; on?: string | null; accel?: boolean; accelG?: boolean; src?: string;
  stepJ?: number; token?: boolean; toHand?: boolean; zone0?: string;
  /** Copy effect (479.1.b): a másolt lap nyomtatott (vagy maga is másolt) jellemzői. */
  copyOf?: CardLike | null;
  /** "banished with this/me": a forrás, amelynek hatása banishelte (Cursed Sarcophagus, The Zero Drive, Jhin) */
  banWith?: string | null;
  /** Shady Spectacles: a copy effectet adó Equipment és a másolás előtti jellemzők */
  copyBy?: string | null; orig?: { card: CardLike | null | undefined; name: string; m: number | null | undefined } | null;
  /** Példányszám, ha a lapból több van a pályán (instNos). */
  no?: number;
};
/** Egy célpont kézzel megadott adatai a lépésben (ext): játékos, hely, Might. */
export type ExtEntry = { pl?: string; loc?: string; m?: number | null };
/** Egy lépés az elemzésben: a builder lépése, a lapból értelmezett adatok (stepInfo) és az elemzés jelölései. */
export type EStep = ChainStep & StepInfo & {
  j: number; pl: string; tg: string[]; ext: Record<string, ExtEntry>; it?: ChainItem; illegal?: string | null; illTiming?: boolean;
  illTarget?: boolean; trigBad?: string; pays?: unknown; objId?: string;
};
/** A kijátszás triggerjeinek forrása (playTrigs): egy lépés vagy egy létrejött token. */
export type PlaySrc = { c: CardLike; j: number; pl: string; from?: string; objId?: string };
/** Egy elem a chainen: lépésből (step), triggerből (auto) vagy késleltetett hatásból; a resolve közben jelölések kerülnek rá. */
export type ChainItem = {
  kind: string; label: string; name?: string; pl: string; eff: string; list: TargetParam[]; tg: string[]; src?: string | null;
  s?: EStep; perm?: boolean | null; from?: string | null; loc?: string | null; objId?: string | null; dest?: string; ov?: ChainStep['ov'];
  pays?: unknown; may?: boolean; isTg?: boolean; isTr?: boolean; evPlay?: number; ev0?: number; soM?: number | null; soName?: string;
  notedLoc?: string | null; why?: string; sent?: boolean; lk?: { loc?: string }; trigBy?: CardLike; trigId?: string; fxCard?: CardLike; selfObj?: string; dk?: boolean;
  zpGen?: Record<string, number>; rdBefore?: number; dropT?: Set<number>; prot758?: string[]; pre?: string[]; lkMight?: number | null;
  hit?: string[]; flL?: boolean; fl2?: boolean; mp?: Record<string, string>; raiseBase?: string | null; paid?: boolean; kwSrc?: string | null; endTrig?: boolean;
  coNote?: string; zAmongCard?: string | null; zRunes?: number | null; zRuneId?: string; zRuneD?: string; basedVal?: Record<number, unknown>; zRev?: string; zLastT?: string; zLastN?: string; zGuess?: string; zBurn?: string[]; zAmongDone?: boolean; zTop?: string; zLook?: string[]; zEach?: Record<string, string>;
  zEachTop?: Record<string, string>; zDisc?: string; zDivine?: boolean; zKeep?: Set<string>; dl?: boolean;
};
/** Egy esemény a naplóban (EV): k a fajta, a többi a fajta adatai. */
export type Ev = {
  k: string; id?: string; name?: string; pl?: string | null; n?: number; t?: string; from?: string | number | null; to?: string | number | null; loc?: string;
  by?: string | null; item?: string; baseOf?: string | null; cleanup?: boolean; replay?: boolean; spent?: boolean; kw?: string; all?: string[]; recycle?: boolean;
};
/** Késleltetett hatás (391.2). */
export type Delayed = { t: string; who: string; src: string; srcId: string | null; on: string[]; ids: string[]; n?: number; done?: boolean };
/** Egy lefutott elem eredménye. */
export type Done = { name: string; pl: string; res: string };
/** Egy unit vagy gear a frame boardján. */
export type UnitView = {
  id: string; n: string; m: number; dmg: number; ex: boolean; gear: string[]; status: string[]; kind?: string; base?: number;
  mods?: string[]; token?: boolean; tag?: string;
  /** Példányszám (#1, #2), ha a lapból több van a pályán. */
  no?: number;
};
export type SideView = {
  legend?: string; legendEx: boolean; base: UnitView[]; hand: string[]; trash: string[]; banish: string[];
  zids?: { hand: string[]; trash: string[] }; deck?: number;
};
export type BfView = { name: string; ctrl: string | null; me: UnitView[]; opp: UnitView[] };
/** A mistarget panel adatai. */
export type MtTarget = { n: string; ok: boolean; skip?: boolean; why?: string };
export type MtView = { item: string; kind: string; targets: MtTarget[]; instr: { t: string; st: string; ref: string; why: string; man?: boolean }[] };
/** Egy lejátszási frame. */
export type Frame = {
  label: string; board: { me: SideView; opp: SideView; bfs: BfView[]; chain: string[] }; changes: RecRow[];
  arrows: { from: number; to: string }[]; bfi: number[]; mt: MtView | null; sj?: number;
};
/** A zónás választás pillanatképe lépésenként (a pályás építő ehhez igazítja a választható lapokat). */
export type ZSnap = { board: string[]; ctx: CostCtx; hand: Record<string, string[]>; trash: Record<string, string[]>; deck: Record<string, string[]> };
/** A lefutott elemek összegzése (items). */
export type ItemView = { name: string; res: string; instr: { k?: string; lk?: boolean; ref: string; st: string; t: string }[]; targets: MtTarget[] };
/** Battlefield az elemzésben: a lap és a kontroll. */
export type BfState = { c: Card | null; ctrl?: string };
/** A riport adatai (nem felsorolható mező a kimeneten). */
export type Report = {
  S: EStep[]; O: Record<string, GameObj>; BF: Record<string, BfState>; CS: ChainState; done: Done[]; story: string[]; notes: string[];
  rows: string; rr: string; delayed: Delayed[]; locLabel: (l: string | null | undefined) => string; mightOf: (id: string) => number | null;
};
export type ChainResult = {
  frames: Frame[]; html: string; story: string[]; done: Done[]; rows: RecRow[]; ev: Ev[]; objs: Record<string, GameObj>;
  items: ItemView[]; delayed: Delayed[]; empty: boolean; zsnap?: Record<number, ZSnap>; report?: Report;
};
/** Az enterReady() eredménye. */
export type ReadyInfo = { ready: boolean; why: string; note?: string };
/** A halál helyettesítése (deathRepl). */
export type DeathRepl = { by: string | null; txt: string | undefined; dieTo?: string; save?: boolean; self?: boolean };
/** Szabálysor: [szabályszámok, szöveg, (kézi jelölés)]. */
export type RecRow = [string, string, number?];
/** A játékállapot számolói (ST), a feltételek kiértékeléséhez. */
export type StateFns = { xpOf: (p: string) => number; scoreOf: (p: string) => number; VS: () => number; diedT: (p: string, gearToo: boolean) => boolean };

/** Egy chain elem resolve-jának állapota (resolveItem0 és a lépései): t a szabálysor eleje, fl a flag, tot és legal a célpontszámláló,
    lastT a legutóbbi célpontos utasítás (a linked instructions ehhez kötődnek). */
export type ResolveRun = {
  it: ChainItem; s: EStep; perm: boolean; self: GameObj | null; srcName: string; INS: Instr[]; parts: string[]; refs: string[];
  tgOut: string[]; mtT: MtTarget[]; t: string; fl: number; legal: number; tot: number; lastT: Pick<Instr, 'tis' | 'st' | 'act' | 't'> | null;
  /** az ebben a resolve-ban létrehozott tokenek, és a copy effecttel másolattá vált tokenek */
  made?: string[]; copied?: string[];
};
/** Egy lépés kijátszásának állapota (playStep, playCheck, playLegal): a lap, az időzítés, a szöveg eleje, a tétel,
    a költségként megölt unit (costV), a kötelező trigger-választások (pick) és a play effect legalitási hibája (trigBad). */
export type PlayRun = {
  s: EStep; ix: number; c: CardLike; tm: string; perm: boolean | null | undefined; empty: boolean; Verb: string; what: string; it: ChainItem;
  costV: string | null; pick: [string, string, number][]; trigBad: string | null;
};
/** A zónás utasítás jelzői (resolvePlain számolja, resolveZone használja). */
export type ZoneStep = { zr0: ZoneRef | null; zEach: ZoneRef | null; zpick: string[] | null; amongIt: unknown; zTopUse: unknown; restM: unknown; eachOn: unknown };
/** A linked utasítás előzménye (ResolveRun.lastT). */
type PrevInstr = ResolveRun['lastT'];

/** A chain elemzés közös állapota és függvényei (EngineCtx): a runChain() minden korábbi belső változója és
    függvénye ennek a mezője, így a csoportok (engine/*) külön modulban élhetnek. Az install<Csoport>() tölti ki a függvényeket. */
export type EngineCtx = {
  CS: ChainState; MT: MtView | null; MTIDS: Set<string>; S: EStep[]; POST: EStep[]; MAIN: EStep[]; AFTER: EStep[]; out: ChainResult; REC: RecRow[] | null;
  MAN: boolean; ALL: RecRow[]; EV: Ev[]; story: string[]; rows: string; rr: string; notes: string[]; O: Record<string, GameObj>;
  BF: Record<string, BfState>; ZC: boolean; zcK: Record<string, string>; cnt: Record<string, number>; FR: Frame[]; DET: Set<string>;
  NEWCTRL: Set<string>; chain: ChainItem[]; stack: ChainItem[]; REPL: Set<string>; READY: Record<string, boolean>;
  BUFF2: Record<string, boolean>; PREVSA: { on: boolean }; READYNEXT: Record<string, boolean>; ACCELNEXT: Record<string, boolean>; ZIL: Record<string, boolean>; LASTON: Record<string, string>; LKX: Record<string, { st: boolean; bu: boolean }>; MORDE: Record<string, boolean>; RDK: Record<string, boolean>; RPK: Record<string, boolean>; RSEQ: number; CHEX: Record<string, number>; ST: StateFns;
  PSD: Record<string, number | string>; TP: string; PEND: ChainItem[]; DIED: string[]; TOKN: number; PTN: Set<string>; done: Done[];
  guard: number; it0: ChainItem | null; parts0: string[]; refs1: string[]; tgOut0: string[]; mtT0: MtTarget[]; tot0: { n: number };
  legal0: { n: number }; INRES: boolean; ENDED: boolean;
  itemOf: (s: EStep) => ChainItem; playMain: () => void; playEnd: () => void; playRes: () => void;
  playStep: (s: EStep, ix: number) => void; playCheck: (P: PlayRun) => boolean; playLegal: (P: PlayRun) => void; cleanup: () => void; bonusDmg: (pl: string) => number;
  dealDmg: (v: string, n: number, parts: string[], refs: string[], note?: string) => number;
  kwVal: (id: string, kw: string) => number; countEach: (cnt: EachCnt, it: ChainItem, tv?: string | null) => number | null;
  endStep: () => void; expiration: () => void;
  applyTo: (v: string, act: Instr['act'], it: ChainItem, parts: string[], refs: string[]) => string | void;
  pside: (p: string | null | undefined) => 'me' | 'opp' | null; itemName: (it: ChainItem) => string;
  snap: (label: string, items: ChainItem[], sj?: number) => void; LOCS: () => [string, string][]; locLabel: (l: string | null | undefined) => string;
  line: (ref: string, txt: string, fl?: number | null) => string; bfC: (n: string | undefined) => Card | null; onB: (id: string) => boolean;
  mightOf: (id: string) => number | null; BUF2: (p: string | null) => boolean; lethal: (id: string) => boolean;
  zcMove: (id: string, to: string) => void; zoneIds: (z: string, p: string) => string[];
  zcWhy: (zr: ZoneRef, ids: string[], pl: string, res: boolean, ctx?: CostCtx) => string; zctx: (it: ChainItem, s: EStep | null | undefined) => CostCtx;
  nm: (id: string) => string; deathRepl: (id: string) => DeathRepl | null;
  killObj: (id: string, why: string, parts: string[], refs: string[], srcName?: string) => 'ok' | 'neg';
  resolveAll: () => void; evalState: (cd: Cond, it: ChainItem, s: EStep | null | undefined, tv: string | null | undefined) => boolean | null;
  condSrc: (cd: Cond) => string; evalCond: (cd: Cond | null | undefined, it: ChainItem, s: EStep | null | undefined, xi: number, tv: string | null | undefined) => boolean | null;
  splitRun: (x: Instr, prev: Pick<Instr, 'tis' | 'st' | 'act' | 't'> | null | undefined) => void; resolveItem: (it: ChainItem) => void; resolveItem0: (it: ChainItem) => void;
  resolveTarget: (R: ResolveRun, x: Instr, ti: number) => void; resolveTargetX: (R: ResolveRun, x: Instr, ti: number) => void;
  resolveSubsets: (R: ResolveRun) => void; resolveFinish: (R: ResolveRun) => void; resolveInstr: (R: ResolveRun, x: Instr, xi: number) => void;
  resolvePlain: (R: ResolveRun, x: Instr, xi: number, prev: PrevInstr, lk: boolean) => void;
  resolveZone: (R: ResolveRun, x: Instr, xi: number, Z: ZoneStep) => boolean;
  resolveAct: (R: ResolveRun, x: Instr, xi: number, prev: PrevInstr, lk: boolean, live: number[], a: Instr['act'], sc: ReturnType<typeof allScope>) => void;
  bfBlocksBase: (l: string | null | undefined) => unknown; bfBlocksPlay: (l: string | null | undefined) => unknown; PSv: (p: string, k: string) => number | string;
  VS: () => number; evSum: (k: string, p: string) => number; xpOf: (p: string) => number; scoreOf: (p: string) => number;
  runesOf: (p: string) => number; runeDeckOf: (p: string) => number; playedBefore: (p: string, j: number) => Set<string>;
  enterReady: (c: CardLike | null | undefined, pl: string, accel: boolean, loc?: string, erd?: string, selfId?: string, addc?: boolean) => ReadyInfo;
  selfRef: (t: string) => boolean; srcLoc: (it: ChainItem, phase?: string) => string | null | undefined;
  chooseOnlyWhy: (it: ChainItem, ob: GameObj, phase: string) => string[]; itemEnergy: (it: ChainItem) => number | null;
  tgWhy: (it: ChainItem, p: TargetParam, v: string, ti: number, phase: string) => string[];
  tgWhy0: (it: ChainItem, p: TargetParam, v: string, ti: number, phase: string) => string[];
  legalOpts: (it: ChainItem, p: TargetParam, ti: number) => string[];
  createTokens: (t: string, it: ChainItem, parts: string[], refs: string[], times: number) => string[];
  copyOnto: (ids: string[], srcId: string, parts: string[], refs: string[]) => void;
  playBanished: (R: ResolveRun, x: Instr, xi: number) => void; fxSpell: (pc: CardLike, pl: string, from: string) => string; mordeVictims: (id: string) => string[];
  expandBased: (it: ChainItem, INS: Instr[]) => void;
  channelRunes: (p: string, n: number, ex: boolean) => string; recycleRunes: (ids: string[]) => void; poolIds: (p: string) => string[]; autoTg: (item: ChainItem) => string; fxEnter: (pc: CardLike, pl: string, to: string, pid: string, s: EStep | null | undefined, fromHand: boolean) => ReadyInfo;
  equipCopy: (G: GameObj, U: GameObj, srcId: string | undefined, pl: string, parts: string[], refs: string[]) => void; copyEnd: () => string[];
  pushTrig: (t: ChainItem) => void; deathWatch: () => void; flushPend: (target: ChainItem[]) => void;
  leaveTrigs: (id: string, dk: boolean) => void; playTrigs: (s: PlaySrc) => ChainItem[]; abTrigs: (s: EStep) => ChainItem[];
  setCtrl: (id: string, to: string | null, ref: string, why: string, until?: string) => boolean; leaveBoard: (id: string, zone: string) => void;
  moveObj: (id: string, to: string, parts: string[], refs: string[], srcName: string, toBase?: string) => 'ok' | 'neg';
};
