import "server-only";
import {sql} from "drizzle-orm";
import { unstable_cache } from "next/cache";
import {withUser,withVisitor} from "@/db/client";
export type TalentCard={id:string;name:string;major:string;bio:string;skills:string[]};
export type PublicTalent=TalentCard&{level:string;total:string|null;links:Array<{kind:string;label:string;value:string}>;organizations:Array<{id:string;name:string;slug:string;archived:boolean;hours:string|null;memberships:Array<{start_date:string;end_date:string|null;status_code:string;roles:Array<{code:string;starts:string;ends:string|null}>}>}>;events:Array<{id:string;title:string;starts_at:string;organization:string;archived:boolean;contributions:Array<{kind:string;title:string}>}>;projects:Array<{id:string;title:string;description:string;featured:boolean}>};
export type TalentWorkspace={status:string|null;onboarded:boolean;bio:string;settings:{public_profile_enabled:boolean;show_total_hours:boolean;show_role_history:boolean;show_events:boolean;show_projects:boolean};links:Array<{id:string;link_type:string;label:string;url_or_value:string;is_public:boolean}>;skills:Array<{name:string;public:boolean}>;projects:Array<{id:string;task_participant_id:string|null;event_contribution_id:string|null;display_title:string;display_description:string;is_public:boolean;is_featured:boolean}>;sources:Array<{id:string;kind:string;title:string}>;organizations:Array<{id:string;name:string;hours:boolean;history:boolean}>;events:Array<{id:string;title:string;visible:boolean;contributions:Array<{id:string;title:string;visible:boolean}>}>};
export type TalentPages={organizations:number;events:number;projects:number;sources:number};
const readTalentDirectory = unstable_cache(async (q:string,skill:string|null,page:number) =>
  withVisitor(async tx => await tx.execute(sql`select * from lub.talent_directory(${q},${skill},${page*24})`) as unknown as TalentCard[]),
  ["public-talent-directory-v1"],
  {revalidate:30,tags:["public-talent"]}
);
export function talentDirectory(q:string,skill:string|null,page:number){return readTalentDirectory(q,skill,page);}
export async function publicTalent(id:string,pages:TalentPages){return withVisitor(async tx=>{const rows=await tx.execute(sql`select lub.public_talent(${id},${pages.organizations*25},${pages.events*25},${pages.projects*25}) as profile`);return rows[0]?.profile as PublicTalent|null;});}
export async function talentWorkspace(user:string,pages:TalentPages){return withUser(user,async tx=>{const rows=await tx.execute(sql`select lub.talent_workspace(${pages.organizations*25},${pages.events*25},${pages.projects*25},${pages.sources*25}) as workspace`);return rows[0]?.workspace as TalentWorkspace|null;});}
export function talentPages(s:Record<string,string|undefined>):TalentPages{const page=(key:string)=>Math.floor(Math.min(10000,Math.max(0,Number(s[key])||0)));return {organizations:page("organizations"),events:page("events"),projects:page("projects"),sources:page("sources")};}
