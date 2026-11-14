import { useState } from 'react';
import { IMGBASE, esc, vsCard } from '../legacy/core';

export type PUnit = { n: string; m: number; base?: number; ex?: boolean; dmg?: number; tag?: string; status?: string[]; mods?: string[]; gear?: string[]; token?: boolean };
export type PSide = {
  legend?: string; champion?: string | null; base?: PUnit[]; runes?: { ready: number; exhausted: number; domains?: string[] };
  hand?: string[]; handCount?: number; score?: number; deck?: number; runeDeck?: number; trash?: string[]; banish?: string[];
};
export type PBoard = { me: PSide; opp: PSide; bfs: { name: string; ctrl?: string | null; me?: PUnit[]; opp?: PUnit[]; facedown?: string | null }[]; chain?: string[]; note?: string };

/** A pálya zónái a Core Rules 105-108 alapján. */
export const ZONES: Record<string, { t: string; d: string; r: string }> = {
  base: { t: 'Base', d: 'Minden játékosnak saját base-e van. Itt állnak az általad kontrollált permanentek (unitok, gearek) és a rune-jaid. A base egy location, a tartalma nyilvános.', r: '107.1' },
  bfs: { t: 'Battlefield Zone', d: 'A battlefieldek helye a pálya közepén. Minden battlefield külön location: ide mozognak a unitok, itt van showdown és combat, a kontrollálásuk ad pontot (conquer, hold).', r: '107.2' },
  facedown: { t: 'Facedown Zone', d: 'Minden battlefieldhez tartozik egy, legfeljebb 1 lapnyi hely. Ide rejtheted el a Hidden lapot, ha a battlefieldet te kontrollálod. Ha elveszíted a battlefieldet, a lap a következő cleanupkor kikerül.', r: '107.3' },
  legend: { t: 'Legend Zone', d: 'A Champion Legend helye. Innen nem mozdítható el, ez határozza meg a deck domain identitását, és a képességei innen működnek.', r: '107.4, 103.2' },
  champion: { t: 'Champion Zone', d: 'A Chosen Champion a játék elején ide kerül, és innen bármikor kijátszható a szokásos szabályok szerint. Ha egyszer elhagyta, normál módon nem tér ide vissza.', r: '108.3, 103.3.a' },
  deck: { t: 'Main Deck', d: 'A legalább 40 lapos pakli lefordítva. Innen húzol. A lapszám nyilvános, a sorrend titkos.', r: '108.4, 103.3' },
  runeDeck: { t: 'Rune Deck', d: 'A 12 rune lefordítva. A Channel Phase-ben innen kerül rune a base-be, és a recycle-ölt rune ide tér vissza alulra.', r: '108.5, 103.4' },
  runes: { t: 'Rune-ok', d: 'A channelölt rune-ok a base-edben vannak. Exhaustolva 1 Energyt adnak, recycle-ölve (visszatéve a Rune Deck aljára) 1 Powert a saját domainjükből. Az exhausted rune elfordítva látszik.', r: '107.1.c, 160-168' },
  trash: { t: 'Trash', d: 'Ide kerülnek a meghalt, eldobott és lefutott lapok. Nyilvános, a sorrend nem számít.', r: '108.2' },
  banish: { t: 'Banishment', d: 'A banisholt lapok helye. Nehezebben visszahozható, mint a trash, és ideiglenes tárolásra is szolgál egyes hatásoknál.', r: '108.6' },
  hand: { t: 'Kéz', d: 'Ide húzol. A lapok privátak, csak te látod őket, a lapszám viszont nyilvános.', r: '108.7' },
  chain: { t: 'Chain', d: 'Kijátszás közben a lapok és képességek ide kerülnek. Mindig a legfelső oldódik fel először, és válaszolni csak priority birtokában lehet.', r: '108.1, 327' },
  score: { t: 'Pontszám', d: 'Pontot conquer és hold ad. 1v1-ben 8 pontnál nyersz, az utolsó pontra külön szabály vonatkozik.', r: '194' },
};

