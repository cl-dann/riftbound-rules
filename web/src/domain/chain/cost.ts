/* Költségfeltételek (costCondOf, costCheck, printedCost). (a chainCore.ts 1-405. sorából, S19) */

/** Költségfeltétel egy választásban ("cost no more than [3] and no more than [A]", "Energy cost [4] or less", "Power cost [A][A] or more",
    "Energy cost no more than my Might", "Energy cost less than your points", "no more Energy and no more Power than the killed unit").
    A szám a nyomtatott Energy (131.2.a), a Power szimbólumok száma a nyomtatott Power (131.3.a). e és p: [művelet, érték]; az érték szám vagy változó. */
export type CostCond={e?:[string,number|string];p?:[string,number|string];t:string};
export function costCondOf(t0:string):CostCond|null{const t=String(t0||'');let m:any;const c:any={t:''};
  const pw=(x:string)=>(x.match(/\[[A-Z]\]/g)||[]).length;
  if((m=/no more Energy and no more Power than the killed unit/i.exec(t))){c.e=['<=','relE'];c.p=['<=','relP'];c.t=m[0];return c;}
  if((m=/Energy cost no more than my Might/i.exec(t))){c.e=['<=','might'];c.t=m[0];return c;}
  if((m=/Energy cost less than your points/i.exec(t))){c.e=['<','points'];c.t=m[0];return c;}
  if((m=/\b(?:Energy cost|costs?|costing|with cost)\s+no more than \[(\d+)\](?:\s*(?:and|,)\s*(?:with\s+)?(?:Power cost\s+)?no more than ((?:\[[A-Z]\])+))?/i.exec(t))){c.e=['<=',+m[1]];if(m[2])c.p=['<=',pw(m[2])];c.t=m[0];}
  if((m=/\bPower cost no more than ((?:\[[A-Z]\])+)/i.exec(t))){c.p=['<=',pw(m[1])];c.t=(c.t?c.t+'; ':'')+m[0];}
  if(!c.e&&(m=/\b(?:Energy cost|costs?|with cost)\s+\[(\d+)\] or (more|less)\b/i.exec(t))){c.e=[m[2].toLowerCase()==='more'?'>=':'<=',+m[1]];c.t=(c.t?c.t+'; ':'')+m[0];}
  if(!c.p&&(m=/\bPower cost ((?:\[[A-Z]\])+) or (more|less)\b/i.exec(t))){c.p=[m[2].toLowerCase()==='more'?'>=':'<=',pw(m[1])];c.t=(c.t?c.t+'; ':'')+m[0];}
  return c.e||c.p?c:null;}
/** A lap nyomtatott költsége (206, 356.1.c): token 0 (185.3.a.1); hiányzó Power rész 0 (131.3.b, levezetés). */
export const printedCost=(card:any)=>{const tok=/token/i.test(((card&&card.st)||[]).join(' '));return {e:tok?0:+(card&&card.e!=null&&card.e!==''?card.e:0),p:tok?0:+(card&&card.p!=null&&card.p!==''?card.p:0)};};
export const COSTVAR:any={might:'a forrás Mightja',points:'a játékos pontszáma',relE:'a költségként megölt unit Energy költsége',relP:'a költségként megölt unit Power költsége'};
/** Költségfeltétel ellenőrzése a nyomtatott költségen; ctx: a változók (might, points, relE, relP). '' ha megfelel vagy nem ellenőrizhető. */
export function costCheck(cc:CostCond|null|undefined,card:any,ctx?:any){if(!cc||!card)return '';const pc=printedCost(card);const out:string[]=[];
  const ok=(op:string,a:number,b:number)=>op==='<='?a<=b:op==='>='?a>=b:op==='<'?a<b:true;const OPH:any={'<=':'legfeljebb','>=':'legalább','<':'kevesebb, mint'};
  ([['e','Energy költsége'],['p','Power költsége']] as const).forEach(([k,lbl])=>{const r=(cc as any)[k];if(!r)return;let v=r[1];if(typeof v==='string'){const nm=COSTVAR[v]||v;v=ctx?ctx[v]:null;if(v==null){out.push('a feltétel nem ellenőrizhető: '+nm+' nem elérhető, az erre épülő ellenőrzés null (359.3.e.12)');return;}}
    if(!ok(r[0],pc[k],+v))out.push(lbl+' '+pc[k]+', a feltétel '+OPH[r[0]]+' '+v);});
  return out.length?out.join('; ')+' (206)':'';}

/** Kézből, deckből vagy trashből választó utasítás (355.7, 355.9.a, 355.10.a). z: zóna; who: kinek a zónája ("your" = a lap irányítója);
    target: a trash nyilvános zóna, ezért az onnan választott lap célpont, a lerakáskor kell kiválasztani (355.8, 355.10.a, 108.2.d);
    a kéz (108.7.c) és a deck (108.4.e) nem nyilvános: ott a választás nem célpont, a resolve-kor történik (355.10.a, 355.18).
    n: legfeljebb ennyi lap; type: a lap típusa (unit, spell, gear vagy bármi); tags: kötelező tag; act: a művelet; opt: "you may" vagy "up to". */
