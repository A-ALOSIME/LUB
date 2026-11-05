import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
export type AccountReadiness={status:string|null;onboarded:boolean};
export type Term={id:string;name_ar:string;academic_year:string;term_code:string;start_date:string;end_date:string};
export type HourRecord={id:string;organization_id:string;organization_membership_id:string;committee_id:string|null;academic_term_id:string;hours:string;activity_date:string;description:string;status_code:string;source_code:string;created_at:string;owner:string|null;org_name:string;term_name:string;canReview:boolean;canWithdraw?:boolean;context?:{major:string;level:string;committee_name:string|null;added_by:string|null};adjustments?:Array<{before_hours:string;after_hours:string;actor_name:string;note:string;created_at:string}>;decisions:Array<{status_code:string;note:string;created_at:string}>};
export type HourScope={id:string|null;name:string;approve:boolean;manual:boolean};
export type HoursStatusTotals={approved:string;pending:string;rejected:string;approvedCount?:number;pendingCount?:number;rejectedCount?:number};
export type HoursData={isTest?:boolean;account:AccountReadiness;terms:Term[];records:HourRecord[];total:string;hoursByStatus:HoursStatusTotals;byOrg:Array<{name:string;total:string}>;memberships:Array<{id:string;org:string;name:string;self:boolean;committees:Array<{id:string;name:string}>}>};
export type HoursExportScope={id:string|null;name:string};
export type HoursExportWorkspace={account:AccountReadiness;name:string;scopes:HoursExportScope[];terms:Term[]};
export type HoursWorkspace={account:AccountReadiness;name:string;selfEnabled:boolean;canPolicy:boolean;exportScopes:HoursExportScope[];scopes:HourScope[];terms:Term[];members:Array<{id:string;name:string}>;records:HourRecord[];total:string;hoursByStatus:HoursStatusTotals;filteredTotal?:string;filteredCount?:number;imports:Array<{id:string;name:string}>};
const account=sql`jsonb_build_object('status',u.status_code,'onboarded',exists(select 1 from lub.student_profiles where user_id=u.id))`;
const terms=sql`coalesce((select jsonb_agg(t order by t.start_date desc) from (select * from lub.academic_terms order by start_date desc limit 100) t),'[]')`;
function recordRows(org:string|null,term:string|null,page:number|null,mine:string|null,committee:string|null=null,status:string|null=null,q="",detailId:string|null=null){return sql`coalesce((select jsonb_agg(x order by x.created_at desc,x.id) from (
 select h.*,o.name_ar as org_name,t.name_ar as term_name,lub.hour_owner_name(h.id) as owner,lub.can_approve_hours(h.organization_id,h.committee_id) as "canReview",(h.source_code='SELF_REPORTED' and h.status_code='Pending' and exists(select 1 from lub.organization_memberships own where own.id=h.organization_membership_id and own.user_id=auth.uid())) as "canWithdraw",lub.hour_record_context(h.id) as context,
 case when ${detailId}::uuid is not null then coalesce((select jsonb_agg(jsonb_build_object('before_hours',a.before_hours,'after_hours',a.after_hours,'actor_name',a.actor_name,'note',a.note,'created_at',a.created_at) order by a.created_at,a.id) from (select * from lub.hour_adjustments aa where aa.hour_record_id=h.id order by aa.created_at desc,aa.id desc limit 100) a),'[]') else '[]'::jsonb end as adjustments,
 case when ${detailId}::uuid is not null then coalesce((select jsonb_agg(d order by d.created_at,d.id) from (select id,status_code,note,created_at from lub.hour_decisions where hour_record_id=h.id order by created_at,id limit 3) d),'[]') else '[]'::jsonb end as decisions
 from lub.hour_records h join lub.organizations o on o.id=h.organization_id join lub.academic_terms t on t.id=h.academic_term_id
 where (${detailId}::uuid is null or h.id=${detailId}::uuid) and (${org}::uuid is null or h.organization_id=${org}::uuid) and (${term}::uuid is null or h.academic_term_id=${term}::uuid) and (${committee}::uuid is null or h.committee_id=${committee}::uuid)
 and (${q}='' or position(lub.arabic_search_key(${q}) in lub.arabic_search_key(case when ${mine}::uuid is null then coalesce(lub.hour_owner_name(h.id),'') else o.name_ar||' '||h.description end))>0)
 and (${mine}::uuid is null or h.organization_membership_id in (select id from lub.organization_memberships where user_id=${mine}::uuid)) and (${status}::text is null or h.status_code=${status}::text)
 order by h.created_at desc,h.id limit ${page===null?51:26} offset ${(page??0)*25}) x),'[]')`;}
