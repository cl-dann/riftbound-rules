import { FileDown, Link2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BF, DECK, FORMAT, META, TOPICS, b64d, b64e, buildPDF, cardHeadHTML, cardRulesHTML, curveHTML, domDots, esc,
  interactionHTML, legalityHTML, parseDeck, setDeck, typeLine,
} from '../../legacy/core';
import { Html } from '../../shared/ui/Html';
import { loadFonts } from '../../domain/data/load';
import { editDeck, eur, legendOf, priceOf, searchCards, targetSec, type Prices } from '../../domain/deck/edit';

function deckTotals(P: Prices | null) {
  let a1 = 0, a7 = 0, n = 0; const miss: string[] = [];
  if (P) DECK.forEach((s: any) => { if (/side/i.test(s.name)) return; s.rows.forEach((r: any) => { if (!r.card) return; const p = priceOf(r.card, P); n += r.qty; if (!p) { miss.push(r.card.n); return; } a1 += r.qty * (p.a1 ?? p.a7 ?? 0); a7 += r.qty * (p.a7 ?? p.a1 ?? 0); }); });
  return { a1, a7, n, miss };
}

function priceHTML(P: Prices | null): string {
  if (!P) return '<div class="prices"><h3>Cardmarket ár</h3><p class="note">Az árak még nem érhetők el. A Cardmarket publikus árlistájából töltődnek be, a frissítés dátuma a fejlécben látszik.</p></div>';
  const { a1, a7, n, miss } = deckTotals(P);
  return '<div class="prices"><h3>Cardmarket ár<span class="n">' + n + ' lap, sideboard nélkül, névenként a legolcsóbb nyomat</span></h3><div class="ptot"><div><span>1 napos átlag</span><b>' + eur(a1) + '</b></div><div><span>7 napos átlag</span><b>' + eur(a7) + '</b></div></div><p class="note">Frissítve: ' + esc(P.updated.slice(0, 10)) + '. A listaár naponta változik, a pontos ár a Cardmarket termékoldalán ellenőrizhető.' + (miss.length ? ' Ár nélkül: ' + [...new Set(miss)].map(esc).join(', ') + '.' : '') + '</p></div>';
}

