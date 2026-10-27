import {beforeEach,expect,it,vi} from "vitest";
const claim=vi.hoisted(()=>vi.fn());
vi.mock("@/features/profile/completion-actions",()=>({claimProfileCompletionNotice:claim}));
import {POST} from "./route";
beforeEach(()=>{vi.stubEnv("APP_URL","https://lub.community/");claim.mockReset();});
it("returns only the notice flag without a page render",async()=>{claim.mockResolvedValue(true);const result=await POST(new Request("https://lub.community/api/account/completion-notice",{method:"POST",headers:{origin:"https://lub.community"}}));expect(await result.json()).toEqual({show:true});expect(result.headers.get("cache-control")).toBe("private, no-store");expect(claim).toHaveBeenCalledOnce();});
it("rejects missing or foreign origins before checking an account",async()=>{for(const origin of [null,"https://foreign.invalid"]){const response=await POST(new Request("https://lub.community/api/account/completion-notice",{method:"POST",headers:origin?{origin}:{}}));expect(response.status).toBe(403);}expect(claim).not.toHaveBeenCalled();});