const STATUS: Record<string, [string, string]> = {
  attacker: ['Attacker', 'atk'], defender: ['Defender', 'def'], stunned: ['Stunned', 'stun'], buffed: ['Buff', 'buf'],
  empowered: ['Empowered', 'emp'], temporary: ['Temporary', 'tmp'], equipped: ['Equipped', 'eq'], new: ['Új', 'new'], dying: ['Meghal', 'die'],
};

const img = (n?: string | null) => { const c: any = n ? vsCard(n) : null; return c && c.img ? IMGBASE + c.img : ''; };
const key = (u: PUnit) => u.n + '|' + u.m + '|' + (u.dmg || 0) + '|' + !!u.ex + '|' + (u.status || []).join(',') + '|' + (u.gear || []).join(',');

function Card({ n, ex, small, title }: { n?: string | null; ex?: boolean; small?: boolean; title?: string }) {
  const s = img(n);
  return (
    <span className={'pm-card' + (ex ? ' ex' : '') + (small ? ' sm' : '') + (!n ? ' back' : '')} title={title || n || 'Lefordított lap'}>
      {n && s ? <img src={s} alt={n} loading="lazy" /> : <span className="pm-back">R</span>}
    </span>
  );
}

function Unit({ u, side, changed }: { u: PUnit; side: 'me' | 'opp'; changed: boolean }) {
  const c: any = vsCard(u.n);
  const base = u.base ?? (c?.m != null && c.m !== 'None' ? +c.m : u.m);
  const diff = u.m - base;
  const st = u.status || [];
  return (
    <div className={'pm-unit ' + side + (u.ex ? ' ex' : '') + (changed ? ' chg' : '') + (st.includes('dying') ? ' dying' : '')}>
      <div className="pm-labels">{st.map((s) => STATUS[s] ? <span key={s} className={'pm-lab ' + STATUS[s][1]}>{STATUS[s][0]}</span> : null)}{u.token && <span className="pm-lab tmp">Token</span>}</div>
      <span className={c ? 'cl' : ''} data-card={c?.n}>
        {c?.img ? <img src={IMGBASE + c.img} alt={u.n} loading="lazy" /> : <span className="pm-tok">{u.n}</span>}
      </span>
      <span className={'pm-might' + (diff > 0 ? ' up' : diff < 0 ? ' down' : '')} title={'Might ' + u.m + (diff ? ' (nyomtatva ' + base + ')' : '')}>{u.m}</span>
      {diff !== 0 && <span className={'pm-delta' + (diff > 0 ? ' up' : ' down')}>{diff > 0 ? '+' : ''}{diff}</span>}
      {!!u.dmg && <span className="pm-dmg" title="Damage">{u.dmg}</span>}
      <div className="pm-name">{u.n}</div>
      {!!(u.mods?.length || u.gear?.length || u.tag) && (
        <div className="pm-mods">
          {u.tag && <span>{u.tag}</span>}
          {(u.gear || []).map((g) => <span key={g} className="g"><span className="cl" data-card={g}>{g}</span></span>)}
          {(u.mods || []).map((m, i) => <span key={i}>{m}</span>)}
        </div>
      )}
    </div>
  );
}

function Pile({ z, label, count, top, onZone, sel }: { z: string; label: string; count?: number; top?: string | null; onZone: (z: string) => void; sel: string }) {
  return (
    <button type="button" className={'pm-pile' + (sel === z ? ' on' : '')} onClick={() => onZone(z)} title={ZONES[z]?.t}>
      <Card n={top} small />
      <span className="pm-zl">{label}{count != null ? <b>{count}</b> : null}</span>
    </button>
  );
}

