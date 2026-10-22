import "server-only";
import {sql} from "drizzle-orm";
import { unstable_cache } from "next/cache";
import {withUser,withVisitor} from "@/db/client";
export type TalentCard={id:string;name:string;major:string;bio:string|null;skills:string[]};
export type PublicTalent=TalentCard&{level:string;total:string|null;links:Array<{kind:string;label:string;value:string}>;organizations:Array<{id:string;name:string;slug:string;archived:boolean;hours:string|null;memberships:Array<{start_date:string;end_date:string|null;status_code:string;roles:Array<{code:string;starts:string;ends:string|null}>}>}>;events:Array<{id:string;title:string;starts_at:string;organization:string;archived:boolean;attendance:string|null;contributions:Array<{kind:string;title:string}>}>;projects:Array<{id:string;title:string;description:string;featured:boolean}>};
export type TalentWorkspace={status:string|null;onboarded:boolean;bio:string;settings:{public_profile_enabled:boolean};links:Array<{id:string;link_type:string;label:string;url_or_value:string;is_public:boolean}>;skills:Array<{name:string;public:boolean}>;projects:Array<{id:string;task_participant_id:string|null;event_contribution_id:string|null;display_title:string;display_description:string;is_featured:boolean}>;sources:Array<{id:string;kind:string;title:string}>};
export type TalentPages={organizations:number;events:number;projects:number;sources:number};
async function readTalentDirectory(q:string,skill:string|null,page:number){
 return withVisitor(async tx=>await tx.execute(sql`select * from lub.talent_directory(${q},${skill},${page*24})`) as unknown as TalentCard[]);
}
const readPopularTalent=unstable_cache(async()=>readTalentDirectory("",null,0),["public-talent-directory-first-page-v2"],{revalidate:30,tags:["public-talent"]});
export function talentDirectory(q:string,skill:string|null,page:number){
 // Cache only the common first page; free-text and skill filters bypass shared caching.
 if(!q&&!skill&&page===0)return readPopularTalent();
 return readTalentDirectory(q,skill,page);
}
class PublicTalentNotFound extends Error {}
async function queryPublicTalent(id:string,pages:TalentPages){return withVisitor(async tx=>{
 const rows=await tx.execute(sql`select lub.public_talent(${id},${pages.organizations*25},${pages.events*25},${pages.projects*25}) as profile`);
 return rows[0]?.profile as PublicTalent|null;
});}
const readPublicTalent=unstable_cache(async(id:string)=>{
 const profile=await queryPublicTalent(id,{organizations:0,events:0,projects:0,sources:0});
 // Do not retain missing or private profiles in shared cache keys.
 if(!profile)throw new PublicTalentNotFound();
 return profile;
},["public-talent-profile-first-page-v2"],{revalidate:30,tags:["public-talent"]});
export async function publicTalent(id:string,pages:TalentPages){
 if(pages.organizations||pages.events||pages.projects||pages.sources)return queryPublicTalent(id,pages);
 try{return await readPublicTalent(id);}
 catch(error){if(error instanceof PublicTalentNotFound)return null;throw error;}
}
export async function talentWorkspace(user:string,pages:TalentPages){return withUser(user,async tx=>{const rows=await tx.execute(sql`select lub.talent_workspace(${pages.projects*25},${pages.sources*25}) as workspace`);return rows[0]?.workspace as TalentWorkspace|null;});}
export function talentPages(s:Record<string,string|undefined>):TalentPages{const page=(key:string)=>Math.floor(Math.min(10000,Math.max(0,Number(s[key])||0)));return {organizations:page("organizations"),events:page("events"),projects:page("projects"),sources:page("sources")};}
