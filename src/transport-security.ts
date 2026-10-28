const securityHeaders = [
 ["X-Content-Type-Options","nosniff"],
 ["X-Frame-Options","DENY"],
 ["Referrer-Policy","strict-origin-when-cross-origin"],
 ["Permissions-Policy","camera=(), microphone=(), geolocation=()"],
] as const;

// Apply at the deployed Worker boundary: the Next configuration alone does not
// decorate every response returned by the current production adapter.
export async function secureSiteRequest(request:Request,respond:()=>Response|Promise<Response>):Promise<Response>{
 const url=new URL(request.url);
 if(url.protocol==="http:"&&url.hostname==="lub.community"){
  url.protocol="https:";url.port="";
  return new Response(null,{status:308,headers:{...Object.fromEntries(securityHeaders),Location:url.href,"Cache-Control":"no-store"}});
 }
 const original=await respond(),headers=new Headers(original.headers);
 for(const [name,value] of securityHeaders)if(!headers.has(name))headers.set(name,value);
 if(url.protocol==="https:")headers.set("Strict-Transport-Security","max-age=31536000; includeSubDomains");
 if(/^\/(files|documents|talent)(\/|$)/.test(url.pathname)||url.pathname==="/auth/callback")headers.set("Referrer-Policy","no-referrer");
 // Transfer the body stream directly; do not buffer SSR, downloads or AI replies.
 return new Response(original.body,{status:original.status,statusText:original.statusText,headers});
}
