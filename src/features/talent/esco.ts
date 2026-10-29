import {z} from "zod";
import {skillKey,skillLabel} from "./skill-normalization";
const uriSchema=z.string().regex(/^https?:\/\/data\.europa\.eu\/esco\/skill\/[0-9a-f-]{36}$/i);
const text=z.string().trim().min(2).max(80);
const searchSchema=z.object({_embedded:z.object({results:z.array(z.object({title:z.string(),uri:z.string()})).max(100)}).optional()});
const resourceSchema=z.object({uri:z.string(),preferredLabel:z.record(z.string(),z.string())});
export type SkillSuggestion={name:string;label:string;uri?:string};
async function read(path:string,params:Record<string,string>){const url=new URL(`https://ec.europa.eu/esco/api/${path}`);for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(4000),next:{revalidate:86400}});if(!response.ok)throw new Error("ESCO unavailable");return response.json();}
export async function searchEscoSkills(query:string,locale:"ar"|"en"):Promise<SkillSuggestion[]>{
 const response=searchSchema.parse(await read("search",{type:"skill",text:query,language:locale,limit:"8"}));
 return (response._embedded?.results??[]).filter(r=>text.safeParse(r.title).success&&uriSchema.safeParse(r.uri).success).map(r=>({name:skillLabel(r.title),label:r.title,uri:r.uri}));
}
export async function resolveEscoSkill(uri:string){
 const safe=uriSchema.parse(uri);const data=resourceSchema.parse(await read("resource/skill",{uri:safe,language:"en"}));
 if(data.uri.replace(/^https:/,"http:")!==safe.replace(/^https:/,"http:"))throw new Error("Unexpected skill");
 const english=text.parse(skillLabel(data.preferredLabel["en-us"]??data.preferredLabel.en));
 const arabic=text.safeParse(data.preferredLabel.ar);return {name:english,english,arabic:arabic.success?arabic.data:english};
}
export function mergeSkillSuggestions(local:SkillSuggestion[],external:SkillSuggestion[]){const seen=new Set<string>();return [...local,...external].filter(item=>{const key=skillKey(item.name);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,12);}