function SideRow({ s, who, prev, onZone, sel }: { s: PSide; who: 'me' | 'opp'; prev?: PSide; onZone: (z: string) => void; sel: string }) {
  const pk = new Set((prev?.base || []).map(key));
  const runes = s.runes;
  const doms = runes?.domains || [];
  const legend = (
    <button type="button" className={'pm-slot leg' + (sel === 'legend' ? ' on' : '')} onClick={() => onZone('legend')}>
      <span className="pm-zl">Legend</span>
      {s.legend ? <span className="cl" data-card={s.legend}><Card n={s.legend} /></span> : <Card />}
    </button>
  );
  const champ = (
    <button type="button" className={'pm-slot' + (sel === 'champion' ? ' on' : '')} onClick={() => onZone('champion')}>
      <span className="pm-zl">Champion</span>
      {s.champion ? <span className="cl" data-card={s.champion}><Card n={s.champion} /></span> : <span className="pm-empty">üres</span>}
    </button>
  );
  const base = (
    <div className={'pm-base' + (sel === 'base' ? ' on' : '')} onClick={(e) => { if (!(e.target as HTMLElement).closest('.cl,.pm-runes')) onZone('base'); }}>
      <span className="pm-zl">Base{s.score != null && <b className="pm-score" onClick={(e) => { e.stopPropagation(); onZone('score'); }}>{s.score} pont</b>}</span>
      <div className="pm-units">{(s.base || []).map((u, i) => <Unit key={i} u={u} side={who} changed={!!prev && !pk.has(key(u))} />)}{!(s.base || []).length && <span className="pm-empty">nincs unit vagy gear</span>}</div>
      {runes && (
        <div className="pm-runes" onClick={() => onZone('runes')} title="Rune-ok">
          {Array.from({ length: runes.ready + runes.exhausted }, (_, i) => {
            const d = doms[i]; const ex = i >= runes.ready;
            return <span key={i} className={'pm-rune' + (ex ? ' ex' : '') + (d ? ' ' + d.toLowerCase() : '')}>{d ? <img src={img(d + ' Rune')} alt={d + ' Rune'} loading="lazy" /> : null}</span>;
          })}
          <span className="pm-rc">{runes.ready} ready · {runes.exhausted} exhausted</span>
        </div>
      )}
    </div>
  );
  const piles = (
    <div className="pm-piles">
      <Pile z="deck" label="Main Deck" count={s.deck} onZone={onZone} sel={sel} />
      <Pile z="runeDeck" label="Rune Deck" count={s.runeDeck} onZone={onZone} sel={sel} />
      <Pile z="trash" label="Trash" count={(s.trash || []).length} top={(s.trash || []).slice(-1)[0] || null} onZone={onZone} sel={sel} />
      <Pile z="banish" label="Banish" count={(s.banish || []).length} top={(s.banish || []).slice(-1)[0] || null} onZone={onZone} sel={sel} />
    </div>
  );
  const hand = (
    <button type="button" className={'pm-hand' + (sel === 'hand' ? ' on' : '')} onClick={() => onZone('hand')}>
      <span className="pm-zl">Kéz <b>{s.hand ? s.hand.length : s.handCount ?? 0}</b></span>
      <span className="pm-fan">
        {s.hand ? s.hand.map((h, i) => <span key={i} className="cl" data-card={h}><Card n={h} small /></span>)
          : Array.from({ length: s.handCount || 0 }, (_, i) => <Card key={i} small />)}
      </span>
    </button>
  );
  return (
    <div className={'pm-side ' + who}>
      {who === 'opp' && hand}
      <div className="pm-row">{legend}{champ}{base}{piles}</div>
      {who === 'me' && hand}
    </div>
  );
}

