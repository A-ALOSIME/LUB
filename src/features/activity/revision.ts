import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";

// Opaque freshness fingerprints only. RLS and the verified actor still govern every read.
export async function activityRevision(user:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select md5(concat_ws('|',
  (select jsonb_build_array(count(*),max(updated_at),sum(revision),count(*) filter(where starts_at<=statement_timestamp()))::text from lub.tasks where status_code='Open' or id in(select task_id from lub.task_participants where user_id=${user})),
  (select coalesce(jsonb_agg(jsonb_build_array(id,status_code,approved_hours_override,closed_at) order by id),'[]')::text from lub.task_participants where user_id=${user}),
  (select coalesce(jsonb_agg(jsonb_build_array(id,task_id,status_code) order by id),'[]')::text from lub.task_participants),
  (select coalesce(jsonb_agg(jsonb_build_array(a.asset_id,a.event_id) order by a.event_id,a.asset_id),'[]')::text from lub.event_assets a where a.asset_type_code='Poster' and a.event_id in(select event_id from lub.tasks)),
  (select coalesce(jsonb_agg(jsonb_build_array(t.id,p.object_key) order by t.id),'[]')::text from lub.tasks t join lateral lub.public_event_poster(t.event_id) p on true),
  (select jsonb_build_array(count(*),max(s.submitted_at),max(s.reviewed_at))::text from lub.task_submissions s join lub.task_participants p on p.id=s.task_participant_id where p.user_id=${user}),
  (select coalesce(jsonb_agg(jsonb_build_array(r.id,r.status_code,r.review_status_code,r.review_note,e.revision,a.status_code) order by r.id),'[]')::text from lub.event_registrations r join lub.events e on e.id=r.event_id left join lub.event_attendance a on a.event_registration_id=r.id where r.user_id=${user}),
  (select jsonb_build_array(count(*),max(updated_at),sum(hours))::text from lub.hour_records where organization_membership_id in(select id from lub.organization_memberships where user_id=${user})),
  (select jsonb_build_array(count(*),max(a.created_at))::text from lub.hour_adjustments a join lub.hour_records h on h.id=a.hour_record_id where h.organization_membership_id in(select id from lub.organization_memberships where user_id=${user})),
  (select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]')::text from lub.academic_terms t),
  (select coalesce(jsonb_agg(jsonb_build_array(m.id,m.status_code,m.end_date,o.name_ar,o.status_code,o.self_report_hours_enabled) order by m.id),'[]')::text from lub.organization_memberships m join lub.organizations o on o.id=m.organization_id where m.user_id=${user}),
  (select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]')::text from lub.role_assignments r where r.organization_membership_id in(select id from lub.organization_memberships where user_id=${user})),
  (select coalesce(jsonb_agg(jsonb_build_array(to_jsonb(g),g.start_at<=statement_timestamp() and (g.end_at is null or g.end_at>statement_timestamp())) order by g.id),'[]')::text from lub.permission_grants g where g.organization_membership_id in(select id from lub.organization_memberships where user_id=${user})),
  (select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]')::text from lub.committee_memberships m where m.organization_membership_id in(select id from lub.organization_memberships where user_id=${user})),
  (select coalesce(jsonb_agg(jsonb_build_array(c.id,c.name,c.status_code,c.parent_committee_id) order by c.id),'[]')::text from lub.committees c where c.organization_id in(select organization_id from lub.organization_memberships where user_id=${user}))
 )) as version`);
 return String(rows[0]?.version??"");
});}

export async function notificationRevision(user:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select md5(coalesce(jsonb_agg(jsonb_build_array(id,created_at,read_at) order by id),'[]')::text) as version from lub.notifications where recipient_user_id=${user}`);
 return String(rows[0]?.version??"");
});}
