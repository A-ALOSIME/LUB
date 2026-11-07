import "server-only";
import { sql } from "drizzle-orm";
import { withUser, withVisitor } from "@/db/client";
import type { FormDefinition, Answers } from "./definition";

export const capabilities = { FORMS_MANAGE: "إدارة النماذج", REGISTRATION_ROUNDS_MANAGE: "إدارة جولات التسجيل", APPLICATIONS_VIEW: "عرض الطلبات", APPLICATIONS_REVIEW: "مراجعة الطلبات", APPLICATIONS_BULK_ACTION: "إجراءات جماعية" } as const;
export const statuses: Record<string, string> = { Draft: "مسودة", Published: "منشور", Open: "مفتوحة", Closed: "مغلقة", Archived: "مؤرشفة", Submitted: "قيد المراجعة", Interview: "مقابلة", Accepted: "مقبول", Rejected: "مرفوض", Withdrawn: "منسحب" };
export type Template = { id: string; name: string; organization_id: string | null; version_count?: number;updated_at?:string;round_count?:number;event_count?:number;can_delete?:boolean; versions: Version[] };
export type Version = { id: string; version_number: number; status_code: string; revision: number; definition: FormDefinition };
export type Round = { minimum_approved_hours?:string|number;allowed_majors?:string[]; id: string; title: string; status_code: string; opens_at: string; closes_at: string; form_template_id: string; allow_withdrawal: boolean; open: boolean; application_count?:number };
export type Application = { id: string; status_code: string; created_at: string; title: string; round_id: string; slug: string; organization_name: string; name: string; major: string; level: string; committee: string | null; round_open: boolean; allow_withdrawal: boolean; has_active_application: boolean; has_newer_application: boolean; canReview: boolean; canBulk: boolean };
export type Detail = { id: string; organization_id:string; canStaff:boolean; status_code: string; version: Version; response_revision: number; answers: Answers; requested_committee_id: string | null; committee_labels?:{legacy:string|null;answers:Record<string,string>}; history: Array<{ to_status_code: string; created_at: string; reason: string | null }>; canReview: boolean };
type Readiness={accountStatus:string|null;onboarded:boolean};
export type OrganizationRegistrationWorkspace = Readiness & { name: string; allowed: string[]; templates: Template[]; template_count?:number;rounds: Round[]; committees: Array<{ id: string; name: string }> };
export async function getWorkspace(user: string, org: string, selected: string | null = null) {
 return withUser(user, async tx => {
  const [row]=await tx.execute<{data:OrganizationRegistrationWorkspace|null}>(sql`
   select lub.registration_management_page(${org},${selected}) as data
  `);
  return row?.data??undefined;
 });
}
export async function publicRounds(org:string) {
 return withVisitor(async tx=>{
  const [row]=await tx.execute<{data:Round|null}>(sql`select lub.public_registration_round(${org}) as data`);
  return row?.data?[row.data]:[];
 });
}
type RegistrationRoundPage=Readiness&Round&{organization_id:string;application:Detail|null;slug:string;name:string;version:Version|null;committees:Array<{id:string;name:string}>;canReapply:boolean};
export async function getRound(round:string,user?:string) {
 const read=async(tx:import("@/db/client").Transaction)=>{
  const [row]=await tx.execute<{data:RegistrationRoundPage|null}>(sql`select lub.registration_round_page(${round}) as data`);
  return row?.data??undefined;
 };
 return user?withUser(user,read):withVisitor(read);
}
export async function getApplicationDetail(user:string,application:string){return withUser(user,async tx=>{const rows=await tx.execute<{detail:Detail&{campaign_title:string;created_at:string}|null}>(sql`select lub.application_detail(${application},false) detail`);return rows[0]?.detail??undefined;});}
export async function ownApplication(user: string, round: string) {
 return withUser(user,async tx=>{
  const [row]=await tx.execute<{id:string}>(sql`
   select id from lub.membership_cases where kind='Registration' and user_id=auth.uid() and campaign_id=${round}
   order by submitted_at desc,id desc limit 1
  `);
  return row?.id;
 });
}
export type Filters = { q: string; status: string; committee: string; major: string; level: string; from: string; to: string; page: number; lookup: string; activity?: string;round?:string };
export type OrganizationApplicationStatusCounts = { all: number; submitted: number; accepted: number; rejected: number; interview: number;withdrawn?:number };
type ApplicationPage={items:Application[];counts:OrganizationApplicationStatusCounts};
async function readApplications(user:string,org:string|null,filters:Filters|null,pageSize:number){
 return withUser(user,async tx=>{
  const [row]=await tx.execute<{data:ApplicationPage}>(sql`
   select lub.application_list(${org},${JSON.stringify(filters??{})}::jsonb,${((filters?.page??1)-1)*25},${pageSize}) as data
  `);
  return row.data;
 });
}
export async function countOrganizationApplicationStatuses(user:string,org:string,filters:Filters){
 return (await readApplications(user,org,filters,0)).counts;
}
export type OwnApplicationCounts={all:number;review:number;accepted:number;rejected:number;withdrawn:number;interview?:number};
export async function countOwnApplications(user:string):Promise<OwnApplicationCounts>{
 const {counts}=await readApplications(user,null,null,0);
 return {all:counts.all,review:counts.submitted,interview:counts.interview,accepted:counts.accepted,rejected:counts.rejected,withdrawn:counts.withdrawn??0};
}
export async function listApplications(user:string,org?:string,filters?:Filters){
 return (await readApplications(user,org??null,filters??null,26)).items;
}

export async function getOwnApplicationDetail(user:string,application:string){return withUser(user,async tx=>{const rows=await tx.execute<{detail:(Detail&{campaign_title:string;created_at:string})|null}>(sql`select lub.application_detail(${application},true) detail`);return rows[0]?.detail??undefined;});}

export type RegistrationReadiness={active:boolean;onboarded:boolean;hours:number;major:string|null;member:boolean;canReapply?:boolean;application:{id:string;status_code:string}|null};
export async function registrationReadiness(user:string,organization:string,round:string|null):Promise<RegistrationReadiness>{
 return withUser(user,async tx=>{
  const [row]=await tx.execute<{data:RegistrationReadiness|null}>(sql`select lub.registration_readiness(${organization},${round}) as data`);
  return row?.data??{active:false,onboarded:false,hours:0,major:null,member:false,application:null};
 });
}
export async function managedRound(user:string,org:string,id:string){
 return withUser(user,async tx=>{
  const [row]=await tx.execute<{data:Round|null}>(sql`select lub.managed_registration_round(${org},${id}) as data`);
  return row?.data??undefined;
 });
}

export async function organizationApplicationPage(user:string,org:string,filters:Filters){
 const {items,counts}=await readApplications(user,org,filters,26);
 return {items:items.slice(0,25),counts,more:items.length>25};
}
