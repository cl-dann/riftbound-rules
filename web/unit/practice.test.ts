/* Practice szituáció-motor: minden szituáció elvárt sora jó kimenetre vezet, a rossz döntések rossz kimenetre,
   a menük legalitása a Core Rules szerint számolódik, és a szövegekben csak létező szabályszám és lapnév szerepel. */
import { describe, expect, it } from 'vitest';
import LEARN from '../src/generated/learn.json';
import RULES from '../src/generated/rules.json';
import { vsCard } from '../src/domain/data/store';
import { act, asgConfirm, asgPick, asgView, autoNext, init, menuFor, panelBtn, solve, start, step, tgtConfirm, tgtToggle, type ES, type Scn } from '../src/domain/practice/practiceEngine';

const SC = (LEARN as any).scenarios as Scn[];
const ids = new Set((RULES as any[]).map((r) => r[0]));
const byId = (id: string) => SC.find((s) => s.id === id)!;
/** Az elvárt sor lépésenként a megadott számú lépésig (a solve-val azonos logika, csak megáll). */
function upTo(id: string, pred: (es: ES) => boolean): ES {
  let es = start(init(byId(id)));
  for (let k = 0; k < 100 && !pred(es) && !es.out; k++) {
    const s = step(es)!;
    if (es.tgt) { for (const r of es.tgt.spec.correct) es = tgtToggle(es, r); es = tgtConfirm(es); continue; }
    if (s.t === 'panel') { es = panelBtn(es, (s.btns || []).findIndex((b) => !b.dis && (b.go || 'next') === 'next')); continue; }
    break;
  }
  return es;
}

describe('szituációk', () => {
  it('12 szituáció, egyedi azonosítóval', () => {
    expect(SC.length).toBe(12);
    expect(new Set(SC.map((s) => s.id)).size).toBe(12);
  });
  for (const s of SC) {
    it(s.id + ': az elvárt sor jó kimenetre vezet', () => {
      const es = solve(s);
      expect(es.out?.kind, JSON.stringify(es.out) + ' lépés ' + es.i + ' ' + es.msg).toBe('good');
    });
    it(s.id + ': minden hivatkozott kimenet létezik, a rossz kimenetekhez van optimális sor', () => {
      const gos = JSON.stringify(s.steps).match(/"(go|partial|deadEnd|wrongSet)":"([^"]+)"/g) || [];
      for (const g of gos) { const v = g.split(':')[1].replace(/"/g, ''); if (v !== 'next' && v !== 'stay') expect(s.outcomes[v], v).toBeTruthy(); }
      for (const w of JSON.stringify(s.steps).match(/"wrong":\{[^}]*\}/g) || []) for (const v of Object.values(JSON.parse(w.slice(8)))) expect(s.outcomes[v as string], String(v)).toBeTruthy();
      expect(s.outcomes[s.fallback]).toBeTruthy();
      expect(s.optimal.length).toBeGreaterThan(20);
      expect(Object.values(s.outcomes).some((o) => o.kind === 'good')).toBe(true);
    });
    it(s.id + ': szabályszámok és lapnevek léteznek, nincs em-dash és en-dash', () => {
      const txt = JSON.stringify(s);
      expect(txt).not.toMatch(/[\u2013\u2014]/);
      for (const m of txt.matchAll(/\{\{([^}]+)\}\}/g)) for (const r of m[1].split(/\s*,\s*/)) expect(ids.has(r), r).toBe(true);
      for (const m of txt.matchAll(/\[\[([^\]]+)\]\]/g)) expect(vsCard(m[1]), m[1]).toBeTruthy();
      const names = new Set<string>();
      const b = s.board;
      for (const sd of [b.me, b.opp]) { [sd.legend, sd.champion, ...sd.base.map((u) => u.n), ...(sd.hand || [])].forEach((n) => n && names.add(n)); sd.runes.forEach((r) => names.add(r.d + ' Rune')); }
      b.bfs.forEach((f) => { names.add(f.name); [...f.me, ...f.opp].forEach((u) => names.add(u.n)); });
      for (const n of names) expect((vsCard(n) as any)?.n, n).toBe(n);
    });
  }
});

