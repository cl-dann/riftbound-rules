/* Levenshtein távolság (deck lapnév javaslat). (a korábbi legacy/core.ts része, S15) */
export function lev(a: string,b: string){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p: number[]=[];for(let j=0;j<=n;j++)p[j]=j;for(let i=1;i<=m;i++){const q=[i];for(let j=1;j<=n;j++)q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=q;}return p[n];}
