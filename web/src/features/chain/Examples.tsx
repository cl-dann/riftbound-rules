/* "Példák" panel: egy helyen a beépített példák (Alap, Kontrollváltás, Gear leválás), a témánkénti sablonok és a gyakori, kérdés
   formájú példák a meta legendjeivel. Kategóriánként csoportosítva, kereshető; a kérdés formájú példáknál legend jelvény
   ("Kennen · A"), flag 2 esetén mindkét értelmezés, a forrás deck (név, link, dátum). Asztalon rácsban, keskeny nézetben egy oszlopban.
   A régi e2e azonosítók (#cb-ex, #cb-ex2, #cb-ex3) a beépített példák "Betöltés" gombjain maradnak. */
import { useMemo, useState } from 'react';
import { HARD_EXAMPLES, HARD_LG_NOTE, HARD_SOURCE, HARD_TIER, hardBadge, type HardExample } from '../../domain/chain/hardExamples';
import { TEMPLATES } from '../../domain/chain/templates';
import { EXAMPLES } from '../../domain/chain/examples';
import type { ChainState } from '../../domain/chain/state';
import { norm } from '../../domain/text/norm';
import { Refs } from './bits';

type Ex = { id: string; cat: string; title: string; desc: string; refs: string; cs: () => ChainState; attr: Record<string, string>; hard?: HardExample; btnId?: string };
/** A sablonok kategóriája (a kérdés formájú példák kategóriáival közös csoportokban). */
const TPL_CAT: Record<string, string> = {
  counter: 'Reakció-ablak', ignored: 'Mistarget: Ignored vagy Negated', negated: 'Mistarget: Ignored vagy Negated', trigorder: 'Triggerek sorrendje',
  replacement: 'Deathknell és replacement', hidden: 'Hidden és Ambush', trash: 'Költség és erőforrás', endturn: 'Kör vége és következő kör',
  nextturn: 'Kör vége és következő kör', 'reksai-sanctum': 'Conquer', 'reksai-queen': 'Conquer',
};
const BASE: Ex[] = [
  { id: 'base', btnId: 'cb-ex', title: 'Alap chain', desc: 'Riptide Rex play triggere, rá Flash, majd Star-Crossed: mistarget, a play trigger a forrás távozása után is lefut.', refs: '340.1, 359.3.e.6, 355.9.c', cat: 'Alap példák', cs: EXAMPLES.base, attr: { 'data-ex': 'base' } },
  { id: 'ctrl', btnId: 'cb-ex2', title: 'Kontrollváltás', desc: 'Yasuo, Remorseful triggere a Traveling Merchantre, válaszként facedown-ból Hostile Takeover Yasuóra: kontrollváltás a chain közben.', refs: '811.6, 359.3.e.6', cat: 'Alap példák', cs: EXAMPLES.ctrl, attr: { 'data-ex': 'ctrl' } },
  { id: 'gear', btnId: 'cb-ex3', title: 'Gear leválás', desc: 'Hidden Blade a Long Sworddal felszerelt Akshanra: a unit meghal, a Long Sword leválik és a boardon marad.', refs: '719.5, 429', cat: 'Alap példák', cs: EXAMPLES.gear, attr: { 'data-ex': 'gear' } },
];
const HARD_IDS = new Set(HARD_EXAMPLES.map((e) => e.id));
const ALL: Ex[] = [
  ...BASE,
  ...TEMPLATES.filter((t) => !HARD_IDS.has(t.id)).map((t) => ({ id: 't:' + t.id, cat: TPL_CAT[t.id] || 'Egyéb', title: t.title, desc: t.desc, refs: t.refs, cs: t.cs, attr: { 'data-tpl': t.id } })),
  ...HARD_EXAMPLES.map((e) => ({ id: 'h:' + e.id, cat: e.cat, title: e.q, desc: e.a, refs: e.refs, cs: e.cs, attr: { 'data-hex': e.id, ...(TEMPLATES.some((t) => t.id === e.id) ? { 'data-tpl': e.id } : {}) }, hard: e })),
];
const CATS = [...new Set(ALL.map((e) => e.cat))];
const hay = (e: Ex) => norm([e.title, e.desc, e.cat, e.refs, ...(e.hard ? [...e.hard.lg, ...e.hard.lg.map(hardBadge), ...e.hard.src.map((s) => s.deck)] : [])].join(' '));

