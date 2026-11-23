/* Combat triggerek a lapszövegből: a combat megnyitásakor (attack, defend: 383.4.e, 383.4.f), a combat eredményénél
   (win: 468.3.a, 468.3.c) és a combatban meghaló unitnál ("When I die in combat"). A Combat panel ebből ajánlja a chainre. */
export type CombatTrigKind = 'attack' | 'defend' | 'winI' | 'winYou' | 'dieInCombat';
const RE: Record<CombatTrigKind, RegExp> = {
  attack: /^when I attack(?: or defend)?\b/i,
  defend: /^when I (?:attack or )?defend\b/i,
  winI: /^(?:When I win a combat|The first time I win a combat each turn),\s*(.*)$/i,
  winYou: /^When you win a combat,\s*(.*)$/i,
  dieInCombat: /^When I die in combat,\s*(.*)$/i,
};
const clean = (l: string) => l.replace(/\([^()]*\)/g, ' ').replace(/\s+/g, ' ').trim();
/** A lap szövegének azon sorai, amelyek az adott combat triggerre illenek: {line, eff}. */
export function combatTrigs(txt: string | null | undefined, kind: CombatTrigKind): { line: string; eff: string }[] {
  return String(txt || '').split('\n').map(clean).flatMap((l) => {
    const m = RE[kind].exec(l); if (!m) return [];
    const eff = m[1] ?? l.replace(/^[^,]*,\s*/, '');
    return [{ line: l, eff }];
  });
}
/** Trigger feltételének (why) illeszkedése: attack vagy defend trigger. */
export const isCombatOpenTrig = (why: string, role: 'atk' | 'def') => (role === 'atk' ? RE.attack : RE.defend).test(why);
