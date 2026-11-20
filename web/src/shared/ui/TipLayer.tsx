import { useEffect, useRef } from 'react';
import { DETAILS_READY, TERMS, vsCard, IMGBASE } from '../../domain/data/store';
import { esc } from '../../domain/text/norm';
import { typeLine } from '../../domain/data/cards';
import { on } from '../lib/events';
import { loadDetails } from '../../domain/data/load';

/** Egyetlen, globális tooltip: fogalommagyarázat (.gl), kártyakép kártyanéven (.cl), egyszerű szöveg ([data-tt]). */
export function TipLayer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tip = ref.current!;
    let tipFor: Element | null = null;
    const place = (el: Element, below = true, minH = 0) => {
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = Math.max(tip.offsetHeight, minH);
      tip.style.left = Math.min(Math.max(12, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 12) + 'px';
      let top = below ? r.bottom + 8 : r.top - th - 8;
      if (below && top + th > window.innerHeight - 8) top = Math.max(8, r.top - th - 8);
      if (!below && top < 8) top = r.bottom + 8;
      tip.style.top = top + 'px';
    };
    const hide = () => { tip.hidden = true; tipFor = null; };
    const showTerm = (el: HTMLElement) => {
      const x = TERMS[+el.dataset.t!]; if (!x) return; tipFor = el;
      tip.innerHTML = '<b>' + esc(x.t) + '</b>' + esc(x.d) + '<span class="rr">Core Rules ' + esc(x.r) + '</span>';
      tip.hidden = false; place(el);
    };
    const showCard = (el: HTMLElement) => {
      const c: any = vsCard(el.dataset.card); if (!c) return; tipFor = el;
      // Kép nélküli lapnál a Röviden szöveg a részletekben van: ha még nem töltődött be, betöltés után újra rajzol.
      if (!c.img && !DETAILS_READY) { loadDetails().then(() => { if (tipFor === el) showCard(el); }); }
      tip.innerHTML = '<b>' + esc(c.n) + '</b><span class="note" style="color:inherit;opacity:.8">' + esc(typeLine(c)) + (c.e != null ? ' · Energy ' + c.e : '') + (c.m != null ? ' · Might ' + c.m : '') + '</span>'
        + (c.img ? '<img class="tipimg" alt="" src="' + IMGBASE + c.img + '?w=300">' : '<span style="display:block;margin-top:6px">' + esc(c.sh || c.txt || '') + '</span>')
        + '<span class="rr">Kattints a teljes kártyalaphoz</span>';
      tip.hidden = false; place(el, true, c.img ? 380 : 0);
    };
    const showTT = (el: HTMLElement) => { tipFor = el; tip.innerHTML = esc(el.dataset.tt!); tip.hidden = false; place(el, false); };
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement; if (!t.closest) return;
      const cl = t.closest('.cl') as HTMLElement; if (cl) { if (tipFor !== cl) showCard(cl); return; }
      const g = t.closest('.gl') as HTMLElement; if (g) { showTerm(g); return; }
      const t2 = t.closest('[data-tt]') as HTMLElement; if (t2) { showTT(t2); return; }
      if (tipFor) hide();
    };
    const focus = (e: FocusEvent) => {
      const t = e.target as HTMLElement; if (!t.closest) return;
      const g = t.closest('.gl') as HTMLElement; if (g) return showTerm(g);
      const t2 = t.closest('[data-tt]') as HTMLElement; if (t2) showTT(t2);
    };
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const g = t.closest?.('.gl') as HTMLElement; if (g) { if (tipFor === g) hide(); else showTerm(g); } else if (tipFor) hide();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('mouseover', over); document.addEventListener('focusin', focus);
    document.addEventListener('click', click); document.addEventListener('keydown', key);
    window.addEventListener('scroll', hide, { passive: true }); const offHide = on('rb:hide-tip', hide);
    return () => {
      document.removeEventListener('mouseover', over); document.removeEventListener('focusin', focus);
      document.removeEventListener('click', click); document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', hide); offHide();
    };
  }, []);
  return <div id="tip" ref={ref} role="tooltip" hidden />;
}
