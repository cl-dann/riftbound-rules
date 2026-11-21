/* A chain elemzés kimenete és közös állapota. */
export type ChainResult={frames:any[];html:string;story:string[];done:any[];rows:[string,string][];ev:any[];objs:any;items:any[];delayed:any[];empty:boolean;zsnap?:any};

/** A chain elemzés közös állapota és függvényei (EngineCtx): a runChain() minden korábbi belső változója és
    függvénye ennek a mezője, így a csoportok (engine/*) külön modulban élhetnek. */
export type EngineCtx={CS:any;[k:string]:any};
