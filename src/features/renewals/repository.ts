import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {AccountReadiness,Term} from "@/features/hours/repository";
export type Campaign={id:string;organization_id:string;academic_term_id:string;opens_at:string;closes_at:string;exclude_leadership:boolean;status_code:string;name:string;org_name:string;created_at:string};
export type Renewal={id:string;organization_membership_id:string;response_code:string;responded_at:string|null;name:string|null;canRespond:boolean};
export type RenewalWorkspace={account:AccountReadiness;name:string;allowed:boolean;terms:Term[];campaigns:Campaign[];selected:Campaign|null;responses:Renewal[];counts:Array<{status:string;count:number}>;members:Array<{id:string;name:string}>;exclusions:Array<{id:string;name:string;reason:string}>};
export type PersonalRenewals={account:AccountReadiness;items:Array<{campaign:Campaign;response:Renewal}>};
const account=sql`jsonb_build_object('status',u.status_code,'onboarded',exists(select 1 from lub.student_profiles where user_id=u.id))`;
export async function myRenewals(user:string,page:number){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select ${account} as account,coalesce((select jsonb_agg(x order by x.created_at desc,x.id) from (
 select c.id,c.created_at,to_jsonb(c)||jsonb_build_object('name',t.name_ar,'org_name',o.name_ar) as campaign,to_jsonb(r)||jsonb_build_object('name',null,'response_code',case when r.response_code='Pending' and c.closes_at<=statement_timestamp() then 'No_Response' else r.response_code end,'canRespond',c.status_code='Open' and c.opens_at<=statement_timestamp() and c.closes_at>statement_timestamp() and r.response_code='Pending' and lub.task_scope_member(c.organization_id,null) and exists(select 1 from lub.organization_memberships where id=r.organization_membership_id and status_code='Active' and start_date<=current_date and (end_date is null or end_date>current_date))) as response
 from lub.membership_renewals r join lub.renewal_campaigns c on c.id=r.renewal_campaign_id join lub.academic_terms t on t.id=c.academic_term_id join lub.organizations o on o.id=c.organization_id where lub.owns_membership(r.organization_membership_id) order by c.created_at desc,c.id limit 26 offset ${page*25}) x),'[]') as items from lub.users u where u.id=${user}`);
 return rows[0] as unknown as PersonalRenewals|undefined;
});}
export async function renewalWorkspace(user:string,org:string,selected:string|null,page:number,memberPage:number){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`with chosen as (select c.*,t.name_ar as name,o.name_ar as org_name from lub.renewal_campaigns c join lub.academic_terms t on t.id=c.academic_term_id join lub.organizations o on o.id=c.organization_id where c.organization_id=${org} and (${selected}::uuid is null or c.id=${selected}::uuid) and lub.has_org_permission(c.organization_id,'RENEWALS_MANAGE') order by c.created_at desc,c.id limit 1)
 select ${account} as account,o.name_ar as name,lub.has_org_permission(o.id,'RENEWALS_MANAGE') as allowed,
 coalesce((select jsonb_agg(t order by t.start_date desc) from (select * from lub.academic_terms order by start_date desc limit 100) t),'[]') as terms,
 coalesce((select jsonb_agg(c order by c.created_at desc,c.id) from (select c.*,t.name_ar as name,o.name_ar as org_name from lub.renewal_campaigns c join lub.academic_terms t on t.id=c.academic_term_id where c.organization_id=o.id order by c.created_at desc,c.id limit 26 offset ${page*25}) c),'[]') as campaigns,
 (select to_jsonb(c) from chosen c) as selected,
 coalesce((select jsonb_agg(r) from (select r.id,r.organization_membership_id,r.responded_at,lub.renewal_member_name(r.id) as name,false as "canRespond",case when r.response_code='Pending' and c.closes_at<=statement_timestamp() then 'No_Response' else r.response_code end as response_code from lub.membership_renewals r join chosen c on c.id=r.renewal_campaign_id order by r.id limit 26 offset ${memberPage*25}) r),'[]') as responses,
 coalesce((select jsonb_agg(x) from (select case when r.response_code='Pending' and c.closes_at<=statement_timestamp() then 'No_Response' else r.response_code end as status,count(*)::int as count from lub.membership_renewals r join chosen c on c.id=r.renewal_campaign_id group by 1) x),'[]') as counts,
 coalesce((select jsonb_agg(m) from lub.hour_members(o.id,null,${memberPage*25}) m),'[]') as members,
 coalesce((select jsonb_agg(e) from (select e.organization_membership_id as id,lub.renewal_exclusion_name(c.id,e.organization_membership_id) as name,e.reason from lub.renewal_campaign_exclusions e join chosen c on c.id=e.renewal_campaign_id order by e.organization_membership_id limit 26 offset ${memberPage*25}) e),'[]') as exclusions
 from lub.users u join lub.organizations o on o.id=${org} where u.id=${user} and lub.has_org_permission(o.id,'RENEWALS_MANAGE')`);
 return rows[0] as unknown as RenewalWorkspace|undefined;
});}
