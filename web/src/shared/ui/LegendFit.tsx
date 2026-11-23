import { useMemo } from 'react';
import { CARDS, IMGBASE } from '../../domain/data/store';
import type { Card } from '../../domain/data/schema';
import { legendsFor } from '../../domain/deck/legends';
import { refHash } from '../../domain/rules/refs';

const refLinks = (r: string) => r.split(/,\s*/).map((x) => <a key={x} href={refHash(x)} data-ref={x}>{x}</a>);

/** "Melyik legenddel játszható": a Core Rules deck-építési szabályai (103) szerint, a legendek kártyaképével; kattintásra a legend lapja nyílik. */
export function LegendFit({ card, onPick }: { card: Card; onPick: (c: Card) => void }) {
  const fit = useMemo(() => legendsFor(card, CARDS), [card]);
  if (!fit) return null;
  const chosen = new Set(fit.chosen);
  return (
    <section className="lfit">
      <h3>Melyik legenddel játszható<span className="n">{fit.all ? 'mindegyikkel' : fit.legends.length + ' legend'}</span></h3>
      <ul className="lfit-why">{fit.why.map(([r, t]) => <li key={r + t}><span className="lfit-ref">{refLinks(r)}</span><span>{t}</span></li>)}</ul>
      {!fit.all && !!fit.legends.length && (
        <ul className="lfit-grid">
          {fit.legends.map((L) => (
            <li key={L.n}>
              <button type="button" onClick={() => onPick(L)} title={L.n + ((L.d || []).length ? ' (' + L.d.join(' + ') + ')' : '')}>
                {L.img ? <img loading="lazy" src={IMGBASE + L.img + '?w=160'} alt="" /> : <span className="lfit-noimg" />}
                <span className="lfit-n">{L.n}</span>
                {chosen.has(L) && <span className="lfit-tag">Chosen Champion</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
