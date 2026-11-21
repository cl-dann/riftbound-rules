/* A Chain fül közös állapota (zustand/vanilla): a helyzet (CS), az utolsó elemzés és a lejátszási frame-ek. A legacy builder
   űrlapja (legacyForm.ts) és a pályás építő (ChainView) ugyanezt olvassa és írja; korábban a chainApi singleton, az
   rb:chain-cs és rb:chain-frames események és a csv számláló. A CS objektumot a builder helyben módosítja, ezért a
   változást a ver számláló jelzi (a csv utódja); új helyzetnél (betöltés, sablon, link) a cs mező is cserélődik. */
import { createStore } from 'zustand/vanilla';
import type { ChainState } from '../../domain/chain/state';
import type { ChainResult } from '../../domain/chain/engine/ctx';
import type { ChainFrame } from './chainBuild';

export type TrigAdd = { n: string; src: string; pl: 'A' | 'B'; eff: string; why: string; loc?: string };
export type CombatOut = { bf: string; dead: string[]; recall: string[]; ctrl: '' | 'A' | 'B'; label: string };
/** A legacy builder műveletei, az initChain() tölti fel. */
export type ChainActions = {
  moveUnit: (uid: string, loc: string) => string | null;
  addTriggers: (list: TrigAdd[], cb: CombatOut) => void;
  commit: (fn: (cs: ChainState) => void, ms?: number) => void;
  set: (cs: ChainState) => void;
  moveStep: (from: number, to: number) => boolean;
  delStep: (j: number) => void;
  delBd: (i: number) => void;
  quick: (el: HTMLElement | null, j: number) => void;
  stateEl: (el: HTMLElement | null) => void;
  openAdv: (j: number) => void;
};
export type ChainStore = {
  cs: ChainState;
  /** Az utolsó teljes elemzés (riporttal). */
  last: ChainResult | null;
  frames: ChainFrame[];
  /** Változásszámláló: minden CS módosítás és új elemzés után nő. */
  ver: number;
  /** A változás a pályás építőből jött (a lejátszás pozíciója marad). */
  internal: boolean;
  /** Az initChain() után igaz; addig az api üres. */
  ready: boolean;
  api: ChainActions;
};
export const EMPTY_CS = (): ChainState => ({ lg: { A: '', B: '' }, bf: [{ n: '', c: '' }, { n: '', c: '' }], bd: [], steps: [], hand: { A: [], B: [] }, ch: { A: '', B: '' } });

export const chainStore = createStore<ChainStore>(() => ({ cs: EMPTY_CS(), last: null, frames: [], ver: 0, internal: false, ready: false, api: {} as ChainActions }));
/** Rövidítések a pályás építőnek: az aktuális helyzet és a builder műveletei. */
export const getCS = () => chainStore.getState().cs;
export const chainActions = () => chainStore.getState().api;
export const bumpChain = () => chainStore.setState((s) => ({ ver: s.ver + 1 }));
