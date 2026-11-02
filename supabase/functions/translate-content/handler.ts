import {MAX_TRANSLATION_CHARACTERS,protectNames,readTranslationXml} from "./policy.ts";

type Dependencies={env:(name:string)=>string|undefined;fetcher:typeof fetch};
class RpcError extends Error {constructor(readonly code:string){super("Translation storage unavailable");}}

async function limitedJson(body:ReadableStream<Uint8Array>|null,limit:number):Promise<unknown>{
 if(!body)throw Error("Missing body");
 const reader=body.getReader(),decoder=new TextDecoder();let bytes=0,text="";
 try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>limit){await reader.cancel();throw Error("Body too large");}text+=decoder.decode(part.value,{stream:true});}return JSON.parse(text+decoder.decode());}
 finally{reader.releaseLock();}
}
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==="object"&&!Array.isArray(value);}

export function createTranslationHandler({env,fetcher}:Dependencies){
 async function rpc(name:string,body:Record<string,unknown>):Promise<unknown>{
  const url=env("SUPABASE_URL"),key=env("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)throw new RpcError("configuration");
  const response=await fetcher(`${url}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const result=await limitedJson(response.body,200000);
  if(!response.ok)throw new RpcError(record(result)&&typeof result.code==="string"?result.code:"storage");
  return result;
 }
 return async(request:Request):Promise<Response>=>{
  const origin=request.headers.get("origin"),headers:Record<string,string>={"cache-control":"no-store",Vary:"Origin"};
  if(origin&&origin!=="https://lub.community")return Response.json({error:{code:"origin_not_allowed",message:"المصدر غير مسموح."}},{status:403,headers});
  if(origin)headers["Access-Control-Allow-Origin"]=origin;
  const error=(status:number,code:string,message:string)=>Response.json({error:{code,message}},{status,headers});
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{...headers,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"content-type, apikey, authorization, x-client-info"}});
  if(request.method!=="POST")return error(405,"method_not_allowed","استخدم طلب ترجمة صالحًا.");
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")??""))return error(415,"invalid_content_type","صيغة الطلب غير مدعومة.");
  let input:unknown;try{input=await limitedJson(request.body,65536);}catch{return error(400,"invalid_input","تعذّر قراءة النص.");}
  if(!record(input)||typeof input.text!=="string"||!input.text.trim()||input.text.length>MAX_TRANSLATION_CHARACTERS||!/[\u0621-\u064a]/u.test(input.text)||typeof input.target_lang!=="string"||input.target_lang.toUpperCase()!=="EN"||(input.source_lang!==undefined&&input.source_lang!=="AR"))return error(400,"invalid_input","الترجمة متاحة من العربية إلى الإنجليزية لنص لا يتجاوز 10000 حرف.");
  const source=input.text,hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(source))),b=>b.toString(16).padStart(2,"0")).join("");
  const success=(translated_text:string,cached:boolean)=>Response.json({translated_text,source_hash:hash,source_lang:"AR",target_lang:"EN",cached},{headers});
  let requestId:string|undefined;
  try{
   const cached=await rpc("translation_lookup",{p_source:source,p_hash:hash,p_target:"EN"});
   if(typeof cached==="string")return success(cached,true);
   const key=env("DEEPL_API_KEY")?.trim();
   if(!key||env("DEEPL_TRANSLATION_ENABLED")==="false")return error(503,"translation_not_configured","الترجمة غير متاحة حاليًا.");
   const reservation=await rpc("translation_reserve",{p_source:source,p_hash:hash,p_target:"EN"});
   if(!record(reservation))throw Error("Invalid reservation");
   if(reservation.state==="cached"&&typeof reservation.translated_text==="string")return success(reservation.translated_text,true);
   if(reservation.state==="limited")return error(429,"translation_rate_limited","بلغت الترجمة حد الاستخدام المؤقت. حاول لاحقًا.");
   if(reservation.state==="busy")return Response.json({error:{code:"translation_pending",message:"الترجمة قيد التجهيز."}},{status:202,headers:{...headers,"Retry-After":"1"}});
   if(reservation.state!=="reserved"||typeof reservation.request_id!=="string")throw Error("Invalid reservation");
   requestId=reservation.request_id;
   // Legacy API Free keys end in :fx; current Developer keys use the main API.
   const endpoint=key.endsWith(":fx")?"https://api-free.deepl.com/v2/translate":"https://api.deepl.com/v2/translate";
   const response=await fetcher(endpoint,{method:"POST",headers:{Authorization:`DeepL-Auth-Key ${key}`,"content-type":"application/json"},body:JSON.stringify({text:[protectNames(source)],source_lang:"AR",target_lang:"EN",tag_handling:"xml",ignore_tags:["keep"],preserve_formatting:true,context:"Student clubs and councils at a university. Organization names are proper nouns."}),signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error("Translation provider unavailable");
   const body=await limitedJson(response.body,200000),translations=record(body)&&Array.isArray(body.translations)?body.translations:null;
   const translated=translations?.[0];if(!record(translated)||typeof translated.text!=="string")throw Error("Invalid translation response");
   const text=readTranslationXml(translated.text,source);
   await rpc("translation_finish",{p_request:requestId,p_source:source,p_hash:hash,p_translated:text});
   requestId=undefined;
   return success(text,false);
  }catch(cause){
   if(requestId)try{await rpc("translation_finish",{p_request:requestId,p_source:source,p_hash:hash,p_translated:null});}catch{/* The short lease expires if storage is temporarily unreachable. */}
   if(cause instanceof RpcError&&cause.code==="42501")return error(403,"content_not_public","هذا النص غير متاح للترجمة العامة.");
   return error(502,"translation_unavailable","تعذّرت الترجمة. سيظهر النص الأصلي.");
  }
 };
}
