import {membersXlsx,exportFilename,type MemberExportRecord} from "./xlsx.ts";
type Dependencies={env:(key:string)=>string|undefined;fetcher:typeof fetch};
export function createMemberExportHandler({env,fetcher}:Dependencies){return async(request:Request)=>{
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 const fail=(status:number)=>Response.json({error:status===429?"Export limit reached":"Export unavailable"},{status,headers});
 if(!['POST','GET'].includes(request.method))return fail(405);
 const auth=request.headers.get('authorization'),url=env('SUPABASE_URL'),apiKey=env('SUPABASE_ANON_KEY');
 if(!auth?.startsWith('Bearer ')||!url||!apiKey)return fail(401);
 try{
  // Validate the actual token with Auth. Never trust a decoded JWT or an actor ID supplied by the caller.
  const identity=await fetcher(`${url}/auth/v1/user`,{headers:{authorization:auth,apikey:apiKey},signal:AbortSignal.timeout(10000)});
  if(!identity.ok)return fail(401);const user:unknown=await identity.json();if(!user||typeof user!=="object"||!("id" in user)||typeof user.id!=="string")return fail(401);
  const rpc=async(name:string,body:unknown)=>fetcher(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{authorization:auth,apikey:apiKey,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  if(request.method==='POST'){
   if(Number(request.headers.get('content-length')??0)>2048)return fail(413);
   const text=await request.text();if(text.length>2048)return fail(413);const input=JSON.parse(text);
   if(typeof input.org!=="string"||typeof input.q!=="string"||input.q.length>120||!['all','Active','Ended','Inactive'].includes(input.state)||(input.committee!==null&&typeof input.committee!=="string"))return fail(400);
   const response=await rpc('prepare_member_export',{org:input.org,q:input.q,state:input.state,committee:input.committee});
   if(!response.ok){const issue=await response.json();return fail(issue?.code==='54000'?429:403);}return Response.json(await response.json(),{headers});
  }
  const query=new URL(request.url).searchParams,ticket=query.get('ticket'),locale=query.get('locale')==='en'?'en':'ar';
  if(!ticket||!/^[-0-9a-f]{36}$/i.test(ticket))return fail(400);
  const secret=env('IDENTIFIER_ENCRYPTION_KEY');if(!secret)return fail(503);
  const response=await rpc('consume_member_export',{target:ticket});if(!response.ok)return fail(403);
  const data:{records:MemberExportRecord[];slug:string;filter:string}=await response.json();if(!Array.isArray(data.records)||data.records.length>500||typeof data.slug!=="string"||typeof data.filter!=="string")return fail(502);
  const bytes=await membersXlsx(data.records,secret,locale);return new Response(bytes,{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${exportFilename(data.slug,data.filter)}"`}});
 }catch{return fail(502);}
};}