function deckHTML(P: Prices | null): string {
  if (!DECK.length) return '<div class="panel pad"><h2>Decklista formátum</h2><p class="note" style="margin:8px 0">Illeszd be a decket a bal oldali mezőbe ebben a formában, aztán nyomd meg a Deck feldolgozása gombot. Szekciónként fejléc kettősponttal, alatta soronként darabszám és pontos angol kártyanév. A legend neve Champion, Legend cím alakban szerepel.</p><pre class="fmt">' + esc(FORMAT) + '</pre></div>';
  const warns: string[] = [], tot: Record<string, number> = {};
  DECK.forEach((s: any) => s.rows.forEach((r: any) => {
    if (!r.card) { warns.push('Ismeretlen kártyanév a(z) ' + esc(s.name) + ' szekcióban: <b>' + esc(r.name) + '</b>.' + (r.sug.length ? ' Erre gondoltál? ' + r.sug.map((c: any) => '<button data-fix="' + esc(r.name) + '" data-to="' + esc(c.a.find((a: string) => a.includes(',')) || c.a[0]) + '">' + esc(c.n) + '</button>').join('') : '')); return; }
    if (r.card.ban === 1) warns.push('<b>' + esc(r.card.n) + '</b> tiltott Constructedben (' + (r.card.banNew ? r.card.banf : META.ban_updated) + ').');
    else if (r.card.banf) warns.push('<b>' + esc(r.card.n) + '</b> ' + r.card.banf + '-tól tiltott lesz (<a href="' + BF.url + '">Radiance ban list</a>).');
    if (r.card.ban === 2) warns.push('<b>' + esc(r.card.n) + '</b> a 2v2 Constructed formátumban tiltott (' + META.ban_updated + ').');
    if (['Unit', 'Gear', 'Spell'].includes(r.card.t) && !/side/i.test(s.name)) tot[r.card.n] = (tot[r.card.n] || 0) + r.qty;
  }));
  Object.keys(tot).forEach((n) => { if (tot[n] > 3) warns.push('<b>' + esc(n) + '</b>: ' + tot[n] + ' példány a Main Deckben (Champion zónával együtt). A 103.3.b szabály névenként legfeljebb 3 példányt enged.'); });
  const uniq = new Set<any>(); DECK.forEach((s: any) => s.rows.forEach((r: any) => r.card && uniq.add(r.card)));
  const ec = [...uniq].filter((c) => c.err != null).length;
  const T = deckTotals(P);
  let h = '<div class="panel pad"><div class="sum">' + (P && T.n ? '<span class="chip price" title="Cardmarket, névenként a legolcsóbb nyomat, sideboard nélkül. 1 napos átlag: ' + eur(T.a1) + '">Deck ár <b>' + eur(T.a7) + '</b> <small>7 napos átlag' + (T.miss.length ? ', ' + new Set(T.miss).size + ' lap ár nélkül' : '') + '</small></span>' : '') + DECK.map((s: any) => '<span class="chip">' + esc(s.name) + ' <b>' + s.rows.reduce((a: number, r: any) => a + r.qty, 0) + '</b></span>').join('')
    + '<span class="chip okc">' + uniq.size + ' egyedi kártya</span>' + (ec ? '<span class="chip err">' + ec + ' kártyán errata</span>' : '') + '</div>';
  if (warns.length) h += '<ul class="warns">' + warns.map((w) => '<li>' + w + '</li>').join('') + '</ul>';
  h += legalityHTML() + priceHTML(P) + curveHTML() + interactionHTML();
  DECK.forEach((s: any, si: number) => {
    h += '<div class="sec-title">' + esc(s.name) + '<span class="count">' + s.rows.reduce((a: number, r: any) => a + r.qty, 0) + ' lap</span></div>';
    s.rows.forEach((r: any, ri: number) => {
      const c = r.card;
      if (!c) { h += '<details class="drow unk"><summary><span class="q">' + r.qty + '</span><span class="nm">' + esc(r.name) + '</span><span class="ty">ismeretlen</span><span class="rs"></span></summary></details>'; return; }
      const rs = c.tp.map((p: any) => '<span title="' + esc(TOPICS[p[0]].title) + '">' + TOPICS[p[0]].refs[0] + '</span>').join('');
      h += '<details class="drow" data-s="' + si + '" data-r="' + ri + '"><summary><span class="q">' + r.qty + '</span><span class="nm">' + domDots(c) + ' ' + esc(c.n)
        + (c.err != null ? ' <span class="chip err mini">errata</span>' : '') + (c.ban ? ' <span class="chip ban mini">ban</span>' : c.banf ? ' <span class="chip ban mini">ban ' + c.banf.slice(5) + '</span>' : '')
        + '</span><span class="ty">' + esc(typeLine(c)) + '</span><span class="rs">' + rs + '</span><span class="ctl">' + (() => { const p = priceOf(c, P); return p ? '<span class="pr" title="7 napos átlag, darabár ' + eur(p.a7 ?? p.a1) + '">' + eur(r.qty * (p.a7 ?? p.a1 ?? 0)) + '</span>' : ''; })()
        + '<button class="qb" data-inc="-1" data-sec="' + esc(s.name) + '" data-card="' + esc(c.n) + '" aria-label="Egy példánnyal kevesebb">\u2212</button><button class="qb" data-inc="1" data-sec="' + esc(s.name) + '" data-card="' + esc(c.n) + '" aria-label="Egy példánnyal több">+</button></span></summary><div class="body"></div></details>';
    });
  });
  return h + '</div>';
}

