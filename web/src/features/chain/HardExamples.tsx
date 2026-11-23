/* "Nehéz példák" panel: kategóriánként csoportosított, kereshető lista. Példánként egymondatos kérdés, rövid válasz, kulcs
   szabályszámok, legend jelvény ("Kennen · A"), flag 2 esetén mindkét értelmezés, a forrás deck (név, link, dátum), és egy
   kattintással betölthető chain valós lapokkal. Asztalon rácsban, keskeny nézetben egy oszlopban. */
import { useMemo, useState } from 'react';
import { HARD_CATS, HARD_EXAMPLES, HARD_LG_NOTE, HARD_SOURCE, HARD_TIER, hardBadge, type HardExample } from '../../domain/chain/hardExamples';
import { norm } from '../../domain/text/norm';
import { Refs } from './bits';

const hay = (e: HardExample) => norm([e.q, e.a, e.cat, e.refs, ...e.lg, ...e.lg.map(hardBadge), ...e.src.map((s) => s.deck)].join(' '));

export function HardExamples({ hasContent, onLoad }: { hasContent: boolean; onLoad: (e: HardExample) => void }) {
  const [q, setQ] = useState('');
  const [ask, setAsk] = useState<string | null>(null);
  const list = useMemo(() => { const n = norm(q.trim()); return HARD_EXAMPLES.filter((e) => !n || n.split(/\s+/).every((w) => hay(e).includes(w))); }, [q]);
  const groups = HARD_CATS.map((c) => [c, list.filter((e) => e.cat === c)] as const).filter(([, l]) => l.length);
  return (
    <div className="panel pad cb2-hard" role="region" aria-label="Nehéz példák">
      <div className="cb2-hard-hd">
        <b>Nehéz példák</b>
        <span className="note">{HARD_SOURCE}. Lapok: versenyen játszott decklisták, a forrás példánként.</span>
        <input type="search" className="cb2-hard-q" placeholder="Keresés: legend, lap, szabályszám, kérdés" aria-label="Keresés a nehéz példák között" value={q} onChange={(ev) => setQ(ev.target.value)} />
      </div>
      {!groups.length && <p className="note">Nincs találat.</p>}
      {groups.map(([cat, l]) => (
        <section key={cat} className="cb2-hard-cat" aria-label={cat}>
          <h4>{cat} <span className="note">({l.length})</span></h4>
          {l.map((e) => (
            <details key={e.id} className="cb2-hex" data-hex={e.id}>
              <summary>
                <span className="cb2-hex-q">{e.q}</span>
                <span className="cb2-hex-bd">{e.lg.map((g) => <span key={g} className={'cb2-tier t' + (HARD_TIER[g] || '')} title={g + (HARD_LG_NOTE[g] ? ', ' + HARD_LG_NOTE[g] : '')}>{hardBadge(g)}{HARD_LG_NOTE[g] ? ' (' + HARD_LG_NOTE[g] + ')' : ''}</span>)}
                  {e.flag === 2 && <span className="cb2-tier fl2">nyitott kérdés</span>}</span>
              </summary>
              <p className="note">{e.a}</p>
              {e.alt && <ul className="cb2-hex-alt" aria-label="A két értelmezés"><li><b>1. értelmezés:</b> {e.alt[0]}</li><li><b>2. értelmezés:</b> {e.alt[1]}</li></ul>}
              <div className="cb2-hex-refs">Szabályok: <Refs r={e.refs} /></div>
              {e.note && <p className="note">{e.note}</p>}
              <p className="note cb2-hex-src">Forrás: {e.src.map((s, i) => <span key={i}>{i ? '; ' : ''}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.deck}</a> ({s.date})</span>)}</p>
              {ask === e.id ? (
                <div className="cb2-mbtn"><span className="pb-why">A mostani helyzet elvész.</span>
                  <button type="button" className="btn" onClick={() => { setAsk(null); onLoad(e); }}>Betöltés mégis</button>
                  <button type="button" className="btn sec" onClick={() => setAsk(null)}>Mégse</button></div>
              ) : <button type="button" className="btn sec" onClick={() => (hasContent ? setAsk(e.id) : onLoad(e))}>Betöltés</button>}
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
