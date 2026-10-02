import "server-only";
import { sql } from "drizzle-orm";
import { withUser, withVisitor } from "@/db/client";
import { unstable_cache } from "next/cache";
import type { FormDefinition, Answers } from "./definition";

export const capabilities = { FORMS_MANAGE: "إدارة النماذج", REGISTRATION_ROUNDS_MANAGE: "إدارة جولات التسجيل", APPLICATIONS_VIEW: "عرض الطلبات", APPLICATIONS_REVIEW: "مراجعة الطلبات", APPLICATIONS_BULK_ACTION: "إجراءات جماعية", PERMISSIONS_GRANT: "تفويض الصلاحيات" } as const;
export const statuses: Record<string, string> = { Draft: "مسودة", Published: "منشور", Open: "مفتوحة", Closed: "مغلقة", Archived: "مؤرشفة", Submitted: "قيد المراجعة", Interview: "مقابلة", Accepted: "مقبول", Rejected: "مرفوض", Withdrawn: "منسحب" };
export type Template = { id: string; name: string; organization_id: string | null; versions: Version[] };
export type Version = { id: string; version_number: number; status_code: string; revision: number; definition: FormDefinition };
export type Round = { id: string; title: string; status_code: string; opens_at: string; closes_at: string; form_template_id: string; allow_withdrawal: boolean; open: boolean };
export type Application = { id: string; status_code: string; created_at: string; title: string; round_id: string; slug: string; name: string; major: string; level: string; committee: string | null; canReview: boolean; canBulk: boolean };
export type Detail = { id: string; organization_id:string; canStaff:boolean; status_code: string; version: Version; response_revision: number; answers: Answers; requested_committee_id: string | null; messages: Array<{ body: string; created_at: string }>; notes: Array<{ body: string; created_at: string }>; history: Array<{ to_status_code: string; created_at: string; reason: string | null }>; canReview: boolean };
type Readiness={accountStatus:string|null;onboarded:boolean};
type Workspace = Readiness & { name: string; allowed: string[]; templates: Template[]; rounds: Round[]; members: Array<{ id: string; name: string; grants:Array<{id:string;code:keyof typeof capabilities;committee:string|null;ends:string|null}> }>; committees: Array<{ id: string; name: string }> };
const detailColumns=sql`a.id,r.organization_id,a.status_code,a.requested_committee_id,f.answers,f.revision as response_revision,to_jsonb(v) as version,
 lub.can_read_application(a.id,'APPLICATIONS_REVIEW') as "canReview",
 (lub.can_read_application(a.id,'APPLICATIONS_REVIEW') or lub.has_org_permission(r.organization_id,'APPLICATIONS_VIEW',a.requested_committee_id) or lub.has_org_permission(r.organization_id,'APPLICATIONS_VIEW') or lub.can_read_application(a.id,'APPLICATIONS_BULK_ACTION')) as "canStaff",
 coalesce((select jsonb_agg(m order by m.created_at) from lub.application_messages m where m.application_id=a.id),'[]') as messages,
 coalesce((select jsonb_agg(n order by n.created_at) from lub.application_internal_notes n where n.application_id=a.id),'[]') as notes,
 coalesce((select jsonb_agg(jsonb_build_object('to_status_code',h.to_status_code,'created_at',h.created_at,'reason',h.reason) order by h.created_at,h.id) from lub.application_status_history h where h.application_id=a.id),'[]') as history`;
export async function getWorkspace(user: string, org: string, selected: string | null = null) {
 return withUser(user, async tx => {
  const rows = await tx.execute(sql`select o.name_ar as name,(select status_code from lub.users where id=${user}) as "accountStatus",exists(select 1 from lub.student_profiles where user_id=${user}) as onboarded,
   (select coalesce(jsonb_agg(c),'[]') from unnest(array['FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT']) c where lub.has_org_permission(o.id,c) or exists(select 1 from lub.committees cc where cc.organization_id=o.id and lub.has_org_permission(o.id,c,cc.id))) as allowed,
   coalesce((select jsonb_agg(t) from (select t.id,t.name,t.organization_id,coalesce((select jsonb_agg(case when t.id=${selected}::uuid then to_jsonb(v) else to_jsonb(v)-'definition' end order by v.version_number desc) from (select * from lub.form_versions vv where vv.form_template_id=t.id order by vv.version_number desc limit 2) v),'[]') as versions from lub.form_templates t where t.organization_id=o.id or t.is_system_template order by t.created_at desc limit 100) t),'[]') as templates,
   coalesce((select jsonb_agg(r) from (select r.*,lub.round_is_open(r.id) as open from lub.registration_rounds r where r.organization_id=o.id order by r.created_at desc limit 100) r),'[]') as rounds,
   case when lub.has_org_permission(o.id,'PERMISSIONS_GRANT') then lub.application_grant_members(o.id) else '[]'::jsonb end as members,
   coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from lub.committees c where c.organization_id=o.id and c.status_code='Active'),'[]') as committees
   from lub.organizations o where o.id=${org}`);
  return rows[0] as unknown as Workspace | undefined;
 });
}
export const publicRounds = unstable_cache(async (org: string) => withVisitor(async tx => {
 const rows = await tx.execute(sql`select id,title,status_code,opens_at,closes_at,form_template_id,allow_withdrawal,lub.round_is_open(id) as open from lub.registration_rounds where organization_id=${org} order by opens_at desc limit 50`);
 return rows as unknown as Round[];
}), ["public-rounds"], { revalidate: 30, tags: ["public-organizations"] });

