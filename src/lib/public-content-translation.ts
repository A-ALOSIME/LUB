import "server-only";
import {getAuthConfig} from "./env";
import {englishOrganizationName} from "./organization-names";

/** Public page metadata shares the Edge cache; never pass account or application data. */
export async function translatePublicContent(source:string):Promise<string>{
 const known=englishOrganizationName(source);if(known)return known;
 if(!/[\u0621-\u064a]/u.test(source)||source.length>10000)return source;
 const config=getAuthConfig();if(!config)return source;
 try{
  const response=await fetch(`${config.url}/functions/v1/translate-content`,{method:"POST",headers:{apikey:config.key,"content-type":"application/json"},body:JSON.stringify({text:source,target_lang:"EN"}),signal:AbortSignal.timeout(15000),cache:"no-store"});
  if(!response.ok||response.status===202)return source;
  const body:unknown=await response.json();
  return body&&typeof body==="object"&&"translated_text" in body&&typeof body.translated_text==="string"&&body.translated_text.trim()?body.translated_text:source;
 }catch{return source;}
}
