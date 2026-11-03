import {getVerifiedUser} from "@/features/auth/session";
import {createClient} from "@/lib/supabase/server";
import {getAuthConfig} from "@/lib/env";
import {z} from "zod";
const input=z.object({event:z.uuid(),committee:z.uuid().nullable(),q:z.string().trim().max(120),state:z.enum(["","Pending","Accepted","Recorded","Rejected"]),locale:z.enum(["ar","en"])});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'","Referrer-Policy":"no-referrer"},fail=(status:number)=>Response.json({error:"Export unavailable"},{status,headers});
 if(request.headers.get("origin")!==new URL(request.url).origin)return fail(403);
 const user=await getVerifiedUser();if(!user)return fail(401);const org=z.uuid().safeParse((await params).id);if(!org.success)return fail(400);
 try{
  const text=await request.text();if(text.length>2048)return fail(413);const parsed=input.safeParse(JSON.parse(text));if(!parsed.success)return fail(400);
  const config=getAuthConfig();if(!config)return fail(503);const {data:{session}}=await(await createClient()).auth.getSession();if(!session||session.user.id!==user.id)return fail(401);
  const response=await fetch(`${config.url}/functions/v1/export-registrants`,{method:"POST",headers:{authorization:`Bearer ${session.access_token}`,apikey:config.key,"content-type":"application/json"},body:JSON.stringify({org:org.data,...parsed.data}),cache:"no-store",signal:AbortSignal.timeout(30000)});
  if(!response.ok)return fail([400,401,403,429,503].includes(response.status)?response.status:502);
  return new Response(response.body,{headers:{...headers,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":response.headers.get("Content-Disposition")??'attachment; filename="registrants.xlsx"'}});
 }catch{return fail(503);}
}
