/* A builder beépített példái (a "Példa betöltése" gombok és a unit tesztek). */
export const EXAMPLES:any={
  base:()=>({lg:{A:'Kennen, Heart of the Tempest',B:''},bf:[{n:"Vilemaw's Lair",c:'B'},{n:'Zaun Warrens',c:'A'}],
    bd:[{n:'Traveling Merchant',pl:'B',loc:'bf0',d:0},{n:'Long Sword',pl:'B',loc:'bf0',on:0}],
    steps:[{k:'card',n:'Riptide Rex',pl:'A',from:'hand',loc:'base',tg:['b0'],ext:{}},{k:'card',n:'Flash',pl:'B',from:'hand',tg:['b0'],ext:{}},{k:'card',n:'Star-Crossed',pl:'A',from:'hand',tg:['s0','b0'],ext:{}}]}),
  ctrl:()=>({lg:{A:'',B:''},bf:[{n:'Zaun Warrens',c:'B'},{n:'',c:''}],
    bd:[{n:'Yasuo, Remorseful',pl:'A',loc:'bf0',d:0},{n:'Traveling Merchant',pl:'B',loc:'bf0',d:0}],
    steps:[{k:'tg',src:'b0',ti:0,pl:'A',tg:['b1'],ext:{}},{k:'card',n:'Hostile Takeover',pl:'B',from:'facedown',loc:'bf0',tg:['b0'],ext:{}}]}),
  gear:()=>({lg:{A:'',B:''},bf:[{n:'Zaun Warrens',c:'A'},{n:'',c:''}],
    bd:[{n:'Akshan, Mischievous',pl:'A',loc:'bf0',d:0},{n:'Long Sword',pl:'A',loc:'bf0',on:0},{n:'Guardian Angel',pl:'B',loc:'base'}],
    steps:[{k:'card',n:'Hidden Blade',pl:'B',from:'hand',tg:['b0'],ext:{}}]}),
};
