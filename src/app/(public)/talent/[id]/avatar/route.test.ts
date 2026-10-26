import {afterEach,beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({version:vi.fn(),download:vi.fn()}));
vi.mock("@/db/client",()=>({withVisitor:(callback:(tx:{execute:()=>Promise<unknown>})=>Promise<unknown>)=>callback({execute:async()=>[{version:await mocks.version()}]})}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({storage:{from:()=>({download:mocks.download})}})}));
import {GET} from "./route";
const id="00000000-0000-4000-8000-000000000001",context={params:Promise.resolve({id})};
beforeEach(()=>{mocks.version.mockResolvedValue("updated");mocks.download.mockResolvedValue({data:new Blob(["webp"]),error:null});});
afterEach(()=>vi.clearAllMocks());
it("rejects an invalid account path before querying storage",async()=>{
 const result=await GET(new Request("http://localhost/talent/invalid/avatar"),{params:Promise.resolve({id:"invalid"})});
 expect(result.status).toBe(404);expect(mocks.version).not.toHaveBeenCalled();expect(mocks.download).not.toHaveBeenCalled();
});
it("never returns a private profile photo, even for a previously cached version",async()=>{
 mocks.version.mockResolvedValue(null);const result=await GET(new Request("http://localhost/avatar",{headers:{"If-None-Match":'"updated"'}}),context);
 expect(result.status).toBe(404);expect(result.headers.get("cache-control")).toBe("no-store");expect(mocks.download).not.toHaveBeenCalled();
});
it("serves the published fixed avatar path with revalidation and image headers",async()=>{
 const result=await GET(new Request("http://localhost/avatar"),context);
 expect(result.status).toBe(200);expect(await result.text()).toBe("webp");expect(mocks.download).toHaveBeenCalledWith(`${id}/avatar.webp`);
 expect(result.headers.get("content-type")).toBe("image/webp");expect(result.headers.get("cache-control")).toContain("must-revalidate");expect(result.headers.get("cross-origin-resource-policy")).toBe("same-origin");
});
it("rechecks publication before responding to an unchanged image version",async()=>{
 const result=await GET(new Request("http://localhost/avatar",{headers:{"If-None-Match":'"updated"'}}),context);
 expect(result.status).toBe(304);expect(mocks.version).toHaveBeenCalledOnce();expect(mocks.download).not.toHaveBeenCalled();
});
it("does not cache a missing storage object",async()=>{
 mocks.download.mockResolvedValue({data:null,error:new Error("Missing")});const result=await GET(new Request("http://localhost/avatar"),context);
 expect(result.status).toBe(404);expect(result.headers.get("cache-control")).toBe("no-store");
});
