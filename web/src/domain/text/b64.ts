/* URL-biztos base64 unicode szövegre (#c= és #d= linkek). (a korábbi legacy/core.ts része, S15) */
export function b64e(s: string){return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function b64d(s: string){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return decodeURIComponent(escape(atob(s)));}
