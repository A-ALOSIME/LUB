"use server";
import {z} from "zod";
import {sql} from "drizzle-orm";
import {requireStudentUser} from "@/features/auth/authorization";
import {withUser} from "@/db/client";
import {searchEscoSkills,mergeSkillSuggestions,type SkillSuggestion} from "./esco";
export async function suggestTalentSkills(query:string,locale:"ar"|"en"="ar"){
 const user=await requireStudentUser();const q=z.string().trim().min(2).max(80).safeParse(query);if(!q.success)return [];
 const local=await withUser(user.id,async tx=>(await tx.execute(sql`select coalesce(s.name_en,s.name_ar) as name,s.name_ar as label from lub.skills s where s.is_active and position(lub.arabic_search_key(${q.data}) in lub.arabic_search_key(s.name_ar||' '||coalesce(s.name_en,'')||' '||s.aliases::text))>0 order by (lub.skill_key(s.name_ar)=lub.skill_key(${q.data})) desc,s.name_ar limit 12`)) as unknown as SkillSuggestion[]);
 // An upstream timeout never prevents choosing a local skill or adding a custom one.
 let external:SkillSuggestion[]=[];try{external=await searchEscoSkills(q.data,locale==="en"?"en":"ar");}catch{}
 return mergeSkillSuggestions(local,external);
}
