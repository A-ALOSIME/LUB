import "server-only";
import { sql } from "drizzle-orm";
import { withUser, withVisitor } from "@/db/client";
import type { Event } from "./repository";

type EventWorkspace = {
  name: string;
  status: string | null;
  onboarded: boolean;
  canViewEvents: boolean;
  canManage: boolean;
  canManageAnnouncements: boolean;
  events: Array<Pick<Event, "id" | "organization_id" | "title" | "starts_at" | "ends_at" | "status_code" | "has_poster" | "revision" | "location_text" | "location_type_code"> & { registrant_count: number }>;
  templates: Array<{ id: string; name: string }>;
  announcements: Array<{ id: string; title: string; body: string; published: boolean; pinned: boolean; createdAt: string }>;
};

export async function eventWorkspaceOverview(user: string, org: string, page: number) {
  return withUser(user, async tx => {
    const rows = await tx.execute(sql`
      select
        o.name_ar as name,
        (select status_code from lub.users where id=${user}) as status,
        exists(select 1 from lub.student_profiles where user_id=${user}) as onboarded,
        lub.has_event_access(o.id) as "canViewEvents",
        lub.has_org_permission(o.id, 'EVENTS_MANAGE') as "canManage",
        lub.has_org_permission(o.id, 'ORG_PROFILE_MANAGE') as "canManageAnnouncements",
        case when lub.has_event_access(o.id) then coalesce((
          select jsonb_agg(e) from (
            select e.id, e.organization_id,e.title, coalesce(e.starts_at::text,'') as starts_at, coalesce(e.ends_at::text,'') as ends_at, e.status_code,e.revision,e.location_text,e.location_type_code,
              exists(select 1 from lub.event_assets ea where ea.event_id=e.id and ea.asset_type_code='Poster') as has_poster,
              (select count(*)::int from lub.event_registrations r where r.event_id=e.id) as registrant_count
            from lub.events e where e.organization_id=o.id
            order by e.starts_at desc, e.id limit 26 offset ${page * 25}
          ) e
        ), '[]'::jsonb) else '[]'::jsonb end as events,
        case when lub.has_event_access(o.id) then coalesce((
          select jsonb_agg(t) from (
            select t.id, t.name from lub.form_templates t
            where (t.organization_id=o.id or t.is_system_template)
              and exists(select 1 from lub.form_versions v where v.form_template_id=t.id and v.status_code='Published')
            order by t.name, t.id limit 100
          ) t
        ), '[]'::jsonb) else '[]'::jsonb end as templates,
        case when lub.has_org_permission(o.id, 'ORG_PROFILE_MANAGE') then coalesce((
          select jsonb_agg(a) from (
            select a.id, a.title, a.body, a.published_at is not null as published,
              a.pinned_at is not null as pinned, a.created_at as "createdAt"
            from lub.announcements a where a.organization_id=o.id and a.archived_at is null
            order by a.pinned_at desc nulls last, a.created_at desc, a.id limit 30
          ) a
        ), '[]'::jsonb) else '[]'::jsonb end as announcements
      from lub.organizations o
      where o.id=${org} and (lub.has_event_access(o.id) or lub.has_org_permission(o.id, 'ORG_PROFILE_MANAGE'))
    `);
    return rows[0] as unknown as EventWorkspace | undefined;
  });
}

export async function publicEventPoster(id: string) {
  return withVisitor(async tx => {
    const rows = await tx.execute(sql`select * from lub.public_event_poster(${id})`);
    return rows[0] as { object_key: string; mime_type: string } | undefined;
  });
}

export async function privateEventPoster(user:string,id:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select a.object_key,a.mime_type from lub.events e join lub.event_assets ea on ea.event_id=e.id and ea.asset_type_code='Poster' join lub.application_assets a on a.id=ea.asset_id where e.id=${id} and lub.can_operate_event(e.id) limit 1`);
 return rows[0] as {object_key:string;mime_type:string}|undefined;
});}
