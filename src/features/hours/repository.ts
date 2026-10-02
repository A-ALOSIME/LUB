import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
export type AccountReadiness={status:string|null;onboarded:boolean};
export type Term={id:string;name_ar:string;academic_year:string;term_code:string;start_date:string;end_date:string};
export type HourRecord={id:string;organization_id:string;organization_membership_id:string;committee_id:string|null;academic_term_id:string;hours:string;activity_date:string;description:string;status_code:string;source_code:string;created_at:string;owner:string|null;org_name:string;term_name:string;canReview:boolean;decisions:Array<{status_code:string;note:string;created_at:string}>};
export type HourRule={id:string;committee_id:string|null;task_template_id:string|null;name:string;default_hours:string;effective_from:string;effective_to:string|null;is_active:boolean;revision:number;canEdit:boolean};
export type HourScope={id:string|null;name:string;approve:boolean;manual:boolean;rules:boolean};
export type HoursData={account:AccountReadiness;terms:Term[];records:HourRecord[];total:string;byOrg:Array<{name:string;total:string}>;memberships:Array<{id:string;org:string;name:string;self:boolean;committees:Array<{id:string;name:string}>}>};
export type HoursWorkspace={account:AccountReadiness;name:string;selfEnabled:boolean;canPolicy:boolean;canGrant:boolean;scopes:HourScope[];terms:Term[];templates:Array<{id:string;name:string;committee_id:string|null}>;members:Array<{id:string;name:string}>;rules:HourRule[];records:HourRecord[];total:string;grants:Array<{id:string;name:string;permission_code:string;committee_id:string|null;end_at:string|null}>;imports:Array<{id:string;name:string}>};
const account=sql`jsonb_build_object('status',u.status_code,'onboarded',exists(select 1 from lub.student_profiles where user_id=u.id))`;
const terms=sql`coalesce((select jsonb_agg(t order by t.start_date desc) from (select * from lub.academic_terms order by start_date desc limit 100) t),'[]')`;
function recordRows(org:string|null,term:string|null,page:number,mine:string|null,committee:string|null=null){return sql`coalesce((select jsonb_agg(x order by x.created_at desc,x.id) from (
 select h.*,o.name_ar as org_name,t.name_ar as term_name,lub.hour_owner_name(h.id) as owner,lub.can_approve_hours(h.organization_id,h.committee_id) as "canReview",
 coalesce((select jsonb_agg(d order by d.created_at,d.id) from (select id,status_code,note,created_at from lub.hour_decisions where hour_record_id=h.id order by created_at,id limit 3) d),'[]') as decisions
 from lub.hour_records h join lub.organizations o on o.id=h.organization_id join lub.academic_terms t on t.id=h.academic_term_id
 where (${org}::uuid is null or h.organization_id=${org}::uuid) and (${term}::uuid is null or h.academic_term_id=${term}::uuid) and (${committee}::uuid is null or h.committee_id=${committee}::uuid)
 and (${mine}::uuid is null or h.organization_membership_id in (select id from lub.organization_memberships where user_id=${mine}::uuid))
 order by h.created_at desc,h.id limit 26 offset ${page*25}) x),'[]')`;}
