// @ts-nocheck
/* Decklista szöveg feldolgozása és lapnév javaslat. (a korábbi legacy/core.ts része, S15) */
import { byName } from '../data/store';
import { lev } from '../text/lev';
import { norm } from '../text/norm';
export const FORMAT=`Legend:
1 Champion neve, Legend címe

Champion:
1 Champion neve, Unit címe

MainDeck:
3 Kártyanév
2 Másik kártyanév

Battlefields:
1 Battlefield neve
1 Battlefield neve
1 Battlefield neve

Rune Pool:
7 Fury Rune
5 Chaos Rune

Sideboard:
2 Kártyanév`;
export function suggest(name){
  const k=norm(name);const sc=[];
  byName.forEach((c,key)=>{const d=key.includes(k)||k.includes(key)?1:lev(k,key);if(d<=Math.max(2,Math.floor(k.length*0.34)))sc.push([d,c]);});
  sc.sort((a,b)=>a[0]-b[0]);
  return [...new Set(sc.map(s=>s[1]))].slice(0,3);
}
export function parseDeck(text){
  const secs=[];let cur=null;
  text.split(/\r?\n/).forEach(raw=>{
    const line=raw.trim();if(!line)return;
    let m=/^([A-Za-z][A-Za-z \-]*?)\s*:\s*$/.exec(line);
    if(m){cur={name:m[1],rows:[]};secs.push(cur);return;}
    if(!cur){cur={name:'Lista',rows:[]};secs.push(cur);}
    m=/^(\d+)\s*[xX]?\s+(.+)$/.exec(line);
    const qty=m?+m[1]:1,name=(m?m[2]:line).trim();
    const c=byName.get(norm(name))||null;
    cur.rows.push({qty,name,card:c,sug:c?[]:suggest(name)});
  });
  return secs;
}