export async function getRound(round: string, user?: string) {
 const read = async (tx: import("@/db/client").Transaction) => {
  const rows = await tx.execute(sql`select r.*,o.slug,o.name_ar as name,lub.round_is_open(r.id) as open,
   ${user?sql`(select status_code from lub.users where id=${user})`:sql`null`} as "accountStatus",
   ${user?sql`exists(select 1 from lub.student_profiles where user_id=${user})`:sql`false`} as onboarded,
   ${user?sql`(select to_jsonb(d) from (select ${detailColumns} from lub.membership_applications a join lub.registration_rounds r on r.id=a.registration_round_id join lub.form_responses f on f.id=a.form_response_id join lub.form_versions v on v.id=f.form_version_id where a.registration_round_id=${round} and a.applicant_user_id=${user} limit 1) d)`:sql`null`} as application,
   (select to_jsonb(v) from lub.form_versions v where v.form_template_id=r.form_template_id and v.status_code='Published' order by v.version_number desc limit 1) as version,
   coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from lub.committees c where c.organization_id=r.organization_id and c.is_public and c.status_code='Active'),'[]') as committees from lub.registration_rounds r join lub.organizations o on o.id=r.organization_id where r.id=${round}`);
  return rows[0] as unknown as (Readiness & Round & { application:Detail|null;slug: string; name: string; version: Version; committees: Array<{ id: string; name: string }> }) | undefined;
 };
 return user ? withUser(user, read) : withVisitor(read);
}
export async function getApplicationDetail(user: string, application: string) {
 return withUser(user, async tx => {
  const rows = await tx.execute(sql`select ${detailColumns} from lub.membership_applications a join lub.registration_rounds r on r.id=a.registration_round_id join lub.form_responses f on f.id=a.form_response_id join lub.form_versions v on v.id=f.form_version_id where a.id=${application}`);
  return rows[0] as unknown as Detail | undefined;
 });
}
export async function ownApplication(user: string, round: string) {
 return withUser(user, async tx => { const rows = await tx.execute(sql`select id from lub.membership_applications where applicant_user_id=${user} and registration_round_id=${round}`); return rows[0]?.id as string | undefined; });
}
export type Filters = { q: string; status: string; committee: string; major: string; level: string; from: string; to: string; page: number; lookup: string; activity?: string };
export async function listApplications(user: string, org?: string, filters?: Filters) {
 return withUser(user, async tx => {
  const rows = await tx.execute(sql`select a.id,a.status_code,a.created_at,r.title,r.id as round_id,o.slug,p.full_name as name,p.major,p.level,c.name as committee,
   lub.can_read_application(a.id,'APPLICATIONS_REVIEW') as "canReview",lub.can_read_application(a.id,'APPLICATIONS_BULK_ACTION') as "canBulk"
   from lub.membership_applications a join lub.registration_rounds r on r.id=a.registration_round_id join lub.organizations o on o.id=r.organization_id
   join lateral lub.application_profiles(o.id) p on p.application_id=a.id left join lub.committees c on c.id=a.requested_committee_id
   where ${org ? sql`o.id=${org}` : sql`a.applicant_user_id=${user}`}
   and ${org ? sql`(lub.has_org_permission(r.organization_id,'APPLICATIONS_VIEW') or lub.has_org_permission(r.organization_id,'APPLICATIONS_VIEW',a.requested_committee_id) or lub.can_read_application(a.id,'APPLICATIONS_REVIEW') or lub.can_read_application(a.id,'APPLICATIONS_BULK_ACTION'))` : sql`true`}
   and (${filters?.q ?? ""}='' or position(lower(${filters?.q ?? ""}) in lower(p.full_name))>0)
   and (${filters?.status ?? ""}='' or a.status_code=${filters?.status ?? ""})
   and (${filters?.committee ?? ""}='' or a.requested_committee_id::text=${filters?.committee ?? ""})
   and (${filters?.major ?? ""}='' or p.major=${filters?.major ?? ""}) and (${filters?.level ?? ""}='' or p.level=${filters?.level ?? ""})
   and (${filters?.lookup ?? ""}='' or p.university_lookup=${filters?.lookup ?? ""})
   and (${filters?.from ?? ""}='' or a.created_at>=nullif(${filters?.from ?? ""},'')::date)
   and (${filters?.to ?? ""}='' or a.created_at<nullif(${filters?.to ?? ""},'')::date+interval '1 day')
   and (${filters?.activity ?? ""}='' or (${filters?.activity ?? ""}='prior' and exists(select 1 from lub.application_prior_member(a.id))) or (${filters?.activity ?? ""}='first' and not exists(select 1 from lub.application_prior_member(a.id))))
   order by a.created_at desc,a.id limit 26 offset ${((filters?.page ?? 1)-1)*25}`);
  return rows as unknown as Application[];
 });
}
