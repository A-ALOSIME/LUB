import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({publicEventPoster:vi.fn(),privateEventPoster:vi.fn(),user:vi.fn(),download:vi.fn()}));
vi.mock("@/features/events/workspace",()=>mocks);
vi.mock("@/features/auth/session",()=>({getVerifiedUser:mocks.user}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({storage:{from:()=>({download:mocks.download})}})}));
import {GET} from "./route";
const id="00000000-0000-4000-8000-000000000001";
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue(null);mocks.download.mockResolvedValue({data:new Blob([new Uint8Array([1,2,3])]),error:null});});
it("never downloads a private poster for an anonymous visitor",async()=>{
 const response=await GET(new Request("https://lub.community/event-posters/"+id),{params:Promise.resolve({id})});
 expect(response.status).toBe(404);expect(mocks.privateEventPoster).not.toHaveBeenCalled();expect(mocks.download).not.toHaveBeenCalled();
});
it("serves a manager's authorized draft poster without sharing it in caches",async()=>{
 mocks.user.mockResolvedValue({id:"verified-manager"});mocks.privateEventPoster.mockResolvedValue({object_key:"owned/poster",mime_type:"image/png"});
 const response=await GET(new Request("https://lub.community/event-posters/"+id),{params:Promise.resolve({id})});
 expect(mocks.privateEventPoster).toHaveBeenCalledWith("verified-manager",id);expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("continues serving published posters to visitors",async()=>{
 mocks.publicEventPoster.mockResolvedValue({object_key:"public/poster",mime_type:"image/jpeg"});
 const response=await GET(new Request("https://lub.community/event-posters/"+id),{params:Promise.resolve({id})});
 expect(response.status).toBe(200);expect(mocks.user).not.toHaveBeenCalled();expect(response.headers.get("cache-control")).toBe("private, max-age=0, must-revalidate");expect(response.headers.get("location")).toBeNull();expect(response.headers.get("content-type")).toBe("image/jpeg");expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1,2,3]));
});
