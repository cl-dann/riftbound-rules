/* A chain értelmező és elemző közös típusai: lapszöveg-értelmezés (célpont-paraméter, művelet, feltétel, utasítás,
   ability, trigger, költség), a lépés értelmezése (StepInfo), és az elemző objektumai (játékobjektum, chain tétel,
   esemény, frame). A mezők a futás közben ténylegesen előforduló értékekből (golden esetek) és a kódból állnak össze. */
import type { Card } from '../data/schema';
import type { CostCond } from './cost';

/** Kártya vagy kártyaszerű érték: a valódi lap, vagy a Resolve és Kör vége lépés üres lapja, vagy a pályán kívüli célpont. */
export type CardLike = Partial<Card> & { n: string; t: string };
export type Pl = string;

/** Célpont-paraméter a lapszövegből ("a unit", "up to two enemy units", "a friendly [Mighty] unit"). */
export type TargetParam = {
  pre?: boolean;
  type: string; rel: string; max?: number | null; bf?: boolean; same?: boolean; totalMax?: number | null; opt?: boolean;
  here?: boolean; free?: boolean; base?: boolean; eq?: boolean; mighty?: boolean; another?: boolean;
  equipOnly?: boolean; attacking?: boolean; stunned?: boolean; any?: boolean; orAb?: boolean; chooseOnly?: boolean;
  cost?: CostCond | null; split?: boolean;
  /** csak a régi felismerésben (withLegacyPhrases): feltétel-tagmondatbeli kifejezés, az új felismerés kihagyja */
  cond?: boolean;
  /** "there": a trigger feltételéből feljegyzett location (359.3.f.3), ha van */
  there?: boolean;
  /** Shady Spectacles: a csatoláskor választott, másolandó unit; nem az utasítás célpontja */
  copySrc?: boolean;
};
/** Feltétel ("If ..."): how = known, state, board, user, open, hidden; key a játékállapot kulcsa. */
export type Cond = { t: string; how: string; why?: string; key?: string; from?: string; val?: unknown; refs?: string; zn?: string; tie?: boolean };
/** "for each" szorzó: cnt a boardon megszámolható leírás. */
export type EachCnt = { other?: boolean; st?: string; rel?: string; type?: string; where?: string; mighty?: boolean; eqOn?: string; kills?: boolean; bfs?: boolean };
/** cnt: a boardról megszámolható; miss: a hiányzó adat, ha nem számolható. */
export type EachInfo = { cnt?: EachCnt; txt?: string; miss?: string };
/** Kézi mező a lapnál (num vagy sel), alapértékkel. */
export type OvField = { type: string; label: string; def: number | string; opts?: string[] | [string, string][]; [k: string]: unknown };
/** Laponkénti kézi hatásleírás (overrides.ts). */
export type CardOv = { re: RegExp; k: string; d: string; refs: string; open?: boolean; hidden?: boolean; field?: OvField; why?: string; [x: string]: unknown };
/** Egy utasítás művelete (actOf): k a művelet, a többi a művelet paraméterei. */
export type Act = {
  k: string; n?: number | null; unless?: boolean; next?: boolean; who?: string; split?: boolean; unsure?: string; inner?: string;
  self?: boolean; free?: boolean; from?: string; re?: RegExp; d?: string; refs?: string; field?: OvField; ov?: CardOv; cond?: Cond | null;
  pick?: boolean | string; otherwise?: boolean; hidden?: boolean; alt?: boolean; min?: number | null; opts?: string[]; act?: string;
  kw?: string; all?: string[]; fromPrev?: boolean; exhSelf?: boolean; fvWhy?: string; scope?: string; until?: string; toSelf?: boolean; to?: string; each?: EachInfo;
  body?: string; tags?: string[]; onlyThere?: boolean; distinct?: boolean; rel?: string; open?: boolean; pay?: boolean;
  t?: string; fv?: string | number; bonus?: number; toHand?: boolean; tokenText?: string;
  [k: string]: unknown;
};
/** Egy utasítás értelmezése (interp): szöveg, célpont-indexek, felismert és használt művelet, linked kapcsolat. */
export type Instr = {
  t: string; n: number; tis: number[]; det: Act; act: Act; lk: boolean; detLk: boolean; dir: boolean; manual: boolean;
  unsure: string[]; st: string; ref: string; why: string;
  /** A resolve jelölései: előkészítés, a feltétel értéke, az alternatíva. */
  prep?: string; cv?: boolean | null; altBy?: string; altUsed?: boolean; noted?: number; zDone?: boolean;
};
/** Activated ability (abilitiesOf). */
export type Ability = { label: string; eff: string; tm: string; cost: string; add?: boolean; empower?: boolean; equip?: boolean };
/** Triggered ability (triggersOf). */
export type Trigger = { label: string; eff: string; why: string; modal?: boolean; opts?: string[]; dk?: boolean };
/** Additional cost (costOf). */
export type CostInfo = { kill: { opt: boolean; mighty: boolean } | null; opt: boolean; txt: string };
/** Egy lépés értelmezése (stepInfo). */
export type StepInfo = {
  c: CardLike; eff: string; list: TargetParam[]; trig?: boolean; may?: boolean; cost?: CostInfo; cond?: string | null; modes?: string[];
  tcond?: Cond | null; repN?: number; tr?: Trigger | null; isTg?: boolean; killSelf?: boolean; rep?: number; repModes?: number[]; repBad?: string;
  ab?: Ability | null; isAb?: boolean; isTr?: boolean;
};
