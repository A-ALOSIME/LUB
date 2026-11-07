import {expect,it,vi} from "vitest";
import {createMemberExportHandler} from "../supabase/functions/export-members/handler";
const org='00000000-0000-4000-8000-000000000001';
const env=(name:string)=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public',IDENTIFIER_ENCRYPTION_KEY:'test'}[name]);
it('rejects unauthenticated and invalid tokens before any export RPC',async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('{}',{status:401})),handle=createMemberExportHandler({env,fetcher});
 expect((await handle(new Request('https://edge.invalid',{method:'POST'}))).status).toBe(401);expect(fetcher).not.toHaveBeenCalled();
 expect((await handle(new Request('https://edge.invalid',{method:'POST',headers:{authorization:'Bearer fake'}}))).status).toBe(401);expect(fetcher).toHaveBeenCalledOnce();expect(fetcher.mock.calls[0][0]).toBe('https://example.invalid/auth/v1/user');
});
it('forwards the verified caller token to the scoped RPC and exposes no database error',async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({id:'real-user'})).mockResolvedValueOnce(Response.json({code:'42501',message:'private SQL detail'},{status:403}));
 const handle=createMemberExportHandler({env,fetcher}),response=await handle(new Request('https://edge.invalid',{method:'POST',headers:{authorization:'Bearer real','content-type':'application/json'},body:JSON.stringify({org,q:'',state:'all',committee:null,locale:'ar'})}));
 expect(response.status).toBe(403);expect(await response.text()).not.toContain('private');expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[1][0]).toBe('https://example.invalid/rest/v1/rpc/export_member_rows');expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({authorization:'Bearer real'});
});

it("downloads an XLSX workbook from one verified scoped RPC without exposing the payload",async()=>{
 const secret=Buffer.alloc(32,3).toString("base64");const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({id:"real-user"})).mockResolvedValueOnce(Response.json({records:[],slug:"test-club",filter:"all"}));
 const handler=createMemberExportHandler({env:name=>name==="IDENTIFIER_ENCRYPTION_KEY"?secret:env(name),fetcher});const response=await handler(new Request("https://edge.invalid",{method:"POST",headers:{authorization:"Bearer real"},body:JSON.stringify({org,q:"طالب",state:"Active",committee:null,term:org,locale:"ar"})}));
 expect(response.status).toBe(200);expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");expect(response.headers.get("Content-Disposition")).toMatch(/filename="test-club-all-\d{4}-\d{2}-\d{2}\.xlsx"/);const bytes=new Uint8Array(await response.arrayBuffer());expect(Array.from(bytes.slice(0,2))).toEqual([80,75]);expect(response.headers.get("Cache-Control")).toBe("private, no-store");expect(fetcher).toHaveBeenCalledTimes(2);expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({org,q:"طالب",state:"Active",committee:null,term:org});
});