export function Playmat({ b, prev, explain = true, focus }: { b: PBoard; prev?: PBoard; explain?: boolean; focus?: string }) {
  const [sel, setSel] = useState(focus || '');
  const onZone = (z: string) => setSel(sel === z ? '' : z);
  const info = sel ? ZONES[sel] : null;
  return (
    <div className="pm">
      <div className="pm-table">
        <SideRow s={b.opp} who="opp" prev={prev?.opp} onZone={onZone} sel={sel} />
        <div className={'pm-mid' + (sel === 'bfs' ? ' on' : '')}>
          <button type="button" className="pm-zl pm-bfl" onClick={() => onZone('bfs')}>Battlefield Zone</button>
          <div className="pm-bfs">
            {b.bfs.map((f, i) => {
              const pf = prev?.bfs?.[i];
              const pko = new Set((pf?.opp || []).map(key)), pkm = new Set((pf?.me || []).map(key));
              return (
                <div key={i} className={'pm-bf ' + (f.ctrl || 'none')}>
                  <div className="pm-bfu">{(f.opp || []).map((u, j) => <Unit key={j} u={u} side="opp" changed={!!prev && !pko.has(key(u))} />)}</div>
                  <div className="pm-bfcard">
                    <span className="cl" data-card={f.name}>{img(f.name) ? <img src={img(f.name)} alt={f.name} loading="lazy" /> : <span className="pm-tok">{f.name}</span>}</span>
                    <span className="pm-ctrl">{f.ctrl === 'me' ? 'Te kontrollálod' : f.ctrl === 'opp' ? 'Ellenfél kontrollálja' : 'Senki nem kontrollálja'}</span>
                    <button type="button" className={'pm-fd' + (f.facedown ? ' has ' + f.facedown : '') + (sel === 'facedown' ? ' on' : '')} onClick={() => onZone('facedown')} title="Facedown Zone">
                      {f.facedown ? <Card small /> : null}<span>Facedown</span>
                    </button>
                  </div>
                  <div className="pm-bfu">{(f.me || []).map((u, j) => <Unit key={j} u={u} side="me" changed={!!prev && !pkm.has(key(u))} />)}</div>
                </div>
              );
            })}
          </div>
          {(
            <button type="button" className={'pm-chain' + (sel === 'chain' ? ' on' : '')} onClick={() => onZone('chain')}>
              <span className="pm-zl">Chain</span>
              {!b.chain?.length && <span className="pm-empty">üres</span>}
              {(b.chain || []).map((c, i) => <span key={i} className="pm-ci" dangerouslySetInnerHTML={{ __html: (i === 0 ? '<b>Felül:</b> ' : '') + esc(c).replace(/\[\[([^\]]+)\]\]/g, '$1') }} />)}
            </button>
          )}
        </div>
        <SideRow s={b.me} who="me" prev={prev?.me} onZone={onZone} sel={sel} />
      </div>
      {b.note && <p className="pm-note">{b.note}</p>}
      {explain && (
        <div className="pm-info" aria-live="polite">
          {info ? (<><b>{info.t}</b> <span>{info.d}</span> <span className="note">Core Rules: {info.r.split(/,\s*/).map((r) => <a key={r} className="rref" href="#szabalyok" data-ref={r}>{r}</a>)}</span></>)
            : <span className="note">Kattints a pálya bármelyik zónájára (Legend, Champion, Base, rune-ok, deckek, Trash, battlefield, Facedown, kéz), és itt megjelenik, mire való.</span>}
        </div>
      )}
    </div>
  );
}

/** Bemutató pálya a "pálya felépítése" fejezethez. */
export const DEMO_BOARD: PBoard = {
  opp: { legend: 'Ahri, Nine-Tailed Fox', champion: 'Ahri, Alluring', base: [{ n: 'Apprentice Mage', m: 3, ex: true }], runes: { ready: 2, exhausted: 2, domains: ['Calm', 'Mind', 'Calm', 'Mind'] }, handCount: 4, score: 2, deck: 33, runeDeck: 8, trash: ['Apprentice Smith'], banish: [] },
  bfs: [
    { name: 'Bandle Tree', ctrl: 'opp', opp: [{ n: 'Adaptatron', m: 3, status: ['defender'] }], me: [{ n: 'Ancient Warmonger', m: 6, base: 4, status: ['attacker', 'buffed'], mods: ['+2 Might a kör végéig'], dmg: 1 }], facedown: 'opp' },
    { name: 'Abandoned Hall', ctrl: 'me', opp: [], me: [{ n: 'Arena Kingpin', m: 3, ex: true }], facedown: null },
  ],
  me: { legend: 'Jinx, Loose Cannon', champion: 'Jinx, Rebel', base: [{ n: 'Amateur Demolitionist', m: 1 }], runes: { ready: 3, exhausted: 1, domains: ['Fury', 'Chaos', 'Fury', 'Chaos'] }, hand: ['Angler Beast', 'Baccai Reaper'], score: 1, deck: 34, runeDeck: 8, trash: [], banish: [] },
  chain: [],
  note: 'Bemutató állás: nem egy valódi játék pillanatképe, a zónák szemléltetésére.',
};
