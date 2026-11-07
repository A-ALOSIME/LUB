import { sql } from "drizzle-orm";
import { withUser } from "@/db/client";
import type { OverviewUpdates } from "@/features/organizations/overview-updates";

export async function getOverviewUpdates(user:string):Promise<OverviewUpdates>{
 return withUser(user,async tx=>{
  const [row]=await tx.execute(sql`select
   coalesce((select jsonb_agg(x) from(select t.title,case when p.withdrawn_at is not null then 'Available' else coalesce(p.status_code,'Available') end as status from lub.tasks t left join lub.task_participants p on p.task_id=t.id and p.user_id=${user} where t.deleted_at is null and t.status_code='Open' and lub.can_read_task(t.id) order by t.created_at desc,t.id limit 2)x),'[]') as tasks,
   coalesce((select jsonb_agg(x) from(select e.title,case when r.status_code='Cancelled' then 'Withdrawn' else r.review_status_code end as status from lub.event_registrations r join lub.events e on e.id=r.event_id where r.user_id=${user} order by r.registered_at desc,r.id limit 2)x),'[]') as events,
   coalesce((select jsonb_agg(x) from(select o.name_ar as title,h.status_code as status,h.hours::text from lub.hour_records h join lub.organization_memberships m on m.id=h.organization_membership_id join lub.organizations o on o.id=h.organization_id where m.user_id=${user} order by coalesce(h.reviewed_at,h.created_at) desc,h.id limit 2)x),'[]') as hours,
   coalesce((select jsonb_agg(jsonb_build_object('title',x.title,'status',x.status)) from(select * from(
    select o.name_ar as title,a.status_code as status,a.created_at as at from lub.membership_applications a join lub.registration_rounds r on r.id=a.registration_round_id join lub.organizations o on o.id=r.organization_id where a.applicant_user_id=${user}
    union all select r.name_ar,r.status_code,r.created_at from lub.organization_opening_requests r where r.applicant_user_id=${user}
    union all select o.name_ar,case when r.response_code='Pending' then 'RenewalPending' else r.response_code end,c.created_at from lub.membership_renewals r join lub.organization_memberships m on m.id=r.organization_membership_id join lub.renewal_campaigns c on c.id=r.renewal_campaign_id join lub.organizations o on o.id=m.organization_id where m.user_id=${user} and c.status_code in('Open','Paused')
   )u order by (status='RenewalPending') desc,at desc limit 3)x),'[]') as requests`);
  return row as unknown as OverviewUpdates;
 });
}
