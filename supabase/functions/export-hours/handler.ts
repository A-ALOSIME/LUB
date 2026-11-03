import {hoursWorkbook,type HoursExport} from "./xlsx.ts";
type Dependencies={env:(key:string)=>string|undefined;fetcher:typeof fetch};
export function createHoursExportHandler({env,fetcher}:Dependencies){return async(request:Request)=>{
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
 const fail=(status:number)=>Response.json({error:"Export unavailable"},{status,headers});
 if(request.method!=="POST")return fail(405);
 const auth=request.headers.get("authorization"),url=env("SUPABASE_URL"),key=env("SUPABASE_ANON_KEY");if(!auth?.startsWith("Bearer ")||!url||!key)return fail(401);
 try{
  if(Number(request.headers.get("content-length")??0)>2048)return fail(413);const text=await request.text();if(text.length>2048)return fail(413);
  const input=JSON.parse(text),uuid=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if(!input||!uuid(input.org)||!(input.committee===null||uuid(input.committee))||!(input.term===null||uuid(input.term))||![null,"Approved","Pending","Rejected"].includes(input.state)||typeof input.q!=="string"||input.q.length>120||!["ar","en"].includes(input.locale))return fail(400);
  const identity=await fetcher(`${url}/auth/v1/user`,{headers:{authorization:auth,apikey:key},signal:AbortSignal.timeout(10000)});if(!identity.ok)return fail(401);const user=await identity.json();if(!user||typeof user.id!=="string")return fail(401);
  const response=await fetcher(`${url}/rest/v1/rpc/export_hours_rows`,{method:"POST",headers:{authorization:auth,apikey:key,"content-type":"application/json"},body:JSON.stringify({org:input.org,committee:input.committee,term:input.term,state:input.state,query:input.q}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)return fail(response.status===429?429:403);const data:HoursExport=await response.json();if(!data||typeof data.slug!=="string"||!Array.isArray(data.records)||data.records.length>5000)return fail(502);
  const bytes=await hoursWorkbook(data,input.locale),date=new Intl.DateTimeFormat("en-CA-u-nu-latn",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),slug=data.slug.toLowerCase().replace(/[^a-z0-9-]/g,"-")||"organization",state=input.state??"all";
  return new Response(bytes,{headers:{...headers,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${slug}-hours-${state.toLowerCase()}-${date}.xlsx"`}});
 }catch{return fail(502);}
};}
