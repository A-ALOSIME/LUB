import {registrantsWorkbook,type RegistrantsExport} from "./xlsx.ts";
type Dependencies={env:(key:string)=>string|undefined;fetcher:typeof fetch};
export function createRegistrantsExportHandler({env,fetcher}:Dependencies){return async(request:Request)=>{
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
 const fail=(status:number)=>Response.json({error:"Export unavailable"},{status,headers});
 if(request.method!=="POST")return fail(405);
 const auth=request.headers.get("authorization"),url=env("SUPABASE_URL"),key=env("SUPABASE_ANON_KEY");if(!auth?.startsWith("Bearer ")||!url||!key)return fail(401);
 try{
  if(Number(request.headers.get("content-length")??0)>2048)return fail(413);const text=await request.text();if(text.length>2048)return fail(413);
  const input=JSON.parse(text),uuid=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if(!input||!uuid(input.org)||!uuid(input.event)||!(input.committee===null||uuid(input.committee))||!["","Pending","Accepted","Recorded","Rejected"].includes(input.state)||typeof input.q!=="string"||input.q.length>120||!["ar","en"].includes(input.locale))return fail(400);
  const identity=await fetcher(`${url}/auth/v1/user`,{headers:{authorization:auth,apikey:key},signal:AbortSignal.timeout(10000)});if(!identity.ok)return fail(401);const user=await identity.json();if(!user||typeof user.id!=="string")return fail(401);
  const secret=env("IDENTIFIER_ENCRYPTION_KEY");if(!secret)return fail(503);
  const rpc=(name:string,body:unknown)=>fetcher(`${url}/rest/v1/rpc/${name}`,{method:"POST",headers:{authorization:auth,apikey:key,"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const prepared=await rpc("prepare_registrant_export",{org:input.org,committee:input.committee,event:input.event,state:input.state,query:input.q});
  if(!prepared.ok){const issue=await prepared.json();return fail(issue?.code==="54000"&&issue?.message==="Export rate limit"?429:issue?.code==="42501"?403:502);}const ticket=await prepared.json();if(!uuid(ticket?.ticket))return fail(502);
  const response=await rpc("consume_registrant_export",{target:ticket.ticket});
  if(!response.ok)return fail(response.status===429?429:403);const data:RegistrantsExport=await response.json();if(!data||typeof data.slug!=="string"||!Array.isArray(data.records)||data.records.length>5000)return fail(502);
  const bytes=await registrantsWorkbook(data,input.locale,secret),date=new Intl.DateTimeFormat("en-CA-u-nu-latn",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),safe=(value:string)=>value.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-"),slug=safe(data.slug)||"organization",state=input.state||"all";
  return new Response(bytes,{headers:{...headers,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${slug}-registrants-${safe(input.event)}-${state.toLowerCase()}-${date}.xlsx"`}});
 }catch{return fail(502);}
};}
