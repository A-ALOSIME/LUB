import {getVerifiedUser} from "@/features/auth/session";
import {createClient} from "@/lib/supabase/server";
import {getAuthConfig} from "@/lib/env";
import {z} from "zod";
const input=z.object({q:z.string().trim().max(120),status:z.enum(['all','Active','Ended','Inactive']),committee:z.uuid().nullable(),locale:z.enum(['ar','en'])});
async function proxy(request:Request,context:RouteContext<"/api/organizations/[id]/members/export">){
 const fail=(status:number)=>Response.json({error:"Export unavailable"},{status,headers:{'Cache-Control':'no-store'}});
 if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return fail(403);
 const user=await getVerifiedUser();if(!user)return fail(401);
 const org=z.uuid().safeParse((await context.params).id);if(!org.success)return fail(400);
 const config=getAuthConfig();if(!config)return fail(503);
 try{
  const client=await createClient(),{data:{session}}=await client.auth.getSession();if(!session||session.user.id!==user.id)return fail(401);
  const headers={authorization:`Bearer ${session.access_token}`,apikey:config.key,'content-type':'application/json'};
  let endpoint=`${config.url}/functions/v1/export-members`,body:string|undefined;
  if(request.method==='POST'){
   const text=await request.text();if(text.length>2048)return fail(413);const parsed=input.safeParse(JSON.parse(text));if(!parsed.success)return fail(400);
   body=JSON.stringify({org:org.data,q:parsed.data.q,state:parsed.data.status,committee:parsed.data.committee});
  }else{const query=new URL(request.url).searchParams,ticket=z.uuid().safeParse(query.get('ticket'));if(!ticket.success)return fail(400);endpoint+=`?ticket=${ticket.data}&locale=${query.get('locale')==='en'?'en':'ar'}`;}
  const response=await fetch(endpoint,{method:request.method,headers,body,cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)return fail([400,401,403,429,503].includes(response.status)?response.status:502);
  if(request.method==='POST'){const data=await response.json(),ticket=z.uuid().safeParse(data.ticket);if(!ticket.success)return fail(502);return Response.json({ticket:ticket.data,expires_at:data.expires_at},{headers:{'Cache-Control':'no-store'}});}
  return new Response(response.body,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="lub-members.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return fail(502);}
}
export const POST=proxy;
export const GET=proxy;
