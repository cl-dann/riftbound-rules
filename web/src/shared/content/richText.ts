import { esc } from '../../domain/text/norm';
import { glossify } from '../../render/html/glossary';
import { refHash } from '../../domain/rules/refs';

/** [[Kártya]] kártyalink, {{123.4}} szabálylink, plusz fogalom-tooltip. */
export function inline(text: string, seen?: Set<string>) {
  let h = esc(text)
    .replace(/\[\[([^\]]+)\]\]/g, (_, n) => '<span class="cl" data-card="' + n + '">' + n + '</span>')
    .replace(/\{\{([\d.a-z\-, ]+)\}\}/gi, (_, r) => String(r).split(/\s*,\s*/).map((x: string) => '<a class="rref" href="' + refHash(x) + '" data-ref="' + x + '">' + x + '</a>').join(' '));
  try { h = glossify(h, seen || new Set()); } catch { /* glossify nélkül is olvasható */ }
  return h;
}
