import "server-only";
import { sql } from "drizzle-orm";
import { withUser, withVisitor } from "@/db/client";
import type { Event } from "./repository";

type EventWorkspace = {
  name: string;
  status: string | null;
  onboarded: boolean;
  canManage: boolean;
  events: Array<Pick<Event, "id" | "title" | "starts_at" | "status_code" | "has_poster">>;
  templates: Array<{ id: string; name: string }>;
};

export async function eventWorkspaceOverview(user: string, org: string, page: number) {
  return withUser(user, async tx => {
    const rows = await tx.execute(sql`
      select
        o.name_ar as name,
        (select status_code from lub.users where id=${user}) as status,
        exists(select 1 from lub.student_profiles where user_id=${user}) as onboarded,
        lub.has_org_permission(o.id, 'EVENTS_MANAGE') as "canManage",
        coalesce((
          select jsonb_agg(e) from (
            select e.id, e.title, e.starts_at, e.status_code,
              exists(select 1 from lub.public_event_poster(e.id)) as has_poster
            from lub.events e where e.organization_id=o.id
            order by e.starts_at desc, e.id limit 26 offset ${page * 25}
          ) e
        ), '[]'::jsonb) as events,
        coalesce((
          select jsonb_agg(t) from (
            select t.id, t.name from lub.form_templates t
            where (t.organization_id=o.id or t.is_system_template)
              and exists(select 1 from lub.form_versions v where v.form_template_id=t.id and v.status_code='Published')
            order by t.name, t.id limit 100
          ) t
        ), '[]'::jsonb) as templates
      from lub.organizations o
      where o.id=${org} and lub.has_event_access(o.id)
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
