/** Return only to known list pages; never trust a URL supplied by the caller. */
export function listReturnPath(value:unknown,fallback:string){
 if(typeof value!=="string"||!value||value.length>4096||!value.startsWith("/")||value.startsWith("//")||/[\\\u0000-\u001f]/.test(value))return fallback;
 try{
  const url=new URL(value,"https://lub.community");
  const list=/^\/(?:activity|applications|organizations(?:\/[a-z0-9-]+)?|events\/discover|manage\/organizations(?:\/[0-9a-f-]+(?:\/(?:events|tasks|renewals|members))?)?)?$/.test(url.pathname);
  return url.origin==="https://lub.community"&&list?`${url.pathname}${url.search}${url.hash}`:fallback;
 }catch{return fallback;}
}

export function withReturnTo(href:string,origin:string){
 const source=listReturnPath(origin,"");
 if(!source)return href;
 const url=new URL(href,"https://lub.community");
 if(url.origin!=="https://lub.community")return href;
 url.searchParams.set("returnTo",source);
 return `${url.pathname}${url.search}${url.hash}`;
}
