/* Lapszöveg segédek: emlékeztető szöveg törlése, sima szöveg, keyword és költségsor minták. (a chainCore.ts 1-405. sorából, S19) */
export const stripRem=(s:string)=>(s||'').replace(/\([^()]*\)/g,' ').replace(/\s+/g,' ').trim();
export const plainOf=(h:string)=>String(h).replace(/<[^>]+>/g,'').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
/** Csak keywordöt (és költségjelet) tartalmazó sor, például "[Hidden]", "[Repeat] [2]", "[Equip] [C]". */
export const KW_ONLY=/^(?:\[[A-Za-z' -]+(?: \d+)?\]\s*(?:\[[^\]]*\]\s*)*)+$/;
export const KW_HEAD=/^(?:\[(?:Reaction|Action|Hidden|Quick-Draw|Accelerate|Ganking|Deflect(?: \d+)?|Tank|Backline|Shield(?: \d+)?|Assault(?: \d+)?|Vision|Temporary|Repeat)\](?:\s*\[[^\]]*\])*\s*)+/i;
/** Költségsor (nem utasítás): kötelező vagy választható additional cost. */
export const COST_LINE=/^(?:as an additional cost to play (?:this|me)\b|you may (?:pay [^.]*?|kill a friendly unit) as an additional cost|as you play (?:this|me), you may pay [^.]*? as an additional cost)/i;
export const TRIG_LINE=/^(?:\[[^\]]+\]\s*)*(?:(?:when|whenever)\b[^,]*,|at (?:the )?(?:start|end|beginning)\b[^,]*,|the (?:first|next|second) time\b[^,]*,)\s*/i;
export const DK_LINE=/^(?:\[[^\]]+\]\s*)*\[(Deathknell|Hunt(?: \d+)?)\]\s*(?:\[>\])?\s*(?:[\u2014-]\s*)?/i;
