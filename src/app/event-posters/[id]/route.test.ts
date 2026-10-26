import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({publicEventPoster:vi.fn(),privateEventPoster:vi.fn(),user:vi.fn(),signed:vi.fn()}));
vi.mock("@/features/events/workspace",()=>mocks);
vi.mock("@/features/auth/session",()=>({getVerifiedUser:mocks.user}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({storage:{from:()=>({createSignedUrl:mocks.signed})}})}));
import {GET} from "./route";
const id="00000000-0000-4000-8000-000000000001";
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue(null);mocks.signed.mockResolvedValue({data:{signedUrl:"https://storage.example/poster"},error:null});});
it("never signs a private poster for an anonymous visitor",async()=>{
 const response=await GET(new Request("https://lub.community/event-posters/"+id),{params:Promise.resolve({id})});
 expect(response.status).toBe(404);expect(mocks.privateEventPoster).not.toHaveBeenCalled();expect(mocks.signed).not.toHaveBeenCalled();
});
it("serves a manager's authorized draft poster without sharing its redirect in caches",async()=>{
 mocks.user.mockResolvedValue({id:"verified-manager"});mocks.privateEventPoster.mockResolvedValue({object_key:"owned/poster",mime_type:"image/png"});
 const response=await GET(new Request("https://lub.community/event-posters/"+id),{params:Promise.resolve({id})});
 expect(mocks.privateEventPoster).toHaveBeenCalledWith("verified-manager",id);expect(response.status).toBe(302);expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("continues serving published posters to visitors",async()=>{
 mocks.publicEventPoster.mockResolvedValue({object_key:"public/poster",mime_type:"image/jpeg"});
 const response=await GET(new Request("https://lub.community/event-posters/"+id),{params:Promise.resolve({id})});
 expect(response.status).toBe(302);expect(mocks.user).not.toHaveBeenCalled();expect(response.headers.get("location")).toBe("https://storage.example/poster");
});