export async function myHours(user:string,term:string|null,page:number|null,status:string|null=null,q=""){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select u.is_test as "isTest",${account} as account,${terms} as terms,${recordRows(null,term,page,user,null,status,q)} as records,
 coalesce((select sum(h.hours) from lub.hour_records h where lub.is_counted_student(${user}) and h.status_code='Approved' and (${term}::uuid is null or h.academic_term_id=${term}::uuid) and (${q}='' or exists(select 1 from lub.organizations searched_org where searched_org.id=h.organization_id and position(lub.arabic_search_key(${q}) in lub.arabic_search_key(searched_org.name_ar||' '||h.description))>0)) and h.organization_membership_id in (select id from lub.organization_memberships where user_id=${user})) ,0)::text as total,
 (select jsonb_build_object(
   'approved',coalesce(sum(h.hours) filter (where lub.is_counted_student(${user}) and h.status_code='Approved'),0)::text,
   'pending',coalesce(sum(h.hours) filter (where h.status_code='Pending'),0)::text,
   'rejected',coalesce(sum(h.hours) filter (where h.status_code='Rejected'),0)::text,
   'approvedCount',count(*) filter (where lub.is_counted_student(${user}) and h.status_code='Approved'), 'pendingCount',count(*) filter (where h.status_code='Pending'), 'rejectedCount',count(*) filter (where h.status_code='Rejected')
  ) from lub.hour_records h where lub.is_counted_student(${user}) and (${term}::uuid is null or h.academic_term_id=${term}::uuid) and (${q}='' or exists(select 1 from lub.organizations searched_org where searched_org.id=h.organization_id and position(lub.arabic_search_key(${q}) in lub.arabic_search_key(searched_org.name_ar||' '||h.description))>0)) and h.organization_membership_id in (select id from lub.organization_memberships where user_id=${user})) as "hoursByStatus",
 coalesce((select jsonb_agg(x) from (select o.name_ar as name,sum(h.hours)::text as total from lub.hour_records h join lub.organizations o on o.id=h.organization_id where lub.is_counted_student(${user}) and h.status_code='Approved' and (${term}::uuid is null or h.academic_term_id=${term}::uuid) and (${q}='' or exists(select 1 from lub.organizations searched_org where searched_org.id=h.organization_id and position(lub.arabic_search_key(${q}) in lub.arabic_search_key(searched_org.name_ar||' '||h.description))>0)) and h.organization_membership_id in (select id from lub.organization_memberships where user_id=${user}) group by o.id,o.name_ar order by o.name_ar limit 100) x),'[]') as "byOrg",
 coalesce((select jsonb_agg(x) from (select m.id,o.id as org,o.name_ar as name,o.self_report_hours_enabled as self,coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from lub.committee_memberships cm join lub.committees c on c.id=cm.committee_id where cm.organization_membership_id=m.id and cm.status_code='Active' and cm.start_date<=current_date and (cm.end_date is null or cm.end_date>current_date) and c.status_code='Active'),'[]') as committees from lub.organization_memberships m join lub.organizations o on o.id=m.organization_id where m.user_id=${user} and m.status_code='Active' and m.start_date<=current_date and (m.end_date is null or m.end_date>current_date) and o.status_code='Active' order by o.name_ar limit 100) x),'[]') as memberships
 from lub.users u where u.id=${user}`);return rows[0] as unknown as HoursData|undefined;
});}
export async function hoursWorkspace(user:string,org:string,options:{term:string|null;committee:string|null;status?:string|null;q?:string;page:number;memberPage:number}){return withUser(user,async tx=>{
 const {term,committee,status=null,q="",page,memberPage}=options;
 const rows=await tx.execute(sql`with scoped_summary as materialized (select lub.hours_summary(${org}::uuid,${committee}::uuid,${term}::uuid,${status}::text,${q}) as value) select ${account} as account,o.name_ar as name,o.self_report_hours_enabled as "selfEnabled",lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE') as "canPolicy",${terms} as terms,coalesce((select jsonb_agg(x order by x.name) from (select null::uuid as id,'الجهة بالكامل'::text as name where lub.has_org_permission(o.id,'REPORTS_GENERATE') union all select c.id,c.name from lub.committees c where c.organization_id=o.id and c.status_code='Active' and lub.has_org_permission(o.id,'REPORTS_GENERATE',c.id)) x),'[]') as "exportScopes",
 coalesce((select jsonb_agg(s) from (select null::uuid as id,'الجهة بالكامل' as name,lub.has_org_permission(o.id,'HOURS_APPROVE') as approve,lub.has_org_permission(o.id,'HOURS_MANUAL_ADD') as manual union all select c.id,c.name,lub.has_org_permission(o.id,'HOURS_APPROVE',c.id),lub.has_org_permission(o.id,'HOURS_MANUAL_ADD',c.id) from lub.committees c where c.organization_id=o.id and c.status_code='Active') s where s.approve or s.manual),'[]') as scopes,
 coalesce((select jsonb_agg(m) from lub.hour_members(o.id,${committee}::uuid,${memberPage*25}) m),'[]') as members,
 ${recordRows(org,term,page,null,committee,status,q)} as records,
 summary.value->'hoursByStatus' as "hoursByStatus",summary.value->>'total' as total,summary.value->>'filteredTotal' as "filteredTotal",(summary.value->>'filteredCount')::int as "filteredCount",
 coalesce((select jsonb_agg(x) from lub.hour_import_candidates(o.id) x),'[]') as imports
 from lub.users u join lub.organizations o on o.id=${org} cross join scoped_summary summary where u.id=${user} and lub.has_hours_access(o.id)`);
 return rows[0] as unknown as HoursWorkspace|undefined;
});}
export async function hoursExportWorkspace(user:string,org:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select ${account} as account,o.name_ar as name,${terms} as terms,
 coalesce((select jsonb_agg(x order by x.name) from (select null::uuid as id,'الجهة بالكامل'::text as name where lub.has_org_permission(o.id,'REPORTS_GENERATE') union all select c.id,c.name from lub.committees c where c.organization_id=o.id and c.status_code='Active' and lub.has_org_permission(o.id,'REPORTS_GENERATE',c.id)) x),'[]') as scopes
 from lub.users u join lub.organizations o on o.id=${org} where u.id=${user} and lub.has_hours_export_access(o.id)`);
 return rows[0] as unknown as HoursExportWorkspace|undefined;
});}
export async function termWorkspace(user:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select ${account} as account,lub.is_super_admin() as "canManage",${terms} as terms from lub.users u where u.id=${user}`);
 return rows[0] as unknown as {account:AccountReadiness;canManage:boolean;terms:Term[]}|undefined;
});}

export async function getHourRecord(user:string,id:string){return withUser(user,async tx=>{const rows=await tx.execute(sql`select ${recordRows(null,null,0,null,null,null,"",id)} as records`);return (rows[0]?.records as HourRecord[]|undefined)?.[0];});}
