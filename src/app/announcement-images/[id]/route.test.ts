import {afterEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({execute:vi.fn(),download:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/db/client",()=>({withVisitor:async(operation:(tx:{execute:typeof mocks.execute})=>Promise<unknown>)=>operation({execute:mocks.execute})}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({storage:{from:()=>({download:mocks.download})}})}));
import {GET} from "./route";
afterEach(()=>vi.resetAllMocks());
const params=Promise.resolve({id:"00000000-0000-4000-8000-000000000001"});
it("does not download hidden or archived announcement media",async()=>{
 mocks.execute.mockResolvedValue([]);const response=await GET(new Request("https://lub.community/announcement-images/test"),{params});expect(response.status).toBe(404);expect(mocks.download).not.toHaveBeenCalled();expect(response.headers.get("cache-control")).toContain("no-store");
});
it("serves only a verified public image with restrictive delivery headers",async()=>{
 mocks.execute.mockResolvedValue([{object_key:"public-image",mime_type:"image/png"}]);mocks.download.mockResolvedValue({data:new Blob([new Uint8Array([137,80,78,71])]),error:null});
 const response=await GET(new Request("https://lub.community/announcement-images/test"),{params});expect(response.status).toBe(200);expect(response.headers.get("content-type")).toBe("image/png");expect(response.headers.get("x-content-type-options")).toBe("nosniff");expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
});
