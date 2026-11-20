/* A Chain fül: a builder (Haladó szerkesztés) imperatív modul; a React a pályás építőt a #cb-viz helyre portálozza.
   A részek a features/chain alatt: ChainEditor (pályás építő), StepPanel, ActionMenu, CardPicker, PropsPanel, Arrows,
   MistargetBox, CombatPanel; hookok a hooks/ alatt. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import { initChain } from './legacyForm';
import { chainStore } from './store';
import { ChainEditor } from './ChainEditor';
import type { ChainFrame } from './chainBuild';

export type { ChainFrame };


/** A Chain fül: a builder (Haladó szerkesztés) imperatív modul; a React a pályás építőt a #cb-viz helyre portálozza. */
export function ChainView() {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  // A frame-ek és a változásszámláló a közös store-ból (store.ts); a StrictMode dupla effectje ellen a done ref véd.
  const frames = useStore(chainStore, (s) => s.frames);
  const csv = useStore(chainStore, (s) => s.ver);
  const ready = useStore(chainStore, (s) => s.ready);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!done.current && ref.current) { done.current = true; initChain(ref.current); }
    setSlot(ref.current?.querySelector<HTMLElement>('#cb-viz') || null);
  }, []);
  return <div ref={ref}>{slot && ready && createPortal(<ChainEditor frames={frames} csv={csv} />, slot)}</div>;
}