describe('motor: szabályos menük és rossz döntések', () => {
  it('Egyszerű combat: a jó unitnak van mozgás menüje, End Turn azonnal rossz kimenet', () => {
    const es = start(init(byId('egyszeru-combat-conquer')));
    const m = menuFor(es, 'Vanguard Sergeant')!;
    expect(m.items.map((x) => x.label)).toEqual(['Mozgatás: Packed Amphitheater', 'Mozgatás: Grove of the God-Willow']);
    expect(m.items.every((x) => !x.dis)).toBe(true);
    expect(menuFor(es, 'Shipyard Skulker')).toBeNull();
    const o = act(es, 'end');
    expect(o.out?.kind).toBe('bad');
    expect(o.out?.opt).toContain('Vanguard Sergeant');
  });
  it('Mozgás megerősítés előtt a unit a célhelyen áll; másik battlefield rossz kimenet', () => {
    let es = start(init(byId('egyszeru-combat-conquer')));
    es = act(es, 'move:Vanguard Sergeant:bf1');
    expect(es.b.bfs[1].me[0].n).toBe('Vanguard Sergeant');
    expect(es.b.bfs[1].me[0].ex).toBe(true);
    es = act(es, 'confirm');
    expect(es.out?.id).toBe('o_grove');
  });
  it('Több unit: csak egy unit mozgatása részleges, rossz kimenet', () => {
    let es = start(init(byId('tobb-unit-damage-kiosztas')));
    es = act(es, 'move:Petty Officer:bf0');
    es = act(es, 'confirm');
    expect(es.out?.id).toBe('o_alone');
  });
  it('Több unit: a Tank előtt a Poro nem kaphat damage-et', () => {
    let es = upTo('tobb-unit-damage-kiosztas', (e) => step(e)?.t === 'free');
    es = act(es, 'move:Petty Officer:bf0'); es = act(es, 'move:Laurent Duelist:bf0'); es = act(es, 'confirm');
    es = panelBtn(es, 0);
    expect(step(es)?.t).toBe('assign');
    const v = asgView(es);
    expect(v.rows.find((r) => r.n === 'Stalwart Poro')!.dis).toContain('815.1.b');
    es = asgPick(es, 'Horns of the Dragon');
    expect(asgView(es).rows.find((r) => r.n === 'Horns of the Dragon')!.got).toBe(6);
  });
  it('Spell: az Incinerate rossz kimenet, base-ben álló unit nem legális target, és a sorrend számít', () => {
    const es = start(init(byId('spell-hasznalata')));
    expect(act(es, 'play:Incinerate').out?.id).toBe('o_incin');
    const t = act(es, 'play:Hextech Ray');
    expect(t.tgt?.spec.illegal?.['Bewitching Spirit']).toContain('355.9.b');
    const o = act(act(es, 'move:Legion Rearguard:bf0'), 'confirm');
    expect(o.out?.title).toBe('Rossz sorrend');
  });
  it('Showdownban a kulcsszó nélküli spell nem játszható ki, Closed Stateben az Action sem', () => {
    const es = start(init(byId('showdown-action-reaction-ablakok')));
    expect(menuFor(es, 'h:Falling Star')!.items[0].dis).toContain('308.1.a');
    expect(menuFor(es, 'h:Incinerate')!.items[0].dis).toBeFalsy();
    let es2 = act(es, 'play:Incinerate'); es2 = tgtConfirm(tgtToggle(es2, 'Profiteer'));
    while (es2.i < 5) es2 = panelBtn(es2, 0);
    expect(menuFor(es2, 'h:Flash')!.items[0].dis).toBeFalsy();
    expect(menuFor(es2, 'h:Falling Star')!.items[0].dis).toContain('309.1.a');
  });
  it('Floating: ready rune recycle-je elveszi az Energyt, kétszer már nem fizethető', () => {
    let es = start(init(byId('energy-lebegtetes-power-recycle')));
    const r = es.b.me.runes.findIndex((x) => x.d === 'Fury');
    expect(menuFor(es, 'r:' + r)!.items.map((x) => x.act)).toEqual(['energy:' + r, 'power:' + r]);
    es = act(es, 'power:' + r);
    expect(es.out).toBeUndefined();
    expect(es.msg).toContain('Energyje elveszett');
    es = act(es, 'power:' + es.b.me.runes.findIndex((x) => x.d === 'Fury'));
    expect(es.out?.id).toBe('o_lost');
  });
  it('Hidden: ellenfél battlefieldjére nem rejthető, a saját battlefieldre igen', () => {
    const es = start(init(byId('vedekezes-mit-tartasz-meg')));
    const m = menuFor(es, 'h:Pakaa Cub')!;
    expect(m.items.find((x) => x.act === 'hide:Pakaa Cub:bf1')!.dis).toContain('811.1.b');
    expect(m.items.find((x) => x.act === 'hide:Pakaa Cub:bf0')!.dis).toBeFalsy();
  });
  it('Exhausted unit nem mozoghat Standard Move-val', () => {
    const es = start(init(byId('spell-hasznalata')));
    const b = JSON.parse(JSON.stringify(es.b)); b.me.base[0].ex = true;
    expect(menuFor({ ...es, b }, 'Legion Rearguard')!.items[0].dis).toContain('144.2');
  });
  it('Damage kiosztás védekezésben: a Skulker első kiválasztása rossz kimenet', () => {
    let es = start(init(byId('damage-kiosztas-vedekezesben')));
    while (step(es)?.t !== 'assign') es = step(es)!.t === 'auto' ? autoNext(es) : panelBtn(es, (step(es) as any).btns.findIndex((b: any) => !b.dis));
    es = asgPick(es, 'Shipyard Skulker');
    es = asgPick(es, 'Plundering Poro');
    const o = asgConfirm(es);
    expect(o.out?.id).toBe('o_wrong');
  });
});

describe('Practice forrásfájlok', () => {
  it('nincs em-dash és en-dash, a {{...}} szabályszámok léteznek', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['src/features/learn/PracticeBoard.tsx', 'src/domain/practice/practiceEngine.ts', 'src/styles/practice.css', 'src/features/learn/LearnView.tsx', '../tools/learn/scenarios_build.py']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/[–—]/);
      for (const m of src.matchAll(/\{\{([\d.a-z, ]+)\}\}/g)) for (const r of m[1].split(/\s*,\s*/)) expect(ids.has(r), f + ': ' + r).toBe(true);
    }
  });
});
