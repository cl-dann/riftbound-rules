/* Szöveg: HTML escape és keresési normalizálás. (a korábbi legacy/core.ts része, S15) */
const ESC: Record<string, string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'};
export const esc=(s: unknown)=>String(s).replace(/[&<>"]/g,c=>ESC[c]);
export const norm=(s: unknown)=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019`]/g,"'").replace(/[^a-z0-9']+/g,' ').trim();
