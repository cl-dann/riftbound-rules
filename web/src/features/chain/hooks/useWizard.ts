import { useMemo, useRef, useState } from 'react';
import { searchCards } from '../chainBuild';
import type { Wiz } from '../types';

/** A mobilos lépés-varázsló (max. 700 px) állapota: a lépés, a kártyakereső szövege és találatai, az extra mezők helye.
    A lépések közti átmenetet a ChainEditor vezérli (openWiz, wizBack, wizEnd), mert a pálya állapotát is érinti. */
export function useWizard() {
  const [wiz, setWiz] = useState<Wiz | null>(null);
  const [wq, setWq] = useState('');
  const wres = useMemo(() => (wiz?.st === 'card' ? searchCards('play', wq, 30) : []), [wiz?.st, wq]);
  const xref = useRef<HTMLDivElement>(null);
  return { wiz, setWiz, wq, setWq, wres, xref };
}
