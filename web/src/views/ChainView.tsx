import { useEffect, useRef } from 'react';
import { initChain } from '../legacy/chain';

/** A Chain elemző egyelőre imperatív modul; a React csak a gyökér elemet adja neki. */
export function ChainView() {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useEffect(() => { if (!done.current && ref.current) { done.current = true; initChain(ref.current); } }, []);
  return <div ref={ref} />;
}
