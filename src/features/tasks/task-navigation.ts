/** Only task list paths are accepted; never turn a return parameter into a redirect. */
export function taskReturnPath(value:string|undefined,fallback:string){
 if(!value||!value.startsWith("/")||value.startsWith("//")||value.includes("\\"))return fallback;
 try{const url=new URL(value,"https://lub.community");return url.origin==="https://lub.community"&&(url.pathname==="/activity"||/^\/manage\/organizations\/[0-9a-f-]+\/tasks$/.test(url.pathname))?`${url.pathname}${url.search}`:fallback;}catch{return fallback;}
}
