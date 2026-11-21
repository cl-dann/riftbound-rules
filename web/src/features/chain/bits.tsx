import { IMGBASE } from '../../domain/data/store';
import { type MtInstr, cardOf } from './chainBuild';

export const ST_TXT: Record<MtInstr['st'], [string, string]> = {
  executed: ['Végrehajtódik', 'ok'], partial: ['Részben', 'part'], ignored: ['Ignored', 'ign'], negated: ['Negated', 'neg'], skipped: ['Nem hajtódik végre', 'ign'],
};
export const Refs = ({ r }: { r: string }) => <span className="cbv-refs">{r.split(/,\s*/).filter(Boolean).map((x) => <a key={x} className="rref" href="#szabalyok" data-ref={x}>{x}</a>)}</span>;
export const imgOf = (n?: string | null) => { const c = cardOf(n); return c && c.img ? IMGBASE + c.img : ''; };
