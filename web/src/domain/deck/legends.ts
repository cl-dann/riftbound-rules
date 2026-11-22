/* Melyik Champion Legenddel játszható egy lap: a Core Rules deck-építési szabályai (103) alapján.
   Domain Identity (103.2.b.3, 103.2.b.4, 103.2.b.5), Rune Deck (103.4.a.1), Battlefield (103.5.b),
   Signature lapok (103.3.d.2), Chosen Champion (103.3.a.2). A formátum tiltólistája külön sor (103.3.e). */
import type { Card } from '../data/schema';

export type LegendFit = {
  /** A legendek, amelyek deckjébe a lap betehető. */
  legends: Card[];
  /** Champion unitnál: ezekkel a legendekkel lehet Chosen Champion (103.3.a.2). */
  chosen: Card[];
  /** Mind a legend megfelel (a lapnak nincs domainje). */
  all: boolean;
  /** Az indoklás sorai: [szabályszámok, szöveg]. */
  why: [string, string][];
};

const inId = (c: Card, L: Card) => (c.d || []).every((d) => (L.d || []).includes(d));

export function legendsFor(c: Card, cards: Card[]): LegendFit | null {
  if (c.t === 'Legend' || (c.st || []).includes('Token')) return null;
  const all = cards.filter((x) => x.t === 'Legend');
  const doms = c.d || [];
  const why: [string, string][] = [];
  let legends = all.filter((L) => inId(c, L));
  if (c.t === 'Rune') why.push(['103.4.a.1', 'Rune: csak olyan legenddel, amelynek Domain Identity-je tartalmazza a rune domainjét (' + doms.join(' + ') + ').']);
  else if (!doms.length) why.push([c.t === 'Battlefield' ? '103.5.b, 103.2.b.5' : '103.2.b.5', 'A lapnak nincs domainje, ezért bármelyik legend deckjébe betehető.']);
  else if (doms.length === 1) why.push(['103.2.b.3', 'Egy domain (' + doms[0] + '): azok a legendek, amelyek Domain Identity-je tartalmazza.']);
  else why.push(['103.2.b.4', 'Több domain (' + doms.join(' + ') + '): csak az a legend, amelynek Domain Identity-je mindet tartalmazza.']);
  if ((c.st || []).includes('Signature')) {
    legends = legends.filter((L) => !!L.ch && (c.tg || []).includes(L.ch));
    why.push(['103.3.d, 103.3.d.2', 'Signature lap: csak annak a legendnek a deckjébe, amelynek Champion tagje szerepel a lapon (' + (c.tg || []).join(', ') + '); egy deckben legfeljebb 3 Signature lap.']);
  }
  const champ = c.t === 'Unit' && (c.st || []).includes('Champion');
  const chosen = champ ? legends.filter((L) => !!L.ch && (c.tg || []).includes(L.ch)) : [];
  if (champ) why.push(['103.3.a.2', 'Champion unit: Chosen Champion csak az azonos Champion tagű legend mellett lehet' + (chosen.length ? '' : '; ilyen legend most nincs a kártyaadatban') + '. Más legend deckjébe a Main Deck részeként tehető, ha a domain illik.']);
  if (c.ban === 1) why.push(['103.3.e', 'A lap Constructed formátumban tiltott, ott egyik legenddel sem játszható.']);
  return { legends, chosen, all: !doms.length && c.t !== 'Rune', why };
}
