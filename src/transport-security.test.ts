import {expect,it,vi} from "vitest";
import {secureSiteRequest} from "./transport-security";
it("redirects public HTTP before rendering, preserving the path and query without consuming uploads",async()=>{
 const request=new Request("http://lub.community/manage/organizations?q=hello%20world",{method:"POST",body:"private-form"}),render=vi.fn(async()=>new Response("unsafe"));
 const response=await secureSiteRequest(request,render);expect(response.status).toBe(308);expect(response.headers.get("location")).toBe("https://lub.community/manage/organizations?q=hello%20world");expect(response.headers.get("cache-control")).toBe("no-store");expect(render).not.toHaveBeenCalled();expect(request.bodyUsed).toBe(false);
});
it("retains the response stream, nonce, status, cookies and cache settings while adding the deployed security headers",async()=>{
 const stream=new ReadableStream(),headers=new Headers({"Content-Type":"text/event-stream","Content-Security-Policy":"script-src 'nonce-fixture'","Cache-Control":"private, no-store"});headers.append("Set-Cookie","session=first; Secure; HttpOnly");headers.append("Set-Cookie","refresh=second; Secure; HttpOnly");
 const original=new Response(stream,{status:201,headers}),render=vi.fn(async()=>original),response=await secureSiteRequest(new Request("https://lub.community/api/chat"),render);
 expect(response.body).toBe(stream);expect(original.bodyUsed).toBe(false);expect(response.status).toBe(201);expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie());expect(response.headers.get("content-security-policy")).toBe(headers.get("content-security-policy"));expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("x-content-type-options")).toBe("nosniff");expect(response.headers.get("x-frame-options")).toBe("DENY");expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");expect(response.headers.get("permissions-policy")).toContain("camera=()");
});
it("preserves stricter route privacy and leaves local development HTTP usable",async()=>{
 const response=await secureSiteRequest(new Request("https://lub.community/files/document"),async()=>new Response(null,{headers:{"Referrer-Policy":"no-referrer"}}));expect(response.headers.get("referrer-policy")).toBe("no-referrer");
 const local=await secureSiteRequest(new Request("http://127.0.0.1:4173/"),async()=>new Response("local"));expect(await local.text()).toBe("local");expect(local.headers.has("strict-transport-security")).toBe(false);
});
