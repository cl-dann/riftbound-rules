import { useMemo } from 'react';
import type { ChainState } from '../../../domain/chain/state';
import { stepInfo } from '../../../domain/chain/steps';
import { targetOpts, zoneCands, zonePicks, type TgOpt, type ZCand } from '../chainBuild';
import type { Mode } from '../types';

/** A pályás építő legalitás-adatai az aktuális módhoz: célzásnál a választható célpontok (mindegyikre lefuttatott
    elemzéssel) és a célpont-paraméter, zónás választásnál a jelölt lapok. A CS változását a csv jelzi. */
export function useChainLegality(CS: ChainState, mode: Mode, csv: number) {
  const tOpts = useMemo<TgOpt[]>(() => (mode?.k === 'target' ? targetOpts(CS, mode.j, mode.ti) : []), [mode, csv]); // eslint-disable-line react-hooks/exhaustive-deps
  const zCands = useMemo<ZCand[]>(() => (mode?.k === 'zpick' ? zoneCands(CS, mode.j, mode.xi) : []), [mode, csv]); // eslint-disable-line react-hooks/exhaustive-deps
  const tInf: any = mode?.k === 'target' && CS.steps[mode.j] ? stepInfo(CS, CS.steps[mode.j]) : null; // eslint-disable-line @typescript-eslint/no-explicit-any
  const tSlot = tInf?.list?.[mode?.k === 'target' ? mode.ti : 0];
  const zInfo = mode?.k === 'zpick' ? zonePicks(CS, mode.j).find((z) => z.xi === mode.xi) : undefined;
  return { tOpts, zCands, tInf, tSlot, zInfo };
}