export function DeckView() {
  const [text, setText] = useState(() => { const m = /^#d=(.+)$/.exec(location.hash); if (m) { try { return b64d(m[1]); } catch { /* */ } } return ''; });
  const [ver, setVer] = useState(0);
  const [status, setStatus] = useState('');
  const [link, setLink] = useState('');
  const [rel, setRel] = useState(false);
  const [gen, setGen] = useState(false);
  const hasLast = useMemo(() => { try { return !!localStorage.getItem('rb-deck'); } catch { return false; } }, []);
  const [P, setP] = useState<Prices | null>(null);
  useEffect(() => { fetch('./prices.json').then((r) => r.ok ? r.json() : null).then((j) => j && j.cards && setP(j)).catch(() => { /* nincs ár */ }); }, []);
  const [q, setQ] = useState('');
  const [ty, setTy] = useState('');
  const [legalOnly, setLegalOnly] = useState(true);
  const tmr = useRef<number>(0);
  const change = (t: string) => { setText(t); clearTimeout(tmr.current); tmr.current = window.setTimeout(() => run(t), 250); };
  const legend = useMemo(() => legendOf(text), [text]);
  const hits = useMemo(() => (q.trim() || ty ? searchCards(q, legend, legalOnly, ty) : []), [q, ty, legend, legalOnly]);
  const add = (c: any) => change(editDeck(text, targetSec(c, text), c, 1));
  const run = (t = text) => { setDeck(parseDeck(t)); if (t.trim()) { try { localStorage.setItem('rb-deck', t); } catch { /* */ } } setVer((v) => v + 1); };
  useEffect(() => { run(); }, []);
  useEffect(() => {
    const on = () => { const m = /^#d=(.+)$/.exec(location.hash); if (m) { try { const t = b64d(m[1]); setText(t); run(t); } catch { /* */ } } };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const html = useMemo(() => deckHTML(P), [ver, P]);
  const outRef = useRef<HTMLDivElement>(null);
  // A deck sorai lenyitáskor töltik be a kártya teljes adatlapját.
  useEffect(() => {
    const el = outRef.current!;
    const on = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (!d.classList?.contains('drow') || !d.open) return;
      const b = d.querySelector('.body') as HTMLElement; if (!b || b.dataset.done) return;
      const c = DECK[+d.dataset.s!].rows[+d.dataset.r!].card;
      b.innerHTML = cardHeadHTML(c, 'h3') + cardRulesHTML(c); b.dataset.done = '1';
    };
    el.addEventListener('toggle', on, true);
    return () => el.removeEventListener('toggle', on, true);
  }, []);

  const pdf = async () => {
    run();
    if (!DECK.some((s: any) => s.rows.some((r: any) => r.card))) { setStatus('Nincs felismert kártya a listában, nincs miből PDF-et készíteni.'); return; }
    try {
      setStatus('PDF készítése...');
      const [fonts, { jsPDF }] = await Promise.all([loadFonts(), import('jspdf')]);
      const res = buildPDF(rel, gen, fonts, jsPDF);
      // claude.ai artifactként a böngészős letöltés tiltott, ott a downloads képesség ment.
      const cl = (window as any).claude;
      if (cl && typeof cl.use === 'function') {
        try { const dl = await cl.use('downloads'); await dl.save({ filename: res.name, data: res.blob }); setStatus('Kész: ' + res.name + ', ' + res.pages + ' oldal.'); return; }
        catch (e: any) { if (e?.code === 'declined') { setStatus('A mentést elutasítottad, a PDF nem lett letöltve.'); return; } }
      }
      const u = URL.createObjectURL(res.blob), a = document.createElement('a');
      a.href = u; a.download = res.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
      setStatus('PDF elkészült (' + res.pages + ' oldal): ' + res.name);
    } catch (err: any) { setStatus('A PDF készítése nem sikerült: ' + err.message); }
  };
  const share = async () => {
    if (!text.trim()) { setStatus('Nincs decklista, amiből link készülhetne.'); return; }
    const url = location.origin + location.pathname + '#d=' + b64e(text.trim());
    setLink(url);
    try { await navigator.clipboard.writeText(url); setStatus('A link a vágólapra került. Megnyitva betölti a decket.'); }
    catch { setStatus('A vágólap nem érhető el, a link a lenti mezőben van, onnan másolható.'); }
  };

  return (
    <div className="cols">
      <div className="panel pad">
        <div className="builder">
          <label htmlFor="dq" className="note">Lap hozzáadása. A lap a típusa szerinti szekcióba kerül, a legalitás és az ár azonnal frissül.</label>
          <div className="bq">
            <input id="dq" type="search" placeholder="Kártyanév, pl. Jinx" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={ty} onChange={(e) => setTy(e.target.value)} aria-label="Típus">
              <option value="">Minden típus</option>{['Legend', 'Unit', 'Spell', 'Gear', 'Battlefield', 'Rune'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <label className="chk"><input type="checkbox" checked={legalOnly} onChange={(e) => setLegalOnly(e.target.checked)} /> csak a legend Domain Identity-jébe illő és nem tiltott lapok{legend ? ' (' + (legend.d || []).join(' + ') + ')' : ''}</label>
          {!!hits.length && <ul className="bres">{hits.map((c: any) => { const p = priceOf(c, P); return (
            <li key={c.n}><button onClick={() => add(c)} title="Hozzáadás a deckhez"><Plus size={13} /><span className="nm" dangerouslySetInnerHTML={{ __html: domDots(c) + ' ' + esc(c.n) }} /><span className="ty">{typeLine(c)}{c.e != null ? ' · ' + c.e : ''}</span><span className="pr">{p ? eur(p.a7 ?? p.a1) : ''}</span></button></li>); })}</ul>}
        </div>
        <label htmlFor="deckin" className="note">Decklista. Szekciófejléc (<code>Legend:</code>, <code>Champion:</code>, <code>MainDeck:</code>, <code>Battlefields:</code>, <code>Rune Pool:</code>, <code>Sideboard:</code>), alatta soronként darabszám és kártyanév.</label>
        <textarea id="deckin" spellCheck={false} style={{ marginTop: 8 }} value={text} placeholder={FORMAT} onChange={(e) => change(e.target.value)} />
        <div className="btnrow">
          <button className="btn sec" onClick={pdf}><FileDown size={15} /> PDF letöltése</button>
          <button className="btn sec" onClick={share}><Link2 size={15} /> Megosztható link</button>
        </div>
        <div className="btnrow">
          {hasLast && <button className="linkbtn" onClick={() => { let t = ''; try { t = localStorage.getItem('rb-deck') || ''; } catch { /* */ } setText(t); run(t); }}><RotateCcw size={13} /> Legutóbbi deck visszatöltése</button>}
          <button className="linkbtn danger" onClick={() => { setText(''); run(''); }}><Trash2 size={13} /> Mező törlése</button>
        </div>
        <div className="btnrow">
          <label className="chk"><input type="checkbox" checked={rel} onChange={(e) => setRel(e.target.checked)} /> kapcsolódó szabályok szövege is a PDF-ben</label>
          <label className="chk"><input type="checkbox" checked={gen} onChange={(e) => setGen(e.target.checked)} /> általános szabályok is (Golden/Silver, Playing Cards, Costs)</label>
        </div>
        <div className="status" role="status">{status}</div>
        {link && <input type="text" readOnly value={link} aria-label="Megosztható link" className="mono" style={{ marginTop: 8, fontSize: 12 }} onFocus={(e) => e.currentTarget.select()} />}
      </div>
      <div
        ref={outRef}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          const sm = t.closest('button[data-sim]') as HTMLElement | null;
          const qb = t.closest('button[data-inc]') as HTMLElement | null;
          if (qb) { e.preventDefault(); e.stopPropagation(); const c = DECK.flatMap((s: any) => s.rows).find((r: any) => r.card && r.card.n === qb.dataset.card)?.card; if (c) change(editDeck(text, qb.dataset.sec!, c, +qb.dataset.inc!)); return; }
          if (sm) { window.dispatchEvent(new CustomEvent('rb:open-card', { detail: sm.dataset.sim })); return; }
          const b = t.closest('button[data-fix]') as HTMLElement | null;
          if (b) { const nt = text.split(b.dataset.fix!).join(b.dataset.to!); setText(nt); run(nt); }
        }}
      >
        <Html html={html} />
      </div>
    </div>
  );
}
