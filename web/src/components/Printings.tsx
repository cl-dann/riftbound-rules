import { useEffect, useState } from 'react';
import { IMGBASE } from '../legacy/core';
import { eur, pn, type Prices } from '../views/deckEdit';

// Az árfájl egyszer töltődik be, minden nézet ugyanazt használja.
let cache: Promise<Prices | null> | null = null;
export function loadPrices(): Promise<Prices | null> {
  if (!cache) cache = fetch('./prices.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return cache;
}
export function usePrices() {
  const [p, setP] = useState<Prices | null>(null);
  useEffect(() => { let on = true; loadPrices().then((x) => on && setP(x)); return () => { on = false; }; }, []);
  return p;
}

type Row = { a1: number | null; a7: number | null; f1: number | null; f7: number | null; id: number; s?: string | null };
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

export function Printings({ card }: { card: any }) {
  const P = usePrices() as (Prices & { pr?: Record<string, Row>; ex?: Record<string, Row[]> }) | null;
  const [big, setBig] = useState<string | null>(null);
  const pr: any[] = card.pr || [];
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
