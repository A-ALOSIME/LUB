import {expect,it,vi} from "vitest";
import {dispatchRender} from "./renderer-dispatch";
it("forwards the original request and streamed response without buffering or changing session headers",async()=>{
 const request=new Request("https://lub.community/manage/organizations?section=forms",{method:"POST",headers:{cookie:"fixture-session=value",origin:"https://lub.community","next-action":"fixture-action"},body:"fixture-form"});
 const response=new Response("streamed",{headers:{"set-cookie":"fixture-session=refreshed"}}),fetch=vi.fn(async()=>response),getByName=vi.fn(()=>({fetch}));
 expect(await dispatchRender(request,{getByName},0)).toBe(response);expect(fetch).toHaveBeenCalledWith(request);expect(request.bodyUsed).toBe(false);expect(getByName).toHaveBeenCalledWith("render-0",{locationHint:"weur"});
});
it("uses only four bounded renderer names independent of users or URLs",async()=>{
 const names=new Set<string>(),getByName=vi.fn((name:string)=>{names.add(name);return{fetch:async()=>new Response(null)};});
 for(let i=0;i<256;i++)await dispatchRender(new Request("https://lub.community/"),{getByName},i);
 expect([...names]).toEqual(["render-0","render-1","render-2","render-3"]);
});
