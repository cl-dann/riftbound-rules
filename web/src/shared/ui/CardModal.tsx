import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cardHeadHTML, cardRulesHTML } from '../../render/html/card';
import { CARDS } from '../../domain/data/store';
import { Html } from './Html';
import { Printings } from './Printings';
import { on } from '../lib/events';
import { loadDetails } from '../../domain/data/load';

/** Kártyalap felugró ablakban. Bármelyik nézet megnyithatja: window 'rb:open-card' esemény, detail = kártyanév. */
export function CardModal() {
  const [card, setCard] = useState<any>(null);
  useEffect(() => {
    // A lap részletei (jegyzetek, Gyakori kérdések, nyomatok) a megnyitás előtt töltődnek be, ha még nincsenek meg.
    return on('rb:open-card', (n) => {
      const c = CARDS.find((x: any) => x.n === n);
      if (c) loadDetails().then(() => setCard(c));
    });
  }, []);
  return (
    <Dialog.Root open={!!card} onOpenChange={(o) => !o && setCard(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-[fade_.15s_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="rb-modal fixed left-1/2 top-[4vh] z-50 max-h-[92vh] w-[min(980px,94vw)] -translate-x-1/2 overflow-y-auto rounded-xl border border-[var(--gold-line)] bg-[var(--panel)] p-6 shadow-2xl"
          onClick={(e) => {
            const s = (e.target as HTMLElement).closest('button[data-sim]') as HTMLElement | null;
            if (s) { const c = CARDS.find((x: any) => x.n === s.dataset.sim); if (c) { setCard(c); (e.currentTarget as HTMLElement).scrollTop = 0; } }
          }}
        >
          <Dialog.Title className="sr-only">{card?.n}</Dialog.Title>
          <Dialog.Close className="absolute right-4 top-4 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--ink)]" aria-label="Bezárás">
            <X size={20} />
          </Dialog.Close>
          {card && (<>
            <Html html={cardHeadHTML(card, 'h2')} />
            <Printings card={card} />
            <Html html={'<h3 class="rb-sep">Erre a kártyára érvényes szabályok</h3>' + cardRulesHTML(card)} />
          </>)}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
