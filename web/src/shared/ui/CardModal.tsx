import * as Dialog from '@radix-ui/react-dialog';
import { Link2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cardHeadHTML, cardRulesHTML } from '../../render/html/card';
import { CARDS } from '../../domain/data/store';
import { cardSlug } from '../../domain/data/cards';
import type { Card } from '../../domain/data/schema';
import { Html } from './Html';
import { Printings } from './Printings';
import { on } from '../lib/events';
import { loadDetails } from '../../domain/data/load';

/** Kártyalap felugró ablakban. Bármelyik nézet megnyithatja: window 'rb:open-card' esemény, detail = kártyanév. */
export function CardModal() {
  const [card, setCard] = useState<Card | null>(null);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    // Lapoldalról érkezve (card/<slug>/ -> #kartya/<slug>) a kártya-ablak nyílik meg.
    const fromHash = () => {
      const m = /^#kartya\/([a-z0-9-]+)$/.exec(location.hash);
      const c = m && CARDS.find((x) => cardSlug(x.n) === m[1]);
      if (c) loadDetails().then(() => setCard(c));
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);
  useEffect(() => setCopied(''), [card]);
  const close = () => { setCard(null); if (/^#kartya\//.test(location.hash)) history.replaceState(null, '', '#kartyak'); };
  const copyLink = async () => {
    if (!card) return;
    const u = new URL('card/' + cardSlug(card.n) + '/', location.href.split('#')[0]).href;
    try { await navigator.clipboard.writeText(u); setCopied('A link a vágólapra került: ' + u); } catch { setCopied('Másold ki: ' + u); }
  };
  useEffect(() => {
    // A lap részletei (jegyzetek, Gyakori kérdések, nyomatok) a megnyitás előtt töltődnek be, ha még nincsenek meg.
    return on('rb:open-card', (n) => {
      const c = CARDS.find((x) => x.n === n);
      if (c) loadDetails().then(() => setCard(c));
    });
  }, []);
  return (
    <Dialog.Root open={!!card} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-[fade_.15s_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="rb-modal fixed left-1/2 top-[4vh] z-50 max-h-[92vh] w-[min(980px,94vw)] -translate-x-1/2 overflow-y-auto rounded-xl border border-[var(--gold-line)] bg-[var(--panel)] p-6 shadow-2xl"
          onClick={(e) => {
            const s = (e.target as HTMLElement).closest('button[data-sim]') as HTMLElement | null;
            if (s) { const c = CARDS.find((x) => x.n === s.dataset.sim); if (c) { setCard(c); (e.currentTarget as HTMLElement).scrollTop = 0; } }
          }}
        >
          <Dialog.Title className="sr-only">{card?.n}</Dialog.Title>
          <Dialog.Close className="absolute right-4 top-4 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--ink)]" aria-label="Bezárás">
            <X size={20} />
          </Dialog.Close>
          {card && (<>
            <Html html={cardHeadHTML(card, 'h2')} />
            <p className="rb-share"><button type="button" className="btn sec sm" onClick={copyLink}><Link2 size={14} aria-hidden /> Link másolása</button>
              <span className="note" role="status">{copied}</span></p>
            <Printings card={card} />
            <Html html={'<h3 class="rb-sep">Erre a kártyára érvényes szabályok</h3>' + cardRulesHTML(card)} />
          </>)}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