export function Examples({ hasContent, onLoad }: { hasContent: boolean; onLoad: (cs: ChainState, label: string, hard?: HardExample) => void }) {
  const [q, setQ] = useState('');
  const [ask, setAsk] = useState<string | null>(null);
  const list = useMemo(() => { const n = norm(q.trim()); return ALL.filter((e) => !n || n.split(/\s+/).every((w) => hay(e).includes(w))); }, [q]);
  const groups = CATS.map((c) => [c, list.filter((e) => e.cat === c)] as const).filter(([, l]) => l.length);
  const load = (e: Ex) => { setAsk(null); onLoad(e.cs(), e.title, e.hard); };
  return (
    <div className="panel pad cb2-hard" role="region" aria-label="Példák">
      <div className="cb2-hard-hd">
        <b>Példák</b>
        <span className="note">Beépített példák, témánkénti sablonok és gyakori kérdések a meta legendjeivel. {HARD_SOURCE}; a lapok versenyen játszott decklistákból, a forrás példánként.</span>
        <input type="search" className="cb2-hard-q" placeholder="Keresés: legend, lap, szabályszám, téma" aria-label="Keresés a példák között" value={q} onChange={(ev) => setQ(ev.target.value)} />
      </div>
      {!groups.length && <p className="note">Nincs találat.</p>}
      {groups.map(([cat, l]) => (
        <section key={cat} className="cb2-hard-cat" aria-label={cat}>
          <h4>{cat} <span className="note">({l.length})</span></h4>
          {l.map((e) => (
            <details key={e.id} className="cb2-hex" {...e.attr}>
              <summary>
                <span className="cb2-hex-q">{e.title}</span>
                <span className="cb2-hex-bd">{(e.hard?.lg || []).map((g) => <span key={g} className={'cb2-tier t' + (HARD_TIER[g] || '')} title={g + (HARD_LG_NOTE[g] ? ', ' + HARD_LG_NOTE[g] : '')}>{hardBadge(g)}{HARD_LG_NOTE[g] ? ' (' + HARD_LG_NOTE[g] + ')' : ''}</span>)}
                  {e.hard?.flag === 2 && <span className="cb2-tier fl2">nyitott kérdés</span>}
                  {ask === e.id ? (
                    <span className="cb2-mbtn" onClick={(ev) => ev.preventDefault()}><span className="pb-why">A mostani helyzet elvész.</span>
                      <button type="button" className="btn" onClick={() => load(e)}>Betöltés mégis</button>
                      <button type="button" className="btn sec" onClick={() => setAsk(null)}>Mégse</button></span>
                  ) : <button type="button" className="btn sec" id={e.btnId} onClick={(ev) => { ev.preventDefault(); if (hasContent && !e.btnId) setAsk(e.id); else load(e); }}>Betöltés</button>}
                </span>
              </summary>
              <p className="note">{e.desc}</p>
              {e.hard?.alt && <ul className="cb2-hex-alt" aria-label="A két értelmezés"><li><b>1. értelmezés:</b> {e.hard.alt[0]}</li><li><b>2. értelmezés:</b> {e.hard.alt[1]}</li></ul>}
              <div className="cb2-hex-refs">Szabályok: <Refs r={e.refs} /></div>
              {e.hard?.note && <p className="note">{e.hard.note}</p>}
              {e.hard && <p className="note cb2-hex-src">Forrás: {e.hard.src.map((s, i) => <span key={i}>{i ? '; ' : ''}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.deck}</a> ({s.date})</span>)}</p>}
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
