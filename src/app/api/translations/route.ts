import {getAuthConfig} from "@/lib/env";

/** Same-origin proxy keeps the browser's existing connect-src 'self' policy. */
export async function POST(request:Request){
 const headers={"Cache-Control":"no-store"};
 const fail=(status:number)=>Response.json({error:"Translation unavailable"},{status,headers});
 if(request.headers.get("origin")!==new URL(request.url).origin)return fail(403);
 if(!request.headers.get("content-type")?.startsWith("application/json"))return fail(415);
 const reader=request.body?.getReader();if(!reader)return fail(400);
 let text="",bytes=0;const decoder=new TextDecoder();
 try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>65536)return fail(413);text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}
 catch{return fail(400);}finally{await reader.cancel().catch(()=>undefined);}
 let input:unknown;try{input=JSON.parse(text);}catch{return fail(400);}
 if(!input||typeof input!=="object"||!("text" in input)||typeof input.text!=="string"||!input.text.trim()||input.text.length>10000||!("target_lang" in input)||input.target_lang!=="EN")return fail(400);
 const config=getAuthConfig();if(!config)return fail(503);
 try{
  const response=await fetch(`${config.url}/functions/v1/translate-content`,{method:"POST",headers:{apikey:config.key,"content-type":"application/json"},body:JSON.stringify({text:input.text,source_lang:"AR",target_lang:"EN"}),signal:AbortSignal.timeout(30000),cache:"no-store"});
  if(response.status===202)return fail(202);
  if(!response.ok)return fail([400,403,429,503].includes(response.status)?response.status:502);
  const body:unknown=await response.json();
  if(!body||typeof body!=="object"||!("translated_text" in body)||typeof body.translated_text!=="string"||!body.translated_text.trim()||body.translated_text.length>30000)return fail(502);
  return Response.json({translated_text:body.translated_text},{headers});
 }catch{return fail(502);}
}
