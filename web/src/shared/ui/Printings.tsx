import { useEffect, useState } from 'react';
import { IMGBASE } from '../../domain/data/store';
import type { Card } from '../../domain/data/schema';
import { eur, pn } from '../../domain/deck/edit';
import type { PriceRow, Prices } from '../../domain/deck/prices';
import { loadPrices } from '../lib/prices';
export function usePrices() {
  const [p, setP] = useState<Prices | null>(null);
  useEffect(() => { let on = true; loadPrices().then((x) => on && setP(x)); return () => { on = false; }; }, []);
  return p;
}

type Row = PriceRow;
const SETN: Record<string, string> = { ogn: 'Origins', ogs: 'Proving Grounds', sfd: 'Spiritforged', unl: 'Unleashed', ven: 'Vendetta', rad: 'Radiance' };

/** A nyomat típusa a gyűjtői számból: betűs utótag alternatív kép, a szett méreténél nagyobb szám Overnumbered. */
function kind(num: string, rar: string) {
  const out: string[] = [rar];
  const m = /^(\d+)([a-z]*)(?:-(star))?-(\d+)$/.exec(num);
  if (m) {
    if (m[2]) out.push('alternatív kép');
    if (+m[1] > +m[4]) out.push('Overnumbered');
    if (m[3]) out.push('csillagos változat');
  } else if (/^sp/.test(num)) out.push('különleges sorozat');
  return out.join(' · ');
}
function priceCell(r: Row | undefined) {
  if (!r) return <span className="na">nincs Cardmarket ár</span>;
  const n = r.a7 ?? r.a1, f = r.f7 ?? r.f1;
  return (
    <>
      {n != null && <span title={'1 napos átlag: ' + eur(r.a1)}><b>{eur(n)}</b> <small>normál, 7 nap</small></span>}
      {f != null && <span title={'1 napos átlag: ' + eur(r.f1)}><b>{eur(f)}</b> <small>foil, 7 nap</small></span>}
      {n == null && f == null && <span className="na">nincs friss eladás</span>}
    </>
  );
}

export function Printings({ card }: { card: Card }) {
  const P: Prices | null = usePrices();
  const [big, setBig] = useState<string | null>(null);
  const pr: Card['pr'] = card.pr || [];
  const ex: Row[] = (P?.ex && (P.ex[pn(card.n)] || P.ex[pn(card.fk || '')])) || [];
  if (!pr.length) return null;
  return (
    <section className="prints">
      <h3>Nyomatok és árak<span className="n">{pr.length} nyomat{P ? ', Cardmarket ' + String(P.updated).slice(0, 10) : ''}</span></h3>
      <div className="pgrid">
        {pr.map(([code, , set, num, rar, img]) => (
          <figure key={code} className="pcard">
            <button onClick={() => setBig(img)} aria-label={'Nagyítás: ' + set + ' ' + num}><img loading="lazy" src={IMGBASE + img + '?w=240'} alt={card.n + ', ' + set + ' ' + num} /></button>
            <figcaption>
              <b>{set}</b> <span className="mono">{num}</span>
              <span className="kind">{kind(num, rar)}</span>
              <span className="price">{P ? priceCell(P.pr?.[code]) : <span className="na">ár betöltése</span>}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {!!ex.length && (
        <details className="pex">
          <summary>További Cardmarket kiadások ({ex.length})</summary>
          <p className="note">Promó, rendezvényes vagy más kiadások, amelyeket a Cardmarket adatából nem lehet egy nyomatunkhoz rendelni. A kiadás neve a Cardmarket termékoldalán látszik.</p>
          <ul>{ex.map((r) => <li key={r.id}><span>{r.s ? SETN[r.s] + ' körüli kiadás' : 'Egyéb kiadás'}</span>{priceCell(r)}</li>)}</ul>
        </details>
      )}
      <p className="note">Az árak a Cardmarket nyilvános árlistájából jönnek, kézi frissítéssel. A nyomat és a Cardmarket termék párosítása a kiadás és a sorrend alapján történik; ahol ez nem egyértelmű, ott nincs ár a nyomatnál, és a termék a "További Cardmarket kiadások" alatt szerepel.</p>
      {big && <div className="pbig" role="dialog" aria-label="Nagy kép" onClick={() => setBig(null)}><img src={IMGBASE + big + '?w=744'} alt="" /></div>}
    </section>
  );
}
