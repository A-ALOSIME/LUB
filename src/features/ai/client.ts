import "server-only";
import {z} from "zod";
import {publicKnowledge,type KnowledgeSource} from "./knowledge";
export type SearchState={sources:KnowledgeSource[]|null;error?:string};
const resultSchema=z.object({mode:z.literal("sources"),generated:z.literal(false),sources:z.array(z.object({id:z.string(),url:z.string(),title:z.string(),excerpt:z.string()})).max(3)});
export async function retrievePublicSources(question:string):Promise<SearchState>{
 const parsed=z.string().trim().min(3).max(500).refine(s=>![...s].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)).safeParse(question);
 if(!parsed.success)return{sources:null,error:"اكتب سؤالًا من 3 إلى 500 حرف."};
 try{
  const token=process.env.AI_SERVICE_TOKEN,url=new URL(process.env.AI_SERVICE_URL??"");
  if(!token||token.length<32||!url.pathname.match(/^\/?$/)||url.username||url.password||url.search||url.hash||!(url.protocol==="https:"||(url.protocol==="http:"&&["127.0.0.1","localhost","ai"].includes(url.hostname))))throw new Error();
  const response=await fetch(new URL("/v1/search",url),{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({question:parsed.data}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(3000)});
  if(response.status===429)return{sources:null,error:"وصل البحث إلى حد الطلبات. انتظر دقيقة ثم حاول مجددًا."};
  if(!response.ok)throw new Error();
  const reader=response.body?.getReader();if(!reader)throw new Error();const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384)throw new Error();chunks.push(value);}}finally{await reader.cancel();}
  const result=resultSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  const sources=result.sources.map(s=>{const known=publicKnowledge.find(k=>k.id===s.id&&k.url===s.url&&k.title===s.title&&k.text===s.excerpt);if(!known)throw new Error();return known;});
  if(new Set(sources.map(s=>s.id)).size!==sources.length)throw new Error();
  return{sources};
 }catch{return{sources:null,error:"البحث غير متاح حاليًا."};}
}