export async function myHours(user:string,term:string|null,page:number){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select ${account} as account,${terms} as terms,${recordRows(null,term,page,user)} as records,
 coalesce((select sum(h.hours) from lub.hour_records h where h.status_code='Approved' and (${term}::uuid is null or h.academic_term_id=${term}::uuid) and h.organization_membership_id in (select id from lub.organization_memberships where user_id=${user})) ,0)::text as total,
 coalesce((select jsonb_agg(x) from (select o.name_ar as name,sum(h.hours)::text as total from lub.hour_records h join lub.organizations o on o.id=h.organization_id where h.status_code='Approved' and (${term}::uuid is null or h.academic_term_id=${term}::uuid) and h.organization_membership_id in (select id from lub.organization_memberships where user_id=${user}) group by o.id,o.name_ar order by o.name_ar limit 100) x),'[]') as "byOrg",
 coalesce((select jsonb_agg(x) from (select m.id,o.id as org,o.name_ar as name,o.self_report_hours_enabled as self,coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from lub.committee_memberships cm join lub.committees c on c.id=cm.committee_id where cm.organization_membership_id=m.id and cm.status_code='Active' and cm.start_date<=current_date and (cm.end_date is null or cm.end_date>current_date) and c.status_code='Active'),'[]') as committees from lub.organization_memberships m join lub.organizations o on o.id=m.organization_id where m.user_id=${user} and m.status_code='Active' and m.start_date<=current_date and (m.end_date is null or m.end_date>current_date) and o.status_code='Active' order by o.name_ar limit 100) x),'[]') as memberships
 from lub.users u where u.id=${user}`);return rows[0] as unknown as HoursData|undefined;
});}
export async function hoursWorkspace(user:string,org:string,options:{term:string|null;committee:string|null;page:number;memberPage:number;rulePage:number}){return withUser(user,async tx=>{
 const {term,committee,page,memberPage,rulePage}=options;
 const rows=await tx.execute(sql`select ${account} as account,o.name_ar as name,o.self_report_hours_enabled as "selfEnabled",lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE') as "canPolicy",lub.has_org_permission(o.id,'PERMISSIONS_GRANT') as "canGrant",${terms} as terms,coalesce((select jsonb_agg(t) from lub.hour_template_options(o.id) t),'[]') as templates,
 coalesce((select jsonb_agg(s) from (select null::uuid as id,'الجهة بالكامل' as name,lub.has_org_permission(o.id,'HOURS_APPROVE') as approve,lub.has_org_permission(o.id,'HOURS_MANUAL_ADD') as manual,lub.has_org_permission(o.id,'HOUR_RULES_MANAGE') as rules union all select c.id,c.name,lub.has_org_permission(o.id,'HOURS_APPROVE',c.id),lub.has_org_permission(o.id,'HOURS_MANUAL_ADD',c.id),lub.has_org_permission(o.id,'HOUR_RULES_MANAGE',c.id) from lub.committees c where c.organization_id=o.id and c.status_code='Active') s where s.approve or s.manual or s.rules),'[]') as scopes,
 coalesce((select jsonb_agg(m) from lub.hour_members(o.id,${committee}::uuid,${memberPage*25}) m),'[]') as members,
 coalesce((select jsonb_agg(r) from (select h.*,lub.has_org_permission(h.organization_id,'HOUR_RULES_MANAGE',h.committee_id) as "canEdit" from lub.hour_rules h where h.organization_id=o.id and (${committee}::uuid is null or h.committee_id=${committee}::uuid) order by h.effective_from desc,h.id limit 26 offset ${rulePage*25}) r),'[]') as rules,
 ${recordRows(org,term,page,null,committee)} as records,
 coalesce((select sum(h.hours) from lub.hour_records h where h.organization_id=o.id and h.status_code='Approved' and (${term}::uuid is null or h.academic_term_id=${term}::uuid) and (${committee}::uuid is null or h.committee_id=${committee}::uuid)),0)::text as total,
 case when lub.has_org_permission(o.id,'PERMISSIONS_GRANT') then lub.hour_grants(o.id,${memberPage*25}) else '[]'::jsonb end as grants,
 coalesce((select jsonb_agg(x) from lub.hour_import_candidates(o.id) x),'[]') as imports
 from lub.users u join lub.organizations o on o.id=${org} where u.id=${user} and lub.has_hours_access(o.id)`);
 return rows[0] as unknown as HoursWorkspace|undefined;
});}
export async function termWorkspace(user:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select ${account} as account,lub.is_super_admin() as "canManage",${terms} as terms from lub.users u where u.id=${user}`);
 return rows[0] as unknown as {account:AccountReadiness;canManage:boolean;terms:Term[]}|undefined;
});}
