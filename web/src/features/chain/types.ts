import type { PickKind } from './chainBuild';

/* ---------- kártyakereső ---------- */
export type PickAt = { kind: PickKind; side?: 'me' | 'opp'; loc?: string; bfi?: number; sideFree?: boolean };
/* ---------- akció-menü ---------- */
export type MItem = { label: string; run?: () => void; dis?: string; ref?: string; tone?: string; need?: string; step?: boolean };
export type Menu = { title: string; card?: string; sub?: string; items: MItem[]; key: string };
export type Wiz = { st: 'card' | 'action' | 'target' | 'extra'; j?: number; menu?: Menu; pick?: string; side: 'me' | 'opp'; preset?: 'res' | 'end' | 'next'; hadT?: boolean };
export type Mode =
  | { k: 'target'; j: number; ti: number }
  | { k: 'move'; uid: string; n: string; dests: string[]; std: boolean }
  | { k: 'hide'; side: 'me' | 'opp'; hi: string; n: string; dests: number[] }
  | { k: 'hpick'; j: number; f: 'so' | 'plc'; xi: number; side: 'me' | 'opp'; unit: boolean }
  | { k: 'zpick'; j: number; xi: number }
  | null;
