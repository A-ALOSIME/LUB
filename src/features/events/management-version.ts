import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
/** An opaque actor-scoped freshness signal, never a permission cache. */
export async function organizationEventsVersion(user:string,org:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select md5(concat_ws('|',to_jsonb(o)::text,
 lub.has_event_access(o.id)::text,lub.has_org_permission(o.id,'EVENTS_MANAGE')::text,lub.has_org_permission(o.id,'EVENT_ATTENDANCE_MANAGE')::text,lub.has_org_permission(o.id,'EVENT_CONTRIBUTIONS_MANAGE')::text,lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE')::text,
 (select coalesce(jsonb_agg(jsonb_build_array(to_jsonb(e),e.ends_at<=statement_timestamp()) order by e.id),'[]')::text from lub.events e where e.organization_id=o.id),
 (select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]')::text from lub.event_registrations r join lub.events e on e.id=r.event_id where e.organization_id=o.id),
 (select coalesce(jsonb_agg(to_jsonb(a) order by a.event_registration_id),'[]')::text from lub.event_attendance a join lub.event_registrations r on r.id=a.event_registration_id join lub.events e on e.id=r.event_id where e.organization_id=o.id),
 (select coalesce(jsonb_agg(to_jsonb(a) order by a.event_id,a.asset_id),'[]')::text from lub.event_assets a join lub.events e on e.id=a.event_id where e.organization_id=o.id),
 (select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]')::text from lub.announcements a where a.organization_id=o.id),
 (select coalesce(jsonb_agg(to_jsonb(p) order by p.registration_id),'[]')::text from lub.event_registration_profiles(o.id) p),
 (select coalesce(jsonb_agg(jsonb_build_array(f.id,f.revision) order by f.id),'[]')::text from lub.form_responses f where f.id in(select r.form_response_id from lub.event_registrations r join lub.events e on e.id=r.event_id where e.organization_id=o.id)),
 (select coalesce(jsonb_agg(jsonb_build_array(t.id,t.name,v.id,v.status_code) order by t.id,v.id),'[]')::text from lub.form_templates t left join lub.form_versions v on v.form_template_id=t.id where t.organization_id=o.id or t.is_system_template)
 )) as version from lub.organizations o where o.id=${org} and (lub.has_event_access(o.id) or lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE'))`);
 return rows[0]?.version?String(rows[0].version):null;
});}
