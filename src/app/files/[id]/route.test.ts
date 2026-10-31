import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),rows:vi.fn(),download:vi.fn(),signed:vi.fn()}));
vi.mock("@/features/auth/session",()=>({getVerifiedUser:mocks.user}));
vi.mock("@/db/client",()=>({withUser:async(_id:string,callback:(tx:{execute:typeof mocks.rows})=>Promise<unknown>)=>callback({execute:mocks.rows})}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({storage:{from:()=>({download:mocks.download,createSignedUrl:mocks.signed})}})}));
vi.mock("@/lib/env",()=>({getAuthConfig:()=>({url:"https://project.supabase.co"})}));
import {GET} from "./route";
const id="00000000-0000-4000-8000-000000000397",file=new Blob(["%PDF-1.4"],{type:"application/pdf"});
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({id:"user"});mocks.rows.mockResolvedValue([{object_key:`user/${id}.pdf`,file_name:"تسليم عربي.pdf",mime_type:"application/pdf",size_bytes:file.size}]);mocks.download.mockResolvedValue({data:file});mocks.signed.mockResolvedValue({data:{signedUrl:`https://project.supabase.co/storage/download/${id}.pdf`}});});
it("keeps Arabic display names out of download paths and headers",async()=>{
 const response=await GET(new Request(`https://lub.community/files/${id}`),{params:Promise.resolve({id})});expect(response.status).toBe(303);expect(mocks.signed.mock.calls[0][2]).toEqual({download:`${id}.pdf`});expect(response.headers.get("location")).not.toContain("عربي");
});
it("checks ownership through the server read before touching storage",async()=>{mocks.rows.mockResolvedValueOnce([]);const response=await GET(new Request(`https://lub.community/files/${id}`),{params:Promise.resolve({id})});expect(response.status).toBe(404);expect(mocks.download).not.toHaveBeenCalled();});
