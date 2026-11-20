import { Link2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { RULES, esc, expand, hashRef, headExtent, heads, refHash, ruleHTML } from '../legacy/core';
import { Html } from '../components/Html';
import { Blocks, inline } from '../shared/content/Blocks';
import FMT from '../generated/formats.json';

type Shown = { kind: 'head'; i: number } | { kind: 'ref'; ref: string } | { kind: 'search' } | { kind: 'fmt'; id: string };
const F: any = FMT;

export function RulesView({ hash }: { hash: string }) {
  const [q, setQ] = useState('');
  const [shown, setShown] = useState<Shown>(() => ({ kind: 'head', i: heads.find((i) => RULES[i][0] === '800')! }));
  const [copied, setCopied] = useState('');
  useEffect(() => { const fm = /^#fmt-([\w-]+)/.exec(hash); if (fm) { setQ(''); setShown({ kind: 'fmt', id: fm[1] }); window.scrollTo({ top: 0 }); return; } if (/^#r-/.test(hash)) { setQ(''); setShown({ kind: 'ref', ref: hashRef(hash) }); window.scrollTo({ top: 0 }); } }, [hash]);
  const toc = useMemo(() => heads.map((i) => ({ i, id: RULES[i][0], t: RULES[i][1], major: /00$/.test(RULES[i][0]) || RULES[i][0] === '483' })), []);

  const search = useMemo(() => {
    const s = q.trim();
    if (!s) return null;
    let idx: number[] = []; let hl: RegExp | null = null;
    if (/^\d{3}[\d.a-z]*$/i.test(s)) { const p = s.replace(/\.$/, ''); RULES.forEach((r: any, i: number) => { if (r[0] === p || r[0].startsWith(p + '.') || (p.length < 3 && r[0].startsWith(p))) idx.push(i); }); }
    else { const lq = s.toLowerCase(); hl = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); RULES.forEach((r: any, i: number) => { if (r[1].toLowerCase().includes(lq) || (r[2] || []).some((e: string) => e.toLowerCase().includes(lq))) idx.push(i); }); }
    return { idx, hl };
  }, [q]);

  let body = '';
  if (search) body = '<h2>Találatok: ' + esc(q) + '</h2><div style="margin-top:12px">' + ruleHTML(search.idx.slice(0, 200), search.hl) + '</div>';
  else if (shown.kind === 'head') body = '<h2>' + RULES[shown.i][0] + '. ' + esc(RULES[shown.i][1]) + '</h2><div style="margin-top:12px">' + ruleHTML(headExtent(shown.i)) + '</div>';
  else if (shown.kind === 'ref') {
    const ref = shown.ref, parts = ref.split('-'); let idx: number[] = [];
    if (parts.length === 2 && !/^\d{3}$/.test(parts[0])) { const a = RULES.findIndex((r: any) => r[0] === parts[0]), b = RULES.findIndex((r: any) => r[0] === parts[1]); if (a >= 0 && b >= a) for (let i = a; i <= b; i++) idx.push(i); }
    else idx = expand(ref);
    const par = ref.includes('.') && !ref.includes('-') ? ref.split('.').slice(0, -1).join('.') : '';
    body = '<div class="card-head"><h2 style="margin:0">Szabály ' + esc(ref) + '</h2>' + (par ? '<a class="note" href="' + refHash(par) + '">Szülő: ' + esc(par) + '</a>' : '') + '</div><div style="margin-top:12px">' + ruleHTML(idx) + '</div>';
  }

  return (
    <div className="cols">
      <div className="panel">
        <div className="pad filters">
          <div className="search"><Search size={16} aria-hidden /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szabályszám (pl. 811.2) vagy szövegrészlet" autoComplete="off" aria-label="Keresés a szabályzatban" /></div>
          <div className="count">{search ? search.idx.length + ' találat' + (search.idx.length > 200 ? ', az első 200 látszik' : '') : RULES.length + ' szabálypont. Válassz szakaszt a listából, vagy keress.'}</div>
        </div>
        <div className="toc">
          <div className="toc-group">Versenyformátumok</div>
          {F.formats.map((x: any) => (
            <button key={x.id} className={'fmt' + (shown.kind === 'fmt' && shown.id === x.id ? ' on' : '')} onClick={() => { setQ(''); location.hash = '#fmt-' + x.id; }}>
              <span className="id">{x.rules}</span>{x.title}
            </button>
          ))}
          <div className="toc-group">Core Rules</div>
          {toc.map((h) => (
            <button key={h.i} className={h.major ? 'major' : ''} onClick={() => { setQ(''); setShown({ kind: 'head', i: h.i }); }}>
              <span className="id">{h.id}</span>{h.t}
            </button>
          ))}
        </div>
      </div>
      <div className="panel pad">
        {shown.kind === 'ref' && !search && (
          <div className="btnrow" style={{ marginTop: 0, justifyContent: 'flex-end' }}>
            <button className="btn sec sm" onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopied('A link a vágólapra került.'); } catch { setCopied('Másold ki a címsorból: ' + location.href); } }}><Link2 size={14} /> Link másolása</button>
            <span className="status">{copied}</span>
          </div>
        )}
        {shown.kind === 'fmt' && !search ? (() => { const x = F.formats.find((y: any) => y.id === shown.id) || F.formats[0]; return (
          <div className="fmt-page">
            <div className="crumb">Szabályzat › Versenyformátumok</div>
            <h2>{x.title}</h2>
            <p className="note" dangerouslySetInnerHTML={{ __html: inline(F.intro) }} />
            <table className="ltable fmt-facts"><tbody>{x.facts.map((r: string[], i: number) => <tr key={i}><th>{r[0]}</th><td dangerouslySetInnerHTML={{ __html: inline(r[1]) }} /></tr>)}</tbody></table>
            <Blocks blocks={x.blocks} />
            <div className="fmt-cmp"><h3>Összehasonlítás</h3>
              <table className="ltable"><thead><tr><th>Formátum</th>{F.formats.map((y: any) => <th key={y.id}>{y.title}</th>)}</tr></thead>
                <tbody>{['Victory Score', 'Battlefieldek'].map((k) => <tr key={k}><th>{k}</th>{F.formats.map((y: any) => { const f = y.facts.find((r: string[]) => r[0] === k); return <td key={y.id} dangerouslySetInnerHTML={{ __html: inline(f ? f[1] : '') }} />; })}</tr>)}</tbody></table></div>
          </div>); })() : <Html html={body} />}
      </div>
    </div>
  );
}
