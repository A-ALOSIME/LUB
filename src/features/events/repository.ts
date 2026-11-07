import "server-only";
import {sql} from "drizzle-orm";
import {unstable_cache} from "next/cache";
import {withUser,withVisitor,type Transaction} from "@/db/client";
import type {FormDefinition,Answers} from "@/features/forms/definition";
import type {ProfileSkill} from "@/features/talent/profile-skills-model";
export type Event={source_date_text?:string|null;skills?:ProfileSkill[];id:string;organization_id:string;title:string;title_en?:string|null;description:string;description_en?:string|null;location_type_code:string;location_text:string|null;online_url:string|null;starts_at:string;ends_at:string;registration_opens_at:string;registration_closes_at:string;capacity:number|null;attendance_hours:string;status_code:string;is_featured:boolean;public_report:string;public_photos:string[];revision:number;registration_form_template_id:string|null;has_poster?:boolean;requires_approval?:boolean};
export type EventCard=Event&{org_name:string;org_name_en?:string|null;org_type_code:string;org_logo_url:string;slug:string;open:boolean;remaining:number|null};
async function readEvents(q:string,period:string,page:number,org:string|null=null,onlyOpen=false){return withVisitor(async tx=>{
 const rows=await tx.execute(sql`select * from lub.event_catalog(${q},${period},${page},${org}::uuid,${onlyOpen})`);return rows as unknown as EventCard[];
});}
const readPopularEvents=unstable_cache(async(period:string)=>readEvents("",period,0,null,false),["public-events-first-page-v5"],{revalidate:30,tags:["events"]});
export function listEvents(q:string,period:string,page:number,org:string|null=null,onlyOpen=false){
 // Search, organization filters, open-only views, and deep pages bypass shared caching.
 if(!q&&!org&&!onlyOpen&&page===0&&["upcoming","past","all"].includes(period))return readPopularEvents(period);
 return readEvents(q,period,page,org,onlyOpen);
}
export type EventDetail={canFeature?:boolean;committees?:Array<{id:string;name:string}>;event:Event;org_name:string;org_name_en?:string|null;org_logo:string|null;org_type_code:string;slug:string;status:string|null;onboarded:boolean;open:boolean;remaining:number|null;own:{id:string;status_code:string;attendance:string|null;response_revision:number|null;review_status_code?:string;review_note?:string;answers:Answers;version:string|null}|null;form:{id:string;definition:FormDefinition}|null;canManage:boolean;canAttend:boolean;registrations:Array<{id:string;user_id:string;name:string;status_code:string;attendance:string;answers:Answers|null;definition:FormDefinition|null}>;assets:Array<{id:string;file_name:string;asset_type_code:string}>};
export type PublicEventMetadata={id:string;title:string;title_en?:string|null;description:string;description_en?:string|null;status_code:string;org_name:string;org_name_en?:string|null;slug:string};
class PublicEventNotFound extends Error {}
async function readEvent(user:string|null,id:string){
 const read=async(tx:Transaction)=>{
  const [row]=await tx.execute<{detail:EventDetail|null}>(sql`select lub.event_page(${id}) as detail`);
  return row?.detail??undefined;
 };
 return user?withUser(user,read):withVisitor(read);
}
const readPublicEventDetail=unstable_cache(async(id:string)=>{
 const detail=await readEvent(null,id);
 if(!detail)throw new PublicEventNotFound();
 return detail;
},["public-event-detail-v5"],{revalidate:15,tags:["events"]});
export async function publicEventMetadata(id:string):Promise<PublicEventMetadata|undefined>{
 const detail=await eventDetail(null,id);
 if(detail) {
  const {id,title,title_en,description,description_en,status_code}=detail.event;
  return {id,title,title_en,description,description_en,status_code,org_name:detail.org_name,org_name_en:detail.org_name_en,slug:detail.slug};
 }
}
type MyEvents = {status:string|null;onboarded:boolean;events:Array<{id:string;registration_id:string;attendance_hours:string;canWithdraw:boolean;canReapply:boolean;title:string;starts_at:string;status_code:string;org_name?:string;has_poster?:boolean;registration:string;review_status?:string;attendance:string}>};
export async function myEvents(user:string,page:number|null,filters:{q?:string;status?:string;sort?:"asc"|"desc"}={}) {
 return withUser(user,async tx=>{
  const [row]=await tx.execute<{data:MyEvents|null}>(sql`select lub.my_event_registrations(${filters.q??""},${filters.status??"all"},${filters.sort==="asc"},${page}) as data`);
  return row?.data??{status:null,onboarded:false,events:[]};
 });
}
export async function eventDetail(user:string|null,id:string){
 if(user)return readEvent(user,id);
 try{return await readPublicEventDetail(id);}catch(error){if(error instanceof PublicEventNotFound)return undefined;throw error;}
}
